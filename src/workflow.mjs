import {matchesProductScope} from './products.mjs';
export const TODAY = '2026-10-08';
import {legacyReviewPending,legacyReviewStage,legacyReviewTask} from './legacy-review.mjs';
// Pure demo fixtures use TODAY; live form operations record the current Japan date.
export const currentDate = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const STAGES = ['開発予定', '手配中', '開発中', '適合確認', '販売準備', '販売開始'];
import {BOARD_PHASES} from './board-phases.mjs';
export const BOARD_STAGES = BOARD_PHASES.map(p=>p.label);
export function boardStageOf(p){if(p.sheetStatus?.category==='sold')return 6;if(p.sheetStatus?.category==='active')return Math.max(p.sheetStatus.stage||0,Math.min(stageOf(p),4));if(legacyReviewPending(p))return legacyReviewStage(p);const stage=stageOf(p);return stage===5?6:stage===4&&preparationComplete(p)&&p.launch?.status==='approval-pending'?5:stage;}
export const STATUS_LABELS = { todo: '未着手', waiting: '確認待ち', done: '完了' };
export const CHANNELS = ['清水さん開発', '中国開発', 'テックスメディア', '山科開発'];
export const OWNERS = ['担当A', '担当B'];
import {taskBlockers} from './work-flow.mjs';
import { assignmentPatch } from './case-workflow.mjs';

export function preparationComplete(project) {
  const required = project.tasks.filter(task => task.required);
  return required.length > 0 && required.every(task => task.status === 'done');
}

export function stageOf(project) {
  if(project.sheetStatus?.category==='sold')return 5;
  const pending = project.tasks.filter(task => task.required && task.status !== 'done');
  return pending.length ? Math.min(...pending.map(task => task.stage)) : preparationComplete(project) && project.launch?.status === 'confirmed' ? 5 : 4;
}
export function nextTask(project) {
  if(legacyReviewPending(project))return legacyReviewTask(project);
  const pending=project.launch?.status==='approval-pending';
  return project.tasks.find(task => task.required && task.status !== 'done') || (stageOf(project) === 5 ? project.afterLaunchTasks?.find(task => task.status !== 'done') : { id: 'launch', name: pending?'販売開始の最終承認':'販売開始の承認を依頼', owner: pending?project.reviewer:project.owner, status: 'waiting', due: '', description: pending?'指定された最終確認者が公開URLと注文可能なことを確認し、販売開始を承認してください。':'公開URLと注文可能なことを確認して、最終確認者へ販売開始の承認を依頼してください。' });
}
export function isOverdue(project, today = TODAY) {
  const after = stageOf(project) === 5 ? project.afterLaunchTasks || [] : [];
  return project.tasks.some(task => task.required && task.status !== 'done' && task.due && task.due < today) || after.some(task => task.status !== 'done' && task.due && task.due < today);
}
export function normalizeSearch(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\s\-‐‑–—ー・]/g, '');
}
export function filterProjects(projects, filters = {}, today = TODAY) {
  const query = normalizeSearch(filters.query);
  return projects.filter(project => {
    const text = normalizeSearch([project.manufacturer, project.car, project.sku, project.fakeSku, project.id, project.sheetStatus?.sku,project.sheetStatus?.source?.serial,project.sheetStatus?.source?.model, project.brand, project.productName, project.productSpec, project.fitment?.type, project.legacySnapshot?.serial,...(project.legacySnapshot?.ownCodes||[]),...(project.legacySnapshot?.vehicles||[]).flatMap(v=>[v.car_name,v.cc_car,v.model_codes])].join(' '));
    const actor=filters.currentOwner||'担当A';
    return (!query || text.includes(query))
      && (filters.quick !== 'legacy-review' || legacyReviewPending(project))
      && (!filters.channel || project.channel === filters.channel)
      && (!filters.owner || project.owner === filters.owner || project.tasks.some(t=>t.owner===filters.owner))
      && (!filters.brand || project.brand === filters.brand)
      && (!filters.productKind || matchesProductScope(project,filters.productKind))
      && (filters.quick !== 'mine' || project.owner === actor || project.tasks.some(t=>t.required&&t.status!=='done'&&t.owner===actor))
      && (filters.quick !== 'unassigned' || !project.owner || project.tasks.some(t=>t.required&&t.status!=='done'&&!t.owner))
      && (filters.quick !== 'waiting' || project.tasks.some(task => task.required && (task.status === 'waiting'||task.handover?.status==='pending'||task.handover?.status==='returned')) || (preparationComplete(project) && project.launch?.status !== 'confirmed') || (stageOf(project) === 5 && project.afterLaunchTasks?.some(task => task.status === 'waiting')))
      && (filters.quick !== 'overdue' || isOverdue(project, today));
  });
}
export function applyTasks(project, patches, today = TODAY, actor='担当A') {
  const now=new Date().toISOString();
  const tasks = project.tasks.map(task => {
    if (!patches[task.id]) return { ...task };
    const patch=patches[task.id];
    if (project.registrationType&&task.status!=='done'&&patch.owner&&patch.owner!==task.owner&&!(patch.due??task.due)) throw new Error('担当変更時は作業の期限を入力してください。引継ぎ内容は手順・確認内容に記録できます。');
    if (patch.status==='done'&&task.status!=='done'&&(task.handover?.status==='pending'||(patch.owner!==undefined&&patch.owner!==task.owner&&patch.owner))) throw new Error('先に新しい担当が引継ぎを受領してください。');
    if (project.registrationType&&patch.status==='done'&&task.status!=='done'&&!(patch.owner??task.owner)) throw new Error('作業の担当を設定してください。');
    const updated = { ...task, ...patch, ...assignmentPatch(task,patch,actor,now) };
    updated.completedAt = updated.status === 'done' ? (task.completedAt || today) : '';
    updated.completedBy = updated.status==='done' ? (task.completedBy || (task.status==='done'?task.owner:actor) || '') : task.completedBy || '';
    return updated;
  });
  if(project.flowVersion===2)for(const t of tasks)if(t.status==='done'&&project.tasks.find(old=>old.id===t.id)?.status!=='done'){const issues=taskBlockers({...project,tasks},t,{completion:true});if(issues.length)throw new Error(issues.join('・'));}
  const changedRequiredStatus = tasks.some((task,index)=>task.required&&(task.status!==project.tasks[index].status||task.id.startsWith('hp-')&&task.referenceUrl!==project.tasks[index].referenceUrl));
  const assignments=tasks.filter((task,index)=>task.owner!==project.tasks[index].owner).map(task=>({date:today,recordedAt:now,actor,text:`${task.name}の担当を${project.tasks.find(t=>t.id===task.id).owner||'未割当'}から${task.owner||'未割当'}へ変更しました。`}));
  return { ...project, tasks,history:[...(project.history||[]),...assignments], ...(project.launch?.status === 'confirmed' && changedRequiredStatus ? { launch: { ...project.launch, status: 'needs-review' } } : {}) };
}
export function shortDate(value) {
  return value ? value.slice(5).replace('-', '/') : '—';
}
export function healthOf(project,today=TODAY) {
  if(project.sheetStatus?.category==='sold')return {label:'販売済み',kind:'green'};
  if(project.sheetStatus?.category==='review')return {label:'要確認',kind:'amber'};
  if (project.hold) return { label: '保留', kind: 'muted' };
  if (legacyReviewPending(project))return {label:'引継ぎ確認待ち',kind:'amber'};
  if (isOverdue(project,today)) return { label: '期限超過', kind: 'red' };
  if (project.tasks.some(t=>t.required&&t.handover?.status==='pending')) return {label:'引継ぎ受領待ち',kind:'amber'};
  if (!project.owner||project.tasks.some(t=>t.required&&t.status!=='done'&&!t.owner)) return {label:'担当未割当',kind:'amber'};
  if (project.tasks.some(t=>t.required&&t.handover?.status==='returned')) return {label:'引継ぎ差し戻し',kind:'red'};
  if (project.launch?.status === 'needs-review') return { label: '発売を再確認', kind: 'amber' };
  if (preparationComplete(project) && project.launch?.status !== 'confirmed') return { label: project.launch?.status==='approval-pending'?'最終承認待ち':'発売確認待ち', kind: 'amber' };
  if (project.tasks.some(task => task.required && task.status === 'waiting') || (stageOf(project) === 5 && project.afterLaunchTasks?.some(task => task.status === 'waiting'))) return { label: '確認待ち', kind: 'amber' };
  if (stageOf(project) === 5) return { label: '販売中', kind: 'green' };
  return { label: '順調', kind: 'green' };
}
