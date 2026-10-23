export const legacyReviewPending=p=>p?.legacyReview?.status==='pending';
export function legacyReviewStage(p){const n=Number(p?.legacyReview?.sourceStage);return Number.isInteger(n)?Math.max(0,Math.min(4,n)):0;}
export function legacyReviewTask(p){return {id:'legacy-review',name:'旧記録と現在の状況を確認',stage:legacyReviewStage(p),status:'waiting',required:true,owner:p.owner||'',due:'',description:'登録区分・型取り方法・対象車両と、残っている作業を旧記録と照合してください。'};}
