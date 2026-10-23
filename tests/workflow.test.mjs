import test from 'node:test';
import assert from 'node:assert/strict';
import { stageOf, isOverdue, filterProjects, applyTasks, normalizeSearch } from '../src/workflow.mjs';

const project = { id: 'a', manufacturer: 'ホンダ', car: 'Super-ONE', sku: '', owner: '担当A', channel: '清水さん開発', brand: 'Refinad', tasks: [
  { id:'1', stage:0, status:'done', required:true, due:'2026-10-02' },
  { id:'2', stage:2, status:'done', required:true, due:'2026-10-06' },
  { id:'3', stage:3, status:'waiting', required:true, due:'2026-10-09' },
  { id:'4', stage:4, status:'todo', required:true, due:'' },
  { id:'5', stage:4, status:'todo', required:false, due:'2026-10-01' },
] };

test('確認待ちの適合確認が現在工程になる',()=>assert.equal(stageOf(project),3));
test('必要な販売準備が終わるまでは販売開始にならない',()=>{
  const fittingDone=applyTasks(project,{ '3':{status:'done'} },'2026-10-08');
  assert.equal(stageOf(fittingDone),4);
  const allDone=applyTasks(fittingDone,{ '4':{status:'done'} },'2026-10-08');
  assert.equal(stageOf(allDone),4);
  assert.equal(allDone.tasks[2].completedAt,'2026-10-08');
  assert.equal(allDone.tasks[4].status,'todo');
});
test('完了を戻すと工程も戻り、完了日を取り消す',()=>{
  const changed=applyTasks(project,{ '2':{status:'todo'} },'2026-10-08');
  assert.equal(stageOf(changed),2);
  assert.equal(changed.tasks[1].completedAt,'');
  assert.equal(project.tasks[1].status,'done');
});
test('過去日の対象外作業と完了作業は期限超過にしない',()=>{
  assert.equal(isOverdue(project,'2026-10-08'),false);
  assert.equal(isOverdue(applyTasks(project,{'3':{due:'2026-10-07'}},'2026-10-08'),'2026-10-08'),true);
  assert.equal(isOverdue(project,'2026-10-09'),false);
});
test('全角文字と大小文字を揃え、品番未定でも車種で探せる',()=>{
  assert.equal(normalizeSearch('Ｓｕｐｅｒ－ＯＮＥ'),'superone');
  assert.equal(filterProjects([project],{query:'ＳＵＰＥＲ ONE'},'2026-10-08').length,1);
  assert.equal(filterProjects([project],{query:'該当しない'},'2026-10-08').length,0);
  assert.equal(filterProjects([project],{query:''},'2026-10-08').length,1);
});
test('自分担当・確認待ち・開発先の複合条件を正しく扱う',()=>{
  assert.equal(filterProjects([project],{quick:'mine',channel:'清水さん開発'},'2026-10-08').length,1);
  assert.equal(filterProjects([project],{quick:'waiting'},'2026-10-08').length,1);
  assert.equal(filterProjects([project],{quick:'mine',channel:'中国開発'},'2026-10-08').length,0);
});
