import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject } from '../src/sample-data.mjs';
import { applyTasks } from '../src/workflow.mjs';
import { requestHandover,acceptHandover,returnHandover,applyCaseSettings } from '../src/case-workflow.mjs';
import { confirmLaunch } from '../src/launch.mjs';

const values = { manufacturer:'ホンダ', car:'確認用車種', registrationType:'new', generation:'確認用世代', developmentMethod:'own' };
test('新規車種にはカテゴリ作成と商品反映を別の必要作業として追加する', () => {
  const p=newProject(values,'C-900');
  assert.equal(p.tasks.find(t=>t.id==='hp-category')?.required,true);
  assert.equal(p.tasks.find(t=>t.id==='hp-products')?.required,true);
});
test('既存車種への新品番追加にはカテゴリ作成を課さず、追加先を保持する', () => {
  const p=newProject({...values,registrationType:'existing',baseVehicleId:'C-001'},'C-901');
  assert.equal(p.tasks.some(t=>t.id==='hp-category'),false);
  assert.equal(p.tasks.find(t=>t.id==='hp-products')?.required,true);
  assert.equal(p.baseVehicleId,'C-001');
});
test('担当未定の新規案件は全作業を未割当で登録できる', () => {
  const p=newProject(values,'C-902');
  assert.equal(p.owner,'');
  assert.equal(p.tasks.every(t=>t.owner===''),true);
});
test('HP車種追加済みでも商品反映は未完了であり、その他の工程を進めない', () => {
  const p=newProject({...values,categoryAdded:true},'C-903');
  assert.equal(p.tasks.find(t=>t.id==='hp-category')?.status,'done');
  assert.equal(p.tasks.find(t=>t.id==='hp-products')?.status,'todo');
  assert.equal(p.tasks.find(t=>t.id==='plan').status,'todo');
});
test('作業担当の交代は受領待ちを作り、案件責任者と他の作業を変えない', () => {
  const p=newProject({...values,owner:'担当A'},'C-904');
  const updated=applyTasks(p,{plan:{owner:'担当B',due:'2026-10-12'}});
  assert.equal(updated.tasks[0].handover?.status,'pending');
  assert.equal(updated.tasks[0].handover?.to,'担当B');
  assert.equal(updated.owner,'担当A');
  assert.equal(updated.tasks[1].owner,'担当A');
});
test('引継ぎ先を変えたら旧担当・旧依頼の受領操作を拒否する', () => {
  const p=newProject({...values,owner:'担当A'},'C-905');
  const draft={to:'担当B',due:'2026-10-12',context:'仕様と資料を確認'};
  const first=requestHandover(p,'plan',draft,'担当A');
  const oldId=first.tasks[0].handover.id;
  const second=requestHandover(first,'plan',{...draft,to:'担当A'},'担当B');
  assert.throws(()=>acceptHandover(second,'plan',oldId,'担当B'),/現在の受取担当/);
  assert.throws(()=>acceptHandover(second,'plan',second.tasks[0].handover.id,'担当B'),/現在の受取担当/);
  const received=acceptHandover(second,'plan',second.tasks[0].handover.id,'担当A');
  assert.equal(received.tasks[0].handover.status,'accepted');
  assert.equal(received.tasks[0].handoverHistory.length,1);
});
test('受領前の完了を拒否し、理由付き差し戻しは元の担当へ戻す', () => {
  const p=requestHandover(newProject({...values,owner:'担当A'},'C-906'),'plan',{to:'担当B',due:'2026-10-12',context:'資料確認'},'担当A');
  assert.throws(()=>applyTasks(p,{plan:{status:'done'}}),/受領/);
  assert.throws(()=>returnHandover(p,'plan',p.tasks[0].handover.id,'担当B',''),/理由/);
  const returned=returnHandover(p,'plan',p.tasks[0].handover.id,'担当B','仕様資料が不足');
  assert.equal(returned.tasks[0].owner,'担当A');
  assert.equal(returned.tasks[0].handover.reason,'仕様資料が不足');
});
test('完了後に担当を変えても過去の完了者と日時を保持する', () => {
  let p=newProject({...values,owner:'担当A'},'C-907');
  p=applyTasks(p,{plan:{status:'done'}},'2026-10-08','担当A');
  p=applyTasks(p,{plan:{owner:'担当B'}},'2026-10-09','担当B');
  assert.equal(p.tasks[0].completedBy,'担当A');
  assert.equal(p.tasks[0].completedAt,'2026-10-08');
});
const readyModern=()=>{
  const p=newProject({...values,owner:'担当A',sku:'CHECK-ONE'},'C-908');
  p.tasks=p.tasks.map(t=>({...t,status:'done',owner:'担当A',referenceUrl:t.id.startsWith('hp-')?'https://example.com/category/check':''}));
  p.fitment={year:'確認用',type:'確認用',seats:'5人',grade:'確認用',shape:'確認用',exclusions:'なし'};
  return p;
};
const release={date:'2026-10-08',confirmedBy:'担当A',reviewed:true,urls:{main:'https://example.com/main',rakuten:'https://example.com/rakuten',yahoo:'https://example.com/yahoo'},orderChecked:{main:true,rakuten:true,yahoo:true}};
test('全作業完了でもHPの公開URLがなければ発売を確定できない', () => {
  const p=readyModern();p.tasks.find(t=>t.id==='hp-category').referenceUrl='';
  assert.throws(()=>confirmLaunch(p,release),/公開URL/);
});
test('公開URLだけでは発売できず、各対象販売先の注文可能確認が必要', () => {
  assert.throws(()=>confirmLaunch(readyModern(),{...release,orderChecked:{}}),/注文可能/);
  assert.throws(()=>confirmLaunch(readyModern(),{...release,urls:{...release.urls,main:'javascript:alert(1)'}}),/公開商品URL/);
  const p=confirmLaunch(readyModern(),release);
  assert.equal(p.launch.urls.main,release.urls.main);
  assert.equal(p.launch.orderChecked.main,true);
});
test('対象車種を変えたらHPの完了実績を新しい対象へ転用しない', () => {
  const p=readyModern();
  const changed=applyCaseSettings(p,{...p,registrationType:'existing',baseVehicleId:'C-001',generation:'別世代',categoryAdded:false,categoryUrl:''},'担当A');
  assert.equal(changed.tasks.some(t=>t.id==='hp-category'),false);
  assert.equal(changed.tasks.find(t=>t.id==='hp-products').status,'todo');
  assert.equal(p.tasks.find(t=>t.id==='hp-products').status,'done');
});
test('販売先を対象外にする理由を記録し、必要な販売先だけを発売条件にする', () => {
  const p=readyModern();
  assert.throws(()=>applyCaseSettings(p,{...p,salesChannels:['main']},'担当A'),/対象外/);
  const changed=applyCaseSettings(p,{...p,salesChannels:['main'],channelExclusions:{rakuten:'後日展開',yahoo:'今回対象外'}},'担当A');
  assert.equal(changed.tasks.find(t=>t.id==='rakuten').required,false);
});

test('未割当を挟んでも古い引継ぎ依頼と同じIDを再利用しない',()=>{
  const p=requestHandover(newProject({...values,owner:'担当A'},'C-909'),'plan',{to:'担当B',due:'2026-10-12',context:'確認'},'担当A');
  const cleared=applyTasks(p,{plan:{owner:''}});
  const next=requestHandover(cleared,'plan',{to:'担当B',due:'2026-10-12',context:'再依頼'},'担当A');
  assert.notEqual(p.tasks[0].handover.id,next.tasks[0].handover.id);
  assert.throws(()=>acceptHandover(next,'plan',p.tasks[0].handover.id,'担当B'),/現在の受取担当/);
});

test('HP追加済みの取消とURL削除は発売の再確認対象になる',()=>{
  const p=confirmLaunch(readyModern(),release);
  const changed=applyCaseSettings(p,{...p,categoryAdded:false,categoryUrl:''},'担当A');
  assert.equal(changed.tasks.find(t=>t.id==='hp-category').status,'todo');
  assert.equal(changed.tasks.find(t=>t.id==='hp-products').referenceUrl,'');
  assert.equal(changed.launch.status,'needs-review');
});

test('作業をすべて完了しても案件責任者未割当では販売開始にしない',()=>{
  const p=readyModern();p.owner='';
  assert.throws(()=>confirmLaunch(p,release),/案件責任者/);
});
