import catalog from './work-catalog.json' with {type:'json'};
import {isProduct,makeProductTasks,taskDefinitions} from './products.mjs';
export const WORK_GROUPS=catalog.groups;
export function makeDetailedTasks(p){
 if(isProduct(p))return makeProductTasks(p);
 const china=p.developmentMethod==='purchase'||p.needsChina;
 return catalog.tasks.filter(t=>!t.when||t.when==='new'&&p.registrationType==='new'||t.when==='purchase'&&p.developmentMethod==='purchase'||t.when==='china'&&china).map(t=>({...t,name:t.id==='arrange'&&p.developmentMethod==='purchase'?t.purchaseName:t.name,description:t.proof,required:!['main','rakuten','yahoo'].includes(t.id)||(p.salesChannels||['main','rakuten','yahoo']).includes(t.id),owner:p.owner||'',due:t.id==='plan'?p.due||'':'',status:'todo',completedAt:'',completedBy:'',note:'',referenceUrl:'',parentId:''}));
}
export function taskBlockers(p,t,{completion=false}={}){
 const out=[];if(p.hold)out.push('案件が保留中');if(!t.owner)out.push('作業担当が未割当');if(t.handover?.status==='pending')out.push('新しい担当の引継ぎ受領待ち');
 const def=(taskDefinitions(p)||catalog.tasks).find(x=>x.id===t.id);
 for(const id of def?.requires||[]){const prev=p.tasks.find(x=>x.id===id);if(prev?.required&&prev.status!=='done')out.push(`${prev.name}が未完了`);}
 if(p.flowVersion===2&&completion&&!t.note?.trim()&&!t.referenceUrl?.trim())out.push('確認結果・資料URLを記録してください');
 if(t.id==='product-sku'&&!p.sku)out.push('商品設定に正式な販売品番を登録してください');
 if(t.id==='product-quality'&&!p.productSpec?.trim())out.push('商品仕様・使用条件を設定に記録してください');
 if(t.id==='product-intake'&&(!p.owner||!p.tasks.find(t=>t.id==='product-plan')?.due))out.push('責任者と最初の作業期限を設定してください');
 return out;
}
export function workGroups(p){return WORK_GROUPS.map(g=>({...g,tasks:g.id==='after'?p.afterLaunchTasks||[]:p.tasks.filter(t=>(t.group||catalog.tasks.find(x=>x.id===t.id)?.group)===g.id)}));}
export function upgradeFlow(p){const old=new Map(p.tasks.map(t=>[t.id,t]));return {...p,flowVersion:2,tasks:makeDetailedTasks(p).map(t=>old.has(t.id)?{...t,...old.get(t.id),group:t.group,requires:t.requires,description:t.description}:t),launch:{...p.launch,status:'needs-review'}};}
export function stopReason(p,t){if(p.hold)return p.holdReason||'保留中';return t?taskBlockers(p,t).join('・'):'';}
