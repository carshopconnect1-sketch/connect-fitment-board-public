import {isProduct,updateProduct} from './products.mjs';
export const REGISTRATION_TYPES = { new:'新規車種登録', existing:'既存車種への品番追加' };
export const SALES_CHANNELS = { main:'本店', rakuten:'楽天', yahoo:'Yahoo' };
export const ownerLabel = value => value || '未割当';
export const registrationLabel = project => isProduct(project)?'新商品の追加':project.legacyReview?.status === 'pending' ? '登録区分未確認' : REGISTRATION_TYPES[project.registrationType] || '区分未設定';
export const validHttps = value => {
  try { const url=new URL(value); return url.protocol==='https:'&&!url.username&&!url.password ? url.href : ''; } catch { return ''; }
};
const dateOK = value => /^\d{4}-\d{2}-\d{2}$/.test(value||'') && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;

export function appendCaseTasks(tasks, values) {
  if(isProduct(values))return tasks;
  if (!values.registrationType) return tasks;
  const channels=values.salesChannels||Object.keys(SALES_CHANNELS);
  const base=tasks.filter(t=>!t.id.startsWith('hp-')).map(t=>Object.hasOwn(SALES_CHANNELS,t.id)?{...t,required:channels.includes(t.id)}:t);
  const hp=(id,name,description)=>({id,name,description,stage:4,owner:values.hpOwner||'',required:true,status:'todo',due:'',completedAt:'',completedBy:'',note:'',referenceUrl:values.categoryUrl||'',parentId:''});
  if (values.registrationType==='new') base.push({...hp('hp-category','HPカテゴリーページの作成・公開','新しい車種・世代のページを公開し、HP一覧から辿れることを確認。URLと作業実績を記録します。'),...(values.categoryAdded?{status:'done',completedAt:values.categoryCompletedAt||'',completedBy:values.categoryCompletedBy||'',note:'HP追加済み。作業者・日時・URLは確認して記録してください。'}:{})});
  base.push(hp('hp-products','HPへの品番・適合・商品反映','今回の品番・適合・商品導線を対象カテゴリーページに反映し、既存品番との区別を確認します。'));
  return base;
}

export function registrationIssues(values) {
  if(isProduct(values))return [];
  const issues=[];
  if (!Object.hasOwn(REGISTRATION_TYPES,values.registrationType)) issues.push('登録区分を選択してください。');
  if (values.registrationType==='existing'&&!values.baseVehicleId) issues.push('追加先の既存車種・世代を選択してください。');
  if (values.categoryUrl&&!validHttps(values.categoryUrl)) issues.push('カテゴリーページURLは認証情報を含まないhttpsで入力してください。');
  return issues;
}

function replacement(task,to,actor,due,context,now) {
  const revision=Math.max(task.handover?.revision||0,...(task.handoverHistory||[]).map(h=>h.revision||0))+1;
  return {id:`${task.id}:${revision}`,revision,from:actor||task.owner||'',to,status:'pending',due,context,requestedAt:now,acceptedAt:'',acceptedBy:'',reason:''};
}
export function assignmentPatch(task,patch,actor,now) {
  const owner=patch.owner??task.owner??'';
  if (owner===(task.owner||'')) return {};
  const historical=task.status==='done'?{completedBy:task.completedBy||task.owner||''}:{};
  const entry={from:task.owner||'',to:owner,actor,at:now};
  const prev=task.handover ? [...(task.handoverHistory||[]),task.handover] : task.handoverHistory||[];
  return {...historical,assignmentHistory:[...(task.assignmentHistory||[]),entry],handoverHistory:prev,
    handover:task.status!=='done'&&owner?replacement(task,owner,task.owner||actor,patch.due??task.due,patch.note||task.note||task.description||'担当変更の内容を確認してください。',now):null};
}

export function requestHandover(project,taskId,draft,actor,now=new Date().toISOString()) {
  const task=project.tasks.find(t=>t.id===taskId);
  if (!task||task.status==='done') throw new Error('未完了の作業を選択してください。');
  if (!actor||!draft.to?.trim()||!dateOK(draft.due)||!draft.context?.trim()) throw new Error('引継ぎ先・対応期限・次にやることを入力してください。');
  const h=replacement(task,draft.to.trim(),actor,draft.due,draft.context.trim(),now);
  return {...project,tasks:project.tasks.map(t=>t.id===taskId?{...t,owner:h.to,due:h.due,handover:h,handoverHistory:[...(t.handoverHistory||[]),...(t.handover?[t.handover]:[])],assignmentHistory:[...(t.assignmentHistory||[]),{from:t.owner||'',to:h.to,actor,at:now}]}:t),history:[...project.history,{date:now.slice(0,10),recordedAt:now,actor,text:`${task.name}を${h.to}へ引継ぎ依頼。期限 ${h.due}。${h.context}`} ]};
}
function currentRequest(project,taskId,id,actor) {
  const task=project.tasks.find(t=>t.id===taskId);
  if (!task?.handover||task.handover.id!==id||task.handover.status!=='pending'||task.handover.to!==actor||task.owner!==actor) throw new Error('この引継ぎは現在の受取担当だけが操作できます。担当と最新の依頼を確認してください。');
  return task;
}
export function acceptHandover(project,taskId,id,actor,now=new Date().toISOString()) {
  const task=currentRequest(project,taskId,id,actor);
  return {...project,tasks:project.tasks.map(t=>t.id===taskId?{...t,handover:{...t.handover,status:'accepted',acceptedAt:now,acceptedBy:actor}}:t),history:[...project.history,{date:now.slice(0,10),recordedAt:now,actor,text:`${task.name}の引継ぎを受領しました。`}]};
}
export function returnHandover(project,taskId,id,actor,reason,now=new Date().toISOString()) {
  const task=currentRequest(project,taskId,id,actor);
  if (!reason?.trim()) throw new Error('差し戻し理由を入力してください。');
  return {...project,tasks:project.tasks.map(t=>t.id===taskId?{...t,owner:t.handover.from,handover:{...t.handover,status:'returned',reason:reason.trim(),returnedBy:actor,returnedAt:now}}:t),history:[...project.history,{date:now.slice(0,10),recordedAt:now,actor,text:`${task.name}を${ownerLabel(task.handover.from)}へ差し戻し。${reason.trim()}`}]};
}

export function applyCaseSettings(project,draft,actor,now=new Date().toISOString()) {
  if(isProduct(project)){const next=updateProduct(project,draft);if(!next.productName)throw new Error('商品名を入力してください。');if(!next.salesChannels?.length)throw new Error('販売先を選択してください。');return {...next,tasks:project.tasks.map(t=>['main','rakuten','yahoo'].includes(t.id)?{...t,required:next.salesChannels.includes(t.id)}:t),...(project.launch?.status==='confirmed'?{launch:{...project.launch,status:'needs-review'}}:{}),history:[...project.history,{date:now.slice(0,10),recordedAt:now,actor,text:'商品仕様・担当の設定を更新しました。'}]};}
  const issues=registrationIssues(draft);
  const channels=draft.salesChannels||Object.keys(SALES_CHANNELS);
  if (!channels.length) issues.push('販売先を1つ以上選択してください。');
  for (const id of Object.keys(SALES_CHANNELS)) if (!channels.includes(id)&&!draft.channelExclusions?.[id]?.trim()) issues.push(`${SALES_CHANNELS[id]}を対象外にする理由を入力してください。`);
  if (issues.length) throw new Error(issues.join(' '));
  const bindingChanged=project.registrationType!==draft.registrationType||project.baseVehicleId!==draft.baseVehicleId||project.generation!==draft.generation;
  const tasks=appendCaseTasks(project.tasks,draft).map(t=>{
    if (!t.id.startsWith('hp-')) return t;
    const previous=project.tasks.find(x=>x.id===t.id);
    if (!previous||bindingChanged) return t;
    const categoryChanged=t.id==='hp-category'&&!!draft.categoryAdded!==(previous.status==='done');
    return {...previous,referenceUrl:draft.categoryUrl??previous.referenceUrl,required:true,
      ...(categoryChanged?{status:draft.categoryAdded?'done':'todo',completedAt:'',completedBy:'',note:draft.categoryAdded?'HP追加済み。作業者・日時・URLは確認して記録してください。':''}:{})};
  });
  const material=bindingChanged||JSON.stringify(project.salesChannels)!==JSON.stringify(channels)||project.categoryUrl!==draft.categoryUrl||tasks.some(t=>t.required&&project.tasks.find(p=>p.id===t.id)?.status!==t.status);
  const ownerChanged=(project.owner||'')!==(draft.owner||'');
  return {...project,...draft,owner:draft.owner||'',salesChannels:channels,tasks,
    ...(project.launch?.status==='confirmed'&&material?{launch:{...project.launch,status:'needs-review'}}:{}),
    history:[...project.history,{date:now.slice(0,10),recordedAt:now,actor,text:ownerChanged?`案件責任者を${ownerLabel(project.owner)}から${ownerLabel(draft.owner)}へ変更。${draft.handoverNote||''}`:'登録区分・HP・販売先の設定を更新しました。'}]};
}

export function caseLaunchIssues(project) {
  if (!project.registrationType) return [];
  const issues=registrationIssues(project);
  if (!project.owner) issues.push('案件責任者を設定してください。');
  if (project.tasks.some(t=>t.required&&t.status!=='done'&&!t.owner)) issues.push('未割当の必要作業に担当を設定してください。');
  if (project.tasks.some(t=>t.required&&t.handover?.status==='pending')) issues.push('必要作業の引継ぎを受領してください。');
  for (const t of project.tasks.filter(t=>t.required&&t.id.startsWith('hp-'))) if (!validHttps(t.referenceUrl)) issues.push(`${t.name}の公開URLを記録してください。`);
  return issues;
}
export function publicationIssues(project,draft) {
  if (!project.registrationType) return [];
  const issues=[];
  for (const id of project.salesChannels||Object.keys(SALES_CHANNELS)) {
    if (!validHttps(draft.urls?.[id])) issues.push(`${SALES_CHANNELS[id]}の公開商品URLを入力してください。`);
    if (draft.orderChecked?.[id]!==true) issues.push(`${SALES_CHANNELS[id]}で品番・適合・価格・納期が正しく、注文可能なことを確認してください。`);
  }
  return issues;
}

export const FLOW_STEPS = [
  ['開発予定','対象仕様・登録区分・担当・期限を決める','手配担当／HP担当へ仕様を渡す'],
  ['手配中','他社製品の購入・受取、または現車を手配','開発担当へ現物・資料を渡す'],
  ['開発中','型取り・試作・工場確認を進める','装着確認へ試作品と修正履歴を渡す'],
  ['適合確認','装着結果と適合・注意事項を確定','品番・適合表・販売担当へ確認結果を渡す'],
  ['販売準備','HP・品番・適合表・納期・CSV・販売ページを確認','発売の最終確認へ公開URLと根拠を渡す'],
  ['販売開始','対象販売先で注文できることを確認して確定','フロントへ品番・URL・納期・注意事項を共有'],
];
