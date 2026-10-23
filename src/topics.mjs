import { TODAY, STAGES, stageOf, shortDate, preparationComplete } from './workflow.mjs';

const PRIORITY = { review:2.5, overdue: 0, followup: 1, shipping:1.5, handover: 2, unassigned: 3, waiting: 4, ready: 5, launch: 6, progress: 7 };
const recent = (date, today) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || date > today) return false;
  const days = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000;
  return Number.isFinite(days) && days >= 0 && days < 7;
};

export function collectTopics(projects, today = TODAY) {
  return projects.flatMap(project => {
    if (project.hold) return [];
    const tasks = project.tasks.filter(task => task.required);
    const stage = stageOf(project);
    const pending = [...tasks, ...(stage === 5 ? project.afterLaunchTasks || [] : [])].filter(task => task.status !== 'done');
    const overdue = pending.filter(task => task.due && task.due < today).sort((a, b) => a.due.localeCompare(b.due))[0];
    const waiting = pending.find(task => task.status === 'waiting');
    const handover = pending.find(t=>t.handover?.status==='pending'||t.handover?.status==='returned');
    const unassigned=project.registrationType&&(!project.owner||pending.some(t=>!t.owner));
    let topic;
    if(project.legacyReview?.status==='pending')topic={kind:'review',label:'引継ぎ確認待ち',message:`旧工程「${project.legacySnapshot.status}」と現在の登録内容を確認してください`,date:'',owner:project.owner,detail:'旧記録の照合'};
    else if (overdue) topic = { kind: 'overdue', label: '期限超過', message: `${overdue.name}の期限を過ぎています`, date: overdue.due, owner: overdue.owner, detail: `期限 ${shortDate(overdue.due)}` };
    else if (handover) topic={kind:'handover',label:handover.handover.status==='pending'?'引継ぎ受領待ち':'引継ぎ差し戻し',message:`${handover.name}：${handover.handover.status==='pending'?handover.handover.to+'の受領待ち':handover.handover.reason}`,date:handover.due,owner:handover.owner,detail:handover.due?`期限 ${shortDate(handover.due)}`:'次の作業を確認'};
    else if (unassigned) topic={kind:'unassigned',label:'担当未割当',message:!project.owner?'案件責任者を設定してください':'未完了の作業に担当を設定してください',date:'',owner:project.owner||'未割当',detail:'担当の割当待ち'};
    else if (waiting) topic = { kind: 'waiting', label: '確認待ち', message: `${waiting.name}の結果が確認待ちです`, date: waiting.due, owner: waiting.owner, detail: waiting.due ? `期限 ${shortDate(waiting.due)}` : '確認待ち' };
    else if (stage === 4 && preparationComplete(project)) topic = { kind: 'ready', label: '発売確認待ち', message: project.launch?.status === 'needs-review' ? '変更した内容を確認して、販売開始を再確定してください' : '販売準備が完了しました。販売開始を確定してください', date: '', owner: project.owner, detail: '販売開始の最終確認' };
    else if (stage === 5) {
      const date = project.launch?.date;
      if (recent(date, today)) topic = { kind: 'launch', label: '販売開始', message: '販売開始が確定しました', date, owner: project.launch.confirmedBy, detail: `発売 ${shortDate(date)}` };
    } else {
      const entry = [...(project.history || [])].reverse().find(item => item.kind === 'stage');
      if (entry && entry.stage === stage && recent(entry.date, today)) topic = { kind: 'progress', label: '進捗更新', message: `工程が「${STAGES[stage]}」に変わりました`, date: entry.date, owner: entry.actor || project.owner, detail: `更新 ${shortDate(entry.date)}` };
    }
    const notices = [];
    // A material task change creates a fresh notice even after acknowledgement.
    const revision = JSON.stringify([[project.launch?.status, project.launch?.date, project.launch?.confirmedAt], ...[...tasks, ...(project.afterLaunchTasks || [])].map(task => [task.id, task.status, task.due, task.owner, task.completedAt,task.handover?.id,task.handover?.status,task.handover?.context,task.handover?.reason]),(project.shipments||[]).map(s=>[s.id,s.status,s.checkedAt,s.deliveryUpdate,s.factoryReceivedAt,s.owner])]);
    if (topic) notices.push(topic);
    const shipping=(project.shipments||[]).find(s=>s.status==='issue'||s.status==='received'&&!s.factoryReceivedAt||s.status!=='preparing'&&!s.checkedAt);
    if(shipping) notices.push({kind:'shipping',label:shipping.status==='issue'?'配送要対応':shipping.status==='received'?'工場受取待ち':'配送確認待ち',message:shipping.status==='issue'?(shipping.deliveryUpdate||'配送の問題を確認してください'):shipping.status==='received'?'中国到着後の工場受取を確認してください':'ヤマトの追跡状況を確認して記録してください',date:shipping.sentAt,owner:shipping.owner||'未割当',detail:'中国への発送'});
    const production = project.afterLaunchTasks?.find(task => task.id === 'production-complete');
    const removal = project.afterLaunchTasks?.find(task => task.id === 'leadtime-remove');
    if (stage === 5 && production?.status === 'done' && removal && removal.status !== 'done' && tasks.some(task => task.id === 'leadtime-register' && task.status === 'done')) {
      notices.push({ kind: 'followup', label: '販売後の確認', message: '生産完了後の13week登録を削除してください', date: production.completedAt || today, owner: removal.owner, detail: removal.due ? `期限 ${shortDate(removal.due)}` : '納期返信アプリの削除待ち' });
    }
    return notices.map(item => ({ ...item, updatedAt: project.updatedAt || '', id: `${project.id}:${item.kind}:${revision}`, projectId: project.id, car: project.car, sku: project.sku || '品番未定' }));
  }).sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || (a.date || '9999').localeCompare(b.date || '9999') || a.projectId.localeCompare(b.projectId));
}

export function topicDateTime(value) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return '時刻未記録';
  return new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

export function featuredTopics(topics, limit = 3) {
  const chosen = [];
  for (const kind of Object.keys(PRIORITY)) {
    const topic = topics.find(item => item.kind === kind);
    if (topic && chosen.length < limit) chosen.push(topic);
  }
  for (const topic of topics) if (!chosen.includes(topic) && chosen.length < limit) chosen.push(topic);
  return chosen;
}
