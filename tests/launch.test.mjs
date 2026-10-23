import test from 'node:test';
import assert from 'node:assert/strict';
import * as launch from '../src/launch.mjs';
import { newProject, makeTasks } from '../src/sample-data.mjs';
import { stageOf, applyTasks, nextTask, filterProjects } from '../src/workflow.mjs';
import { collectTopics } from '../src/topics.mjs';
import { listLaunched, launchDate } from '../src/catalog.mjs';

const ready = () => ({ ...newProject({ manufacturer: 'トヨタ', car: 'シエンタ（確認用）', developmentMethod: 'purchase', owner: '担当A', sku: 'DEMO-SIENTA', brand: 'Refinad' }, 'C-900'), tasks: makeTasks(5), fitment: { year: '確認用年式', type: '確認用型式', seats: '確認用定員', grade: '確認用グレード', shape: '確認用形状', exclusions: '確認用・実車未確認' } });
const confirmation = { date: '2026-10-08', confirmedBy: '担当B', reviewed: true, note: '確認用の販売開始記録' };

test('発売確定待ちの案件も「確認待ち」の絞り込みに含める', () => {
  assert.equal(filterProjects([ready()], { quick: 'waiting' }).length, 1);
});

test('8項目を完了しても最終確定前は販売準備に残り、販売中・販売開始通知に出ない', () => {
  const project = ready();
  assert.equal(stageOf(project), 4);
  assert.equal(listLaunched([project]).length, 0);
  assert.equal(collectTopics([project]).some(topic => topic.kind === 'launch'), false);
  assert.equal(nextTask(project).id, 'launch');
});

test('準備完了を知らせ、明示確定後は実際の発売日と確認者を記録する', () => {
  assert.equal(typeof launch.confirmLaunch, 'function');
  const project = ready();
  assert.equal(collectTopics([project]).some(topic => topic.kind === 'ready'), true);
  const launched = launch.confirmLaunch(project, confirmation, '2026-10-08', '2026-10-08T03:00:00Z');
  assert.equal(stageOf(launched), 5);
  assert.equal(launched.launch.date, '2026-10-08');
  assert.equal(launched.launch.confirmedBy, '担当B');
  assert.equal(launched.launch.confirmedAt, '2026-10-08T03:00:00Z');
  assert.equal(launchDate(launched), '2026-10-08');
  assert.equal(listLaunched([launched]).length, 1);
  const topic = collectTopics([launched]).find(item => item.kind === 'launch');
  assert.equal(topic.date, '2026-10-08');
  assert.equal(topic.owner, '担当B');
  assert.equal(project.launch.status, 'pending');
});

test('販売準備7/8・品番未定・適合未入力・保留では発売を確定できない', () => {
  assert.equal(typeof launch.confirmLaunch, 'function');
  const project = ready();
  assert.throws(() => launch.confirmLaunch(applyTasks(project, { 'csv-master': { status: 'todo' } }), confirmation), /作業|準備/);
  assert.throws(() => launch.confirmLaunch({ ...project, sku: '' }, confirmation), /品番/);
  assert.throws(() => launch.confirmLaunch({ ...project, fitment: { ...project.fitment, type: '' } }, confirmation), /適合/);
  assert.throws(() => launch.confirmLaunch({ ...project, hold: true }, confirmation), /保留/);
});

test('未来日・存在しない日・確認者なし・最終確認なしでは確定できない', () => {
  assert.equal(typeof launch.confirmLaunch, 'function');
  for (const date of ['2026-10-09', '2026-02-30', '']) assert.throws(() => launch.confirmLaunch(ready(), { ...confirmation, date }), /発売日/);
  assert.throws(() => launch.confirmLaunch(ready(), { ...confirmation, confirmedBy: '' }), /確認者/);
  assert.throws(() => launch.confirmLaunch(ready(), { ...confirmation, reviewed: false }), /最終確認/);
});

test('完了を戻した案件は再度全完了にしても自動再発売されず、前の発売記録を残す', () => {
  assert.equal(typeof launch.confirmLaunch, 'function');
  const launched = launch.confirmLaunch(ready(), confirmation);
  const reopened = applyTasks(launched, { fitting: { status: 'waiting' } });
  assert.equal(stageOf(reopened), 3);
  assert.equal(reopened.launch.status, 'needs-review');
  assert.equal(reopened.launch.date, '2026-10-08');
  const completed = applyTasks(reopened, { fitting: { status: 'done' } });
  assert.equal(stageOf(completed), 4);
  assert.equal(listLaunched([completed]).length, 0);
  assert.equal(stageOf(launch.confirmLaunch(completed, confirmation)), 5);
});

test('期限・担当・メモだけの修正は発売確認を取り消さず、適合変更は再確認にする', () => {
  assert.equal(typeof launch.confirmLaunch, 'function');
  assert.equal(typeof launch.requireLaunchReview, 'function');
  const launched = launch.confirmLaunch(ready(), confirmation);
  assert.equal(stageOf(applyTasks(launched, { fitting: { owner: '担当B', note: '補足', due: '2026-10-08' } })), 5);
  const changed = launch.requireLaunchReview({ ...launched, fitment: { ...launched.fitment, exclusions: '変更した注意事項' } });
  assert.equal(stageOf(changed), 4);
  assert.equal(changed.launch.status, 'needs-review');
});

test('発売日は最後の作業完了日から推定せず、確定した実際の発売日で一覧を並べる', () => {
  assert.equal(typeof launch.confirmLaunch, 'function');
  const old = launch.confirmLaunch(ready(), { ...confirmation, date: '2026-10-07' });
  const recent = { ...launch.confirmLaunch(ready(), confirmation), id: 'C-901' };
  assert.deepEqual(listLaunched([old, recent]).map(project => project.id), ['C-901', 'C-900']);
  assert.equal(launchDate(old), '2026-10-07');
});
