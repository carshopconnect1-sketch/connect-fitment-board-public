import test from 'node:test';
import assert from 'node:assert/strict';
import * as operations from '../src/operations.mjs';
import { newProject, makeTasks } from '../src/sample-data.mjs';
import { stageOf } from '../src/workflow.mjs';

const launched = () => ({ ...newProject({ car: '確認車種', owner: '担当A' }, 'C-990'), tasks: makeTasks(5), launch: { status: 'confirmed', date: '2026-10-06' } });
test('販売後の確認にも認証情報を含む作業先URLは保存できない', () => {
  assert.throws(() => operations.applyAfterLaunch(launched(), { 'production-complete': { referenceUrl: 'https://user:password@example.test' } }), /URL/);
});
test('生産完了前に納期返信の削除を完了できない', () => {
  assert.throws(() => operations.applyAfterLaunch(launched(), { 'leadtime-remove': { status: 'done' } }), /生産完了/);
});
test('生産確認と削除を記録しても販売開始工程を維持し、担当と日付を残す', () => {
  const project = launched();
  const updated = operations.applyAfterLaunch(project, { 'production-complete': { status: 'done' }, 'leadtime-remove': { status: 'done', owner: '担当B' } }, '2026-10-08');
  assert.equal(stageOf(updated), 5);
  assert.equal(updated.afterLaunchTasks[1].completedAt, '2026-10-08');
  assert.equal(updated.afterLaunchTasks[1].owner, '担当B');
  assert.equal(project.afterLaunchTasks[1].status, 'todo');
});
test('削除完了を残したまま生産確認だけを戻すことはできない', () => {
  const done = operations.applyAfterLaunch(launched(), { 'production-complete': { status: 'done' }, 'leadtime-remove': { status: 'done' } });
  assert.throws(() => operations.applyAfterLaunch(done, { 'production-complete': { status: 'todo' } }), /生産完了/);
});
test('販売準備が残る間は販売開始後の確認を完了できない', () => {
  const project = { ...launched(), tasks: makeTasks(4) };
  assert.throws(() => operations.applyAfterLaunch(project, { 'production-complete': { status: 'done' } }), /販売開始/);
});
test('全角数字・空白・ハイフンの送り状番号を数字だけに整える', () => {
  assert.equal(operations.normalizeTrackingNumber('１２３４－５６７８－９０１２ '), '123456789012');
});
test('準備中は番号未発行を記録でき、発送済みには番号と発送日が必要', () => {
  assert.equal(operations.validateShipment({ status: 'preparing', trackingNumber: '', sentAt: '', receivedAt: '' }), '');
  assert.match(operations.validateShipment({ status: 'sent', trackingNumber: '', sentAt: '2026-10-08' }), /送り状/);
  assert.match(operations.validateShipment({ status: 'sent', trackingNumber: '123456789012', sentAt: '' }), /発送日/);
});
test('不正文字や桁数を番号として受け付けず、11/12桁を受け付ける', () => {
  for (const trackingNumber of ['12345678', '1234x56789012', '1234567890123']) assert.match(operations.validateShipment({ status: 'preparing', trackingNumber }), /11桁または12桁/);
  for (const trackingNumber of ['12345678901', '1234-5678-9012']) assert.equal(operations.validateShipment({ status: 'preparing', trackingNumber }), '');
});
test('到着日なし・発送より前の到着・存在しない日付を拒否する', () => {
  const shipment = { status: 'received', trackingNumber: '123456789012', sentAt: '2026-10-08', receivedAt: '' };
  assert.match(operations.validateShipment(shipment), /到着日/);
  assert.match(operations.validateShipment({ ...shipment, receivedAt: '2026-10-07' }), /発送日/);
  assert.match(operations.validateShipment({ ...shipment, sentAt: '2026-02-30', receivedAt: '2026-03-02' }), /日付/);
});
test('任意の作業先リンクにjavascriptや認証情報入りURLを使わせない', () => {
  assert.equal(operations.safeExternalUrl('javascript:alert(1)'), '');
  assert.equal(operations.safeExternalUrl('https://name:secret@example.com/'), '');
  assert.equal(operations.safeExternalUrl('https://example.com/app'), 'https://example.com/app');
});
