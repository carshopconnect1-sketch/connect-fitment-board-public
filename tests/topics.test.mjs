import test from 'node:test';
import assert from 'node:assert/strict';
import { collectTopics, featuredTopics } from '../src/topics.mjs';
import { makeTasks } from '../src/sample-data.mjs';
import { applyTasks } from '../src/workflow.mjs';
import { newProject } from '../src/sample-data.mjs';
import { requestHandover,acceptHandover } from '../src/case-workflow.mjs';

const caseOf = (tasks, extra = {}) => ({ id: 'C-999', car: '確認車種', manufacturer: 'トヨタ', sku: '', owner: '担当A', tasks, history: [], ...extra });
test('期限超過は未完了の必要作業から拾い、完了すると消える', () => {
  const project = caseOf(makeTasks(0, '担当A', '2026-10-06'));
  assert.equal(collectTopics([project])[0].kind, 'overdue');
  const updated = applyTasks(project, { plan: { status: 'done' } });
  assert.equal(collectTopics([updated]).length, 0);
});
test('同じ案件の期限超過と確認待ちは重複せず、期限を優先する', () => {
  assert.deepEqual(collectTopics([caseOf(makeTasks(1, '担当A', '2026-10-06', true))]).map(t => t.kind), ['overdue']);
});
test('対象外と保留は対応のお知らせに含めない', () => {
  const tasks = makeTasks(1, '担当A', '2026-10-06', true).map(t => t.id === 'arrange' ? { ...t, required: false } : t);
  assert.equal(collectTopics([caseOf(tasks)]).length, 0);
  assert.equal(collectTopics([caseOf(makeTasks(1, '担当A', '2026-10-06', true), { hold: true })]).length, 0);
});
test('販売開始は直近7日間の確定した発売日がある案件だけを拾う', () => {
  const launched = caseOf(makeTasks(5), { launch: { status: 'confirmed', date: '2026-10-06' } });
  assert.equal(collectTopics([launched])[0].kind, 'launch');
  assert.equal(collectTopics([launched], '2026-10-20').length, 0);
  assert.equal(collectTopics([caseOf(makeTasks(5))]).some(topic => topic.kind === 'launch'), false);
  assert.equal(collectTopics([{ ...launched, launch: { status: 'confirmed', date: '' } }]).length, 0);
  assert.equal(collectTopics([{ ...launched, launch: { status: 'confirmed', date: '2026-10-09' } }]).length, 0);
});
test('進捗更新は記録済みの工程と現在の工程が一致するときだけ拾う', () => {
  const project = caseOf(makeTasks(2), { history: [{ kind: 'stage', stage: 2, date: '2026-10-08' }] });
  assert.equal(collectTopics([project])[0].kind, 'progress');
  assert.equal(collectTopics([{ ...project, tasks: makeTasks(3) }]).length, 0);
});
test('先頭の表示は期限・確認待ち・販売開始から1件ずつ選ぶ', () => {
  const items = [{ kind: 'overdue', id: 'a' }, { kind: 'overdue', id: 'b' }, { kind: 'waiting', id: 'c' }, { kind: 'launch', id: 'd' }];
  assert.deepEqual(featuredTopics(items).map(t => t.id), ['a', 'c', 'd']);
});

test('お知らせの確認済みとは別に引継ぎ受領待ちを抽出し、受領で消す',()=>{
  const p=requestHandover(newProject({registrationType:'new',owner:'担当A'},'C-950'),'plan',{to:'担当B',due:'2026-10-12',context:'仕様確認'},'担当A');
  const topic=collectTopics([p]).find(t=>t.kind==='handover');
  assert.match(topic.message,/担当Bの受領待ち/);
  const accepted=acceptHandover(p,'plan',p.tasks[0].handover.id,'担当B');
  assert.equal(collectTopics([accepted]).some(t=>t.kind==='handover'),false);
});

test('引継ぎ内容の更新は確認済みの古いお知らせIDを再利用しない',()=>{
  const draft={to:'担当B',due:'2026-10-12',context:'仕様確認'};
  const p=requestHandover(newProject({registrationType:'existing',baseVehicleId:'C-001',owner:'担当A'},'C-951'),'plan',draft,'担当A');
  const changed=requestHandover(p,'plan',{...draft,context:'改訂資料確認'},'担当A');
  assert.notEqual(collectTopics([p])[0].id,collectTopics([changed])[0].id);
});
