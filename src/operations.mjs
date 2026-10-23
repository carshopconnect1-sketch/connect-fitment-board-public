export const DEVELOPMENT_METHODS = [
  { id: 'purchase', label: '他社製品購入（型取り）', description: '購入する製品と購入元を記録します。' },
  { id: 'own', label: '自社型取り', description: '現車・型取りの手配から進めます。' },
];
export const methodLabel = method => DEVELOPMENT_METHODS.find(item => item.id === method)?.label || '未確認';
export const salesTasks = project => project.tasks.filter(task => task.stage === 4 && task.required);
export function makeAfterLaunchTasks(owner) {
  return [
    { id: 'production-complete', name: '注文分の生産完了を確認', description: '注文分の生産が完了したことを確認し、納期返信を外せる状態にします。' },
    { id: 'leadtime-remove', name: '納期返信アプリの13week登録を削除', description: '生産完了後にネクストエンジンの登録を削除し、削除したことを記録します。' },
  ].map(task => ({ ...task, owner, status: 'todo', due: '', completedAt: '', note: '' }));
}

export const INTERNATIONAL_TRACKING_URL = 'https://toi.kuronekoyamato.co.jp/cgi-bin/tneko';
export const UPS_TRACKING_URL = 'https://www.ups.com/track?loc=ja_JP&requester=ST%2F';
export const SHIPMENT_STATUSES = { preparing: '発送準備', sent: '発送済み', transit:'輸送中', customs:'通関中', issue:'要対応', received: '中国到着' };
export function normalizeTrackingNumber(value) {
  return String(value || '').normalize('NFKC').replace(/[\s-]/g, '');
}
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateShipment(shipment) {
  if (!Object.hasOwn(SHIPMENT_STATUSES, shipment.status)) return '配送の記録状態を選択してください。';
  const number = normalizeTrackingNumber(shipment.trackingNumber);
  if (number && (!/^\d{11,12}$/.test(number) || /^0+$/.test(number))) return '送り状番号は11桁または12桁の数字で入力してください。';
  if (shipment.status !== 'preparing' && !number) return '発送済み・到着済みには送り状番号が必要です。';
  if (shipment.status !== 'preparing' && !shipment.sentAt) return '発送日を入力してください。';
  if (shipment.status === 'received' && !shipment.receivedAt) return '到着日を入力してください。';
  if ([shipment.sentAt, shipment.receivedAt].some(date => date && !validDate(date))) return '存在する日付を入力してください。';
  if (shipment.receivedAt && !shipment.sentAt) return '到着日を記録する場合は発送日も入力してください。';
  if (shipment.receivedAt && shipment.receivedAt < shipment.sentAt) return '到着日は発送日以降にしてください。';
  return '';
}
export function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
export function applyAfterLaunch(project, patches, today = TODAY) {
  if (stageOf(project) !== 5) throw new Error('販売開始後に確認できます。');
  const updated = (project.afterLaunchTasks || makeAfterLaunchTasks(project.owner)).map(task => {
    const next = { ...task, ...patches[task.id] };
    if (next.referenceUrl && !safeExternalUrl(next.referenceUrl)) throw new Error('作業先URLは認証情報を含まないhttpsのURLを入力してください。');
    next.completedAt = next.status === 'done' ? task.completedAt || today : '';
    return next;
  });
  if (updated.find(task => task.id === 'leadtime-remove')?.status === 'done' && updated.find(task => task.id === 'production-complete')?.status !== 'done') {
    throw new Error('先に注文分の生産完了を確認してください。削除を戻す場合は、削除の完了も解除してください。');
  }
  return { ...project, afterLaunchTasks: updated };
}
import { TODAY, stageOf } from './workflow.mjs';
