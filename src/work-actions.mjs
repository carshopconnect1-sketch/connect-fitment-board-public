import {BOARD_PHASES} from './board-phases.mjs';
import {taskBlockers} from './work-flow.mjs';
import {legacyReviewPending} from './legacy-review.mjs';

const LABELS={'product-plan':'商品仕様を入力','product-check':'既存商品を確認','product-intake':'担当・期限を確認','product-source':'仕入先・現物を手配','product-sample':'試作品を確認','product-quality':'品質・使用条件を記録','product-sku':'販売品番を登録','product-stock':'価格・在庫・納期を確認','product-hp':'HP掲載を確認','product-order':'受注・CSVを確認',plan:'対象仕様を入力',candidate:'既存の登録を確認',intake:'担当・期限を確認','purchase-order':'購入内容を登録',arrange:'現物・仕様を確認','china-number':'フェイク品番を確認','china-send':'送り状を登録','factory-receive':'工場の受取を確認',sample:'型取り・試作を記録','sample-review':'試作品を確認',fitting:'装着結果を入力',fitment:'適合情報を確定',sku:'販売品番を確認','vehicle-setup':'適合DBの車種を確認',table:'適合DBの反映を確認','hp-category':'車種ページを登録','hp-products':'商品反映を確認',main:'本店ページを確認',rakuten:'楽天ページを確認',yahoo:'Yahooページを確認',order:'注文書を確認','leadtime-register':'納期の登録を確認','csv-master':'CSV変換マスターを確認','csv-test':'CSVの変換結果を確認',production:'生産完了を記録'};
export const taskActionLabel=t=>({'production-complete':'生産完了を記録','leadtime-remove':'13week登録の削除を確認','order-form':'注文書を確認',...LABELS})[t?.id]||`${t?.name||'作業'}を入力`;
export function taskReadiness(p,t){
 if(!t)return ['対象の作業がありません'];
 const issues=taskBlockers(p,t);
 if(legacyReviewPending(p))issues.unshift('旧記録と現在の状況の確認待ち');
 const after=(p.afterLaunchTasks||[]).some(x=>x.id===t.id);
 if(after&&p.launch?.status!=='confirmed')issues.push('販売開始の正式承認待ち');
 const production=p.afterLaunchTasks?.find(x=>['production','production-complete'].includes(x.id));
 if(after&&production&&t.id!==production.id&&production.status!=='done')issues.push('生産完了の確認待ち');
 if(!after&&(p.flowVersion||1)<2&&!['hp-category','vehicle-setup'].includes(t.id)){
  const earlier=p.tasks.find(x=>x.required!==false&&x.status!=='done'&&x.stage<t.stage);
  if(earlier)issues.push(`${earlier.name}が未完了`);
 }
 return [...new Set(issues)];
}
export function workQueue(projects,actor,{admin=false,role='',query=''}={}){
 const q={ready:[],receive:[],approval:[],waiting:[],unassigned:[],sent:[]};
 if(!actor)return q;
 for(const p of projects){
  if(p.sheetStatus?.category==='sold'||p.sheetStatus?.relatedTo||['placeholder','closed'].includes(p.sheetStatus?.recordKind))continue;
  if(query&&!`${p.manufacturer} ${p.car} ${p.sku} ${p.fakeSku} ${p.id}`.normalize('NFKC').toLowerCase().includes(query.normalize('NFKC').toLowerCase().trim()))continue;
  const manager=role!=='viewer'&&(admin||p.owner===actor);
  const row=(t,kind='task')=>({id:`${p.id}:${t.id}:${kind}`,caseId:p.id,taskId:t.id,kind,car:p.car,sku:p.sku,owner:t.owner||'',due:t.due||'',name:t.name,action:taskActionLabel(t),phase:kind==='after'?6:Math.max(0,Math.min(6,Number(t.stage)||0)),blockers:[]});
  if(legacyReviewPending(p)){
   if(manager){const item={...row({id:'legacy-review',name:'旧記録と現在の状況を確認',owner:p.owner},'settings'),action:p.owner?'引継ぎ内容を確認':'責任者を設定して確認'};q[p.owner?'ready':'unassigned'].push(item);}
   continue;
  }
  if(!p.owner&&manager)q.unassigned.push({...row({id:'case-owner',name:'案件責任者を設定'},'settings'),action:'案件責任者を設定'});
  for(const t of [...p.tasks,...(p.launch?.status==='confirmed'?p.afterLaunchTasks||[]:[])]){
   if(t.required===false||t.status==='done')continue;
   const item=row(t,(p.afterLaunchTasks||[]).some(x=>x.id===t.id)?'after':'task'),h=t.handover;
   if(h?.status==='pending'&&h.from===actor&&h.to!==actor)q.sent.push({...item,kind:'handover',name:`${t.name}の受領を待っています`,recipient:h.to,action:'引継ぎ状況を見る'});
   if(h?.status==='pending'&&h.to===actor&&t.owner===actor){q.receive.push({...item,kind:'handover',action:'内容を確認して受け取る',handover:h});continue;}
   if(!t.owner){if(manager&&p.owner)q.unassigned.push({...item,action:'担当を設定'});continue;}
   if(role==='viewer'||t.owner!==actor)continue;
   item.blockers=taskReadiness(p,t);q[item.blockers.length?'waiting':'ready'].push(item);
  }
  if(p.launch?.status==='approval-pending'&&p.reviewer===actor&&role!=='viewer')q.approval.push({...row({id:'launch',name:'販売開始の最終承認',owner:p.reviewer},'approval'),phase:5,action:'承認内容を確認'});
  else if(!['confirmed','approval-pending'].includes(p.launch?.status)&&p.owner===actor&&p.tasks.length&&p.tasks.every(t=>t.required===false||t.status==='done')&&role!=='viewer')q.approval.push({...row({id:'launch',name:'販売開始の承認を依頼',owner:p.owner},'approval'),phase:5,action:'販売開始の条件を確認'});
 }
 for(const rows of Object.values(q))rows.sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||a.phase-b.phase||a.car.localeCompare(b.car,'ja'));
 return q;
}
export function nextHandoverTasks(p,completedId,actor,{admin=false}={}){
 return p.tasks.filter(t=>t.id!==completedId&&t.required!==false&&t.status!=='done'&&t.handover?.status!=='pending'&&(!t.owner||t.owner===actor||p.owner===actor||admin)&&taskReadiness(p,{...t,owner:t.owner||actor}).length===0).sort((a,b)=>a.stage-b.stage);
}
export function phaseTasks(p){return BOARD_PHASES.map((phase,index)=>({...phase,index,tasks:index<5?p.tasks.filter(t=>t.stage===index):index===6?p.afterLaunchTasks||[]:[]}));}
export function preferredWorkTab(q){return ['receive','approval','ready','unassigned','sent','waiting'].find(key=>q[key].length)||'ready';}
