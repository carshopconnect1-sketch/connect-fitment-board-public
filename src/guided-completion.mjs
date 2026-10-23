import {applyTasks} from './workflow.mjs';
import {requestHandover} from './case-workflow.mjs';
import {nextHandoverTasks} from './work-actions.mjs';
export function completeAndHandover(p,taskId,draft,handover,actor,today,{admin=false}={}){
 const t=p.tasks.find(x=>x.id===taskId);
 if(!t||t.status==='done')throw new Error('この作業は更新されています。最新の内容を確認してください。');
 if(!admin&&t.owner!==actor&&p.owner!==actor)throw new Error('担当者または案件責任者が完了してください。');
 const completed=applyTasks(p,{[taskId]:{...draft,status:'done'}},today,actor);
 if(!nextHandoverTasks(completed,taskId,actor,{admin}).some(x=>x.id===handover.taskId))throw new Error('引継ぎ先の作業は前工程待ち、または別の担当の管理中です。');
 return requestHandover(completed,handover.taskId,handover,actor);
}
