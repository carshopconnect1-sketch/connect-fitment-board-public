import definitions from './product-tasks.json' with {type:'json'};
export const PRODUCT_KINDS={seat:'シートカバー',steering:'ハンドルカバー',neck:'ネックパッド',other:'その他の商品'};
export const isProduct=p=>['steering','neck','other'].includes(p?.productKind);
export const matchesProductScope=(p,scope='seat')=>scope==='accessories'?isProduct(p):(p.productKind||'seat')===(scope||'seat');
export const productKindLabel=p=>PRODUCT_KINDS[p.productKind||'seat']||PRODUCT_KINDS.seat;
export const taskDefinitions=p=>isProduct(p)?definitions:null;
export function productFields(d){return isProduct(d)?{...d,productName:String(d.productName||'').trim(),productSpec:String(d.productSpec||'').trim(),productSku:String(d.productSku??d.sku??'').trim().toUpperCase(),car:String(d.productName||'').trim(),manufacturer:'',make:'',registrationType:'product',baseVehicleId:'',needsChina:!!d.needsChina}:d;}
export function makeProductTasks(p){return definitions.filter(t=>!t.when||t.when==='own'&&p.developmentMethod==='own'||t.when==='china'&&p.needsChina).map(t=>({...t,description:t.proof,owner:p.owner||'',due:t.id==='product-plan'?p.due||'':'',required:!['main','rakuten','yahoo'].includes(t.id)||(p.salesChannels||['main','rakuten','yahoo']).includes(t.id),status:'todo',completedAt:'',completedBy:'',note:'',referenceUrl:'',parentId:''}));}
export function productLaunchIssues(p){const out=[];if(!p.productName?.trim())out.push('商品名を入力してください。');if(!p.productSpec?.trim())out.push('サイズ・色・素材・使用条件などの商品仕様を記録してください。');const hp=p.tasks.find(t=>t.id==='product-hp');if(hp?.required&&!/^https:\/\//.test(hp.referenceUrl||''))out.push('HPの商品掲載・カテゴリの公開URLを記録してください。');return out;}
export function updateProduct(p,d){if(d.productKind!==p.productKind||d.developmentMethod!==p.developmentMethod||!!d.needsChina!==!!p.needsChina)throw new Error('商品種類・開発方法・中国発送の変更は別案件で登録してください。');return {...p,...productFields(d),sku:String(d.productSku??p.sku).trim().toUpperCase()};}
