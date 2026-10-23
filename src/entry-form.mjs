import {REGISTRATION_TYPES,SALES_CHANNELS,validHttps} from './case-workflow.mjs';
import {isProduct,PRODUCT_KINDS} from './products.mjs';
export const ENTRY_STEPS=['車種','型取り・担当','確認'];
const blank=v=>!String(v??'').trim();
export function entryIssues(d,step,{review=false,exclusions=false}={}) {
  const errors={};
  if(d.productKind&&!PRODUCT_KINDS[d.productKind])errors.productKind='商品種類を選択してください。';
  if(isProduct(d)&&step===0){if(blank(d.productName))errors.productName='商品名を入力してください。';if(String(d.productName||'').length>80)errors.productName='商品名は80文字以内で入力してください。';return errors;}
  if(step===0){
    if(blank(d.manufacturer)||/^(未確認|未登録|不明)$/.test(d.manufacturer))errors.manufacturer='メーカーを入力してください。';
    if(blank(d.car)||/^車種未確認/.test(d.car))errors.car='車種名を入力してください。';
    if(!REGISTRATION_TYPES[d.registrationType])errors.registrationType='新規車種か、既存車種への追加かを選んでください。';
    if(d.registrationType==='existing'&&blank(d.baseVehicleId))errors.baseVehicleId='品番を追加する既存車種を選んでください。';
    if(d.categoryUrl&&!validHttps(d.categoryUrl))errors.categoryUrl='HPのURLは認証情報を含まないhttpsで入力してください。';
  }
  if(step===1){
    if(isProduct(d)&&d.productSku&&!/^[A-Za-z0-9][A-Za-z0-9._\/-]*$/.test(d.productSku))errors.productSku='販売品番は半角の英数字・ハイフン等で入力してください。';
    if(!['purchase','own'].includes(d.developmentMethod))errors.developmentMethod='型取り方法を選んでください。';
    if(d.due&&(!/^\d{4}-\d{2}-\d{2}$/.test(d.due)||Number.isNaN(Date.parse(d.due+'T00:00:00Z'))||new Date(d.due+'T00:00:00Z').toISOString().slice(0,10)!==d.due))errors.due='有効な期限を入力してください。';
    if(!d.salesChannels?.length)errors.salesChannels='対象販売先を1つ以上選んでください。';
    if(exclusions&&Object.keys(SALES_CHANNELS).some(k=>!d.salesChannels?.includes(k)&&blank(d.channelExclusions?.[k])))errors.channelExclusions='対象外の販売先には理由を入力してください。';
  }
  if(step===2&&review){if(!d.reviewed)errors.reviewed='元記録との照合にチェックしてください。';if(blank(d.reviewNote))errors.reviewNote='今の状況と残っている作業を記録してください。';}
  return errors;
}
export function entryTransition(step,d,options={}){
  for(const s of step===2?[0,1,2]:[step]){const issues=entryIssues(d,s,options);if(Object.keys(issues).length)return{step:s,commit:false,issues};}
  return {step:Math.min(step+1,2),commit:step===2,issues:{}};
}
export function entrySummary(d,name=v=>v){if(isProduct(d))return [['商品種類',PRODUCT_KINDS[d.productKind]],['商品名',d.productName],['商品仕様',d.productSpec||'登録後に確認'],['進め方',d.developmentMethod==='own'?'オリジナル商品を開発':'既製品を仕入れて販売'],['中国への現物発送',d.needsChina?'発送・工場受取を管理':'なし'],['販売品番',d.productSku||'販売準備で登録'],['案件責任者',name(d.owner)||'未定'],['最終確認者',name(d.reviewer)||'未定'],['対応期限',d.due||'後で設定'],['対象販売先',(d.salesChannels||[]).map(k=>SALES_CHANNELS[k]).join('・')]];return [
  ['メーカー・車種',[d.manufacturer,d.car].filter(Boolean).join(' ')],
  ['登録区分',REGISTRATION_TYPES[d.registrationType]],
  ['最初にすること',d.owner?'対象仕様と既存登録を確認する':'案件責任者を割り当て、対象仕様を確認する'],
  ['HPで必要な作業',d.registrationType==='new'?'HPカテゴリーページを作成し、品番・商品を追加':'既存の車種ページに品番・商品を追加'],
  ['型取り方法',d.developmentMethod==='purchase'?'他社製品を購入して型取り':'自社で型取り'],
  ...(d.developmentMethod==='purchase'?[['購入元・商品',[d.purchaseSource,d.purchaseProduct].filter(Boolean).join(' ／ ')||'後で設定']]:[]),
  ['中国への発送',d.developmentMethod==='purchase'||d.needsChina?'発送・工場受取の確認が必要':'現物の発送なし'],
  ['案件責任者',name(d.owner)||'担当未定の一覧で管理者が設定'],['最終確認者',name(d.reviewer)||'後で設定'],['最初の期限',d.due||'後で設定'],
  ['対象販売先',(d.salesChannels||[]).map(k=>SALES_CHANNELS[k]).join('・')],['ブランド',d.brand||'後で設定']
];}
