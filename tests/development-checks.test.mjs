import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject, makeTasks } from '../src/sample-data.mjs';
import { stageOf, applyTasks } from '../src/workflow.mjs';
import { collectTopics } from '../src/topics.mjs';

const values = { manufacturer: 'トヨタ', car: '確認用車種', owner: '担当A', sku: '', channel: '中国開発', brand: 'Refinad', due: '2026-10-12' };

test('購入ルートでは現車手配ではなく他社製品の購入・受取を進める', () => {
  const project = newProject({ ...values, developmentMethod: 'purchase', purchaseSource: '確認用購入先', purchaseProduct: '確認用商品' }, 'C-900');
  assert.equal(project.tasks.find(task => task.id === 'arrange').name, '他社製品の購入・受取');
  assert.equal(project.purchaseSource, '確認用購入先');
});
test('方法がない旧データは自社型取りの手配作業を維持する', () => {
  const project = newProject(values, 'C-901');
  assert.equal(project.developmentMethod, 'own');
  assert.equal(project.tasks.find(task => task.id === 'arrange').name, '現車・仕様の確認');
});
test('販売準備の分母は親と子3件を含む8件になる', () => {
  assert.equal(makeTasks(4).filter(task => task.stage === 4 && task.required).length, 8);
});
test('旧5件が完了でも追加の子チェックが残ると販売準備から進めない', () => {
  const project = { ...newProject(values, 'C-902'), tasks: makeTasks(5) };
  const reset = applyTasks(project, { 'csv-master': { status: 'todo' } });
  assert.equal(stageOf(reset), 4);
  assert.equal(reset.tasks.find(task => task.id === 'sku').status, 'done');
});
test('販売開始後の生産確認と13week削除は販売開始を妨げない', () => {
  const project = { ...newProject(values, 'C-903'), tasks: makeTasks(5), launch: { status: 'confirmed', date: '2026-10-06' } };
  assert.equal(project.afterLaunchTasks?.length, 2);
  assert.equal(project.afterLaunchTasks.find(task => task.id === 'leadtime-remove').status, 'todo');
  assert.equal(stageOf(project), 5);
});
test('生産完了後に13week削除待ちを知らせ、削除完了でそのお知らせが消える', () => {
  const project = { ...newProject(values, 'C-904'), tasks: makeTasks(5), launch: { status: 'confirmed', date: '2026-10-06' }, afterLaunchTasks: [
    { id: 'production-complete', name: '注文分の生産完了を確認', status: 'done', owner: '担当A', completedAt: '2026-10-08' },
    { id: 'leadtime-remove', name: '納期返信アプリの13week登録を削除', status: 'todo', owner: '担当A', completedAt: '' },
  ] };
  assert.equal(collectTopics([project]).some(topic => topic.kind === 'followup'), true);
  const removed = { ...project, afterLaunchTasks: project.afterLaunchTasks.map(task => ({ ...task, status: 'done' })) };
  assert.equal(collectTopics([removed]).some(topic => topic.kind === 'followup'), false);
});
test('販売後の期限超過もトピックスに表示する', () => {
  const project = { ...newProject({ car: '確認車種', owner: '担当A' }, 'C-991'), tasks: makeTasks(5), launch: { status: 'confirmed', date: '2026-10-06' } };
  project.afterLaunchTasks[0].due = '2026-10-07';
  assert.equal(collectTopics([project]).some(topic => topic.kind === 'overdue' && topic.message.includes('生産完了')), true);
});
