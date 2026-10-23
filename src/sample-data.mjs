import {isProduct,productFields} from './products.mjs';
import {makeDetailedTasks} from './work-flow.mjs';
import { TODAY } from './workflow.mjs';
import { makeAfterLaunchTasks } from './operations.mjs';
import { appendCaseTasks } from './case-workflow.mjs';

export function makeTasks(stage = 0, owner = '担当A', due = '2026-10-12', waiting = false, developmentMethod = 'own') {
  const tasks = [
    ['plan', 0, '開発仕様の検討', '対象グレードと開発する商品の仕様を整理してください。'],
    ['arrange', 1, '現車・仕様の確認', '現車の手配と車両仕様を確認してください。'],
    ['sample', 2, '型取り・試作', '型取りを行い、試作品を準備してください。'],
    ['fitting', 3, '装着確認', '実車で確認した適合可否の結果を登録してください。'],
    ['fitment', 3, '適合情報の確定', '年式・型式・定員・グレード・注意事項を確定してください。'],
    ['sku', 4, '品番・注文書の登録', '販売品番と注文書への登録を確認してください。'],
    ['vehicle-setup', 4, '適合表DBの車種設定', 'メーカー・車種一覧に表示されることを確認します。登録済みの車種は確認のみで完了です。'],
    ['leadtime-register', 4, '納期返信アプリに13weekを登録', 'ネクストエンジン ＞ 設定 ＞ アプリ ＞ 納期返信アプリで品番と13weekを登録します。'],
    ['csv-master', 4, 'CSVコード変換マスターに登録', 'SharePoint ＞ 受注管理 ＞ ツールの最新版で、N列に自社品番、O列に変換先を登録し、変換結果を確認します。'],
    ['table', 4, '適合表への反映', '確定した適合情報を販売用の適合表に反映してください。'],
    ['main', 4, '本店の商品ページ', '本店の商品ページと選択肢を確認してください。'],
    ['rakuten', 4, '楽天の商品ページ', '楽天の商品ページと選択肢を確認してください。'],
    ['yahoo', 4, 'Yahooの商品ページ', 'Yahooの商品ページと選択肢を確認してください。'],
  ];
  return tasks.map(([id, taskStage, name, description]) => ({
    id, stage: taskStage, name: id === 'arrange' && developmentMethod === 'purchase' ? '他社製品の購入・受取' : name,
    description: id === 'arrange' && developmentMethod === 'purchase' ? '型取り用の他社製品を購入し、対象仕様と受け取りを確認してください。' : description,
    owner, required: true, parentId: ['vehicle-setup', 'leadtime-register', 'csv-master'].includes(id) ? 'sku' : '', note: '', referenceUrl: '',
    status: taskStage < stage ? 'done' : 'todo',
    due: taskStage === stage && id !== 'fitment' ? due : '',
    completedAt: taskStage < stage ? (taskStage < 2 ? '2026-10-02' : '2026-10-06') : '',
  })).map((task, index, list) => ({ ...task, status: waiting && index === list.findIndex(t => t.stage === stage) ? 'waiting' : task.status }));
}

export function newProject(values, id, demoActor = '') {
  if(isProduct(values))values={...productFields(values),flowVersion:2,sku:productFields(values).productSku};
  const developmentMethod = values.developmentMethod || 'own';
  // Only the public demo supplies demoActor; real registrations keep unset owners.
  const owner=values.owner||demoActor||'';
  return {
    ...values, id, owner, developmentMethod, fakeSku: values.fakeSku || '', purchaseSource: values.purchaseSource || '', purchaseProduct: values.purchaseProduct || '',
    updatedAt: new Date().toISOString(), hold: false, tasks: values.flowVersion===2?makeDetailedTasks({...values,owner,developmentMethod}):appendCaseTasks(makeTasks(0,owner,values.due,false,developmentMethod),values),
    afterLaunchTasks: isProduct(values)?[]:makeAfterLaunchTasks(owner), shipments: [], launch: { status: 'pending', date: '', confirmedBy: '', confirmedAt: '', note: '' },
    fitment: { year: '', type: '', seats: '', grade: '', shape: '', exclusions: '' },
    notes: [], history: [{ date: TODAY, actor: values.createdBy||'担当A', text: '案件を追加しました。' }],
  };
}

const definitions = [
  ['C-001', 'トヨタ', 'Toyota', 'シエンタ', 'SC-1023', 0, '担当B', '2026-10-12', false, '清水さん開発'],
  ['C-002', 'スズキ', 'Suzuki', 'フロンクス', '', 0, '担当A', '2026-10-06', false, '中国開発'],
  ['C-003', '日産', 'Nissan', 'セレナ', 'NS-1023', 1, '担当B', '2026-10-09', true, '山科開発'],
  ['C-004', 'ホンダ', 'Honda', 'Super-ONE', '', 1, '担当A', '2026-10-12', false, '清水さん開発'],
  ['C-005', 'トヨタ', 'Toyota', 'シエンタ', 'SC-1024', 2, '担当A', '2026-10-12', false, 'テックスメディア'],
  ['C-006', 'スズキ', 'Suzuki', 'フロンクス', 'SC-1191', 2, '担当B', '2026-10-09', true, '中国開発'],
  ['C-007', 'ホンダ', 'Honda', 'Super-ONE', '', 3, '担当A', '2026-10-09', true, '清水さん開発'],
  ['C-008', '日産', 'Nissan', 'セレナ', 'SC-1181', 3, '担当B', '2026-10-12', false, '山科開発'],
  ['C-009', '日産', 'Nissan', 'リーフ', 'N0106-05', 4, '担当A', '2026-10-12', false, 'テックスメディア'],
  ['C-010', 'トヨタ', 'Toyota', 'カローラ', 'T-0112', 4, '担当B', '2026-10-09', true, '中国開発'],
  ['C-011', 'トヨタ', 'Toyota', 'プロボックス', 'T-0105', 5, '担当B', '', false, '清水さん開発'],
  ['C-012', 'ホンダ', 'Honda', 'ヴェゼル', 'H-0128', 5, '担当A', '', false, '山科開発'],
];

export const SAMPLE_PROJECTS = definitions.map(([id, manufacturer, make, car, sku, stage, owner, due, waiting, channel], index) => {
  const developmentMethod = channel === '中国開発' ? 'purchase' : 'own';
  const registrationType=car==='Super-ONE'||car==='フロンクス'?'new':'existing';
  const categoryUrl=stage===5?`https://example.com/demo/category/${id}`:'';
  const values={registrationType,baseVehicleId:registrationType==='existing'?definitions.find(d=>d[3]===car)[0]:'',generation:'確認用の世代（サンプル）',categoryUrl,categoryAdded:car==='Super-ONE',salesChannels:['main','rakuten','yahoo'],hpOwner:car==='Super-ONE'?'':owner};
  const project = newProject({ ...values, manufacturer, make, car, sku, owner, due, channel, developmentMethod, brand: index % 3 === 2 ? 'Sandii' : 'Refinad' }, id);
  project.tasks = appendCaseTasks(makeTasks(stage, owner, due, waiting, developmentMethod), values);
  if(stage===5) project.tasks=project.tasks.map(t=>({...t,status:'done',completedBy:owner,completedAt:t.completedAt||'2026-10-06'}));
  if(car==='Super-ONE') project.tasks.find(t=>t.id==='hp-category').note='HPへの新規車種追加済み（ユーザーからの申告）。URL・作業者・日時は未確認。その他の進捗はサンプルです。';
  if (id === 'C-011') project.afterLaunchTasks[0] = { ...project.afterLaunchTasks[0], status: 'done', completedAt: '2026-10-08' };
  if (['C-006','C-010'].includes(id)) project.shipments=[{id:`sample-${id}`,destination:'中国工場（サンプル）',contents:'型取り用の他社シートカバー（サンプル）',trackingNumber:id==='C-006'?'123456789012':'234567890123',status:id==='C-006'?'transit':'sent',owner,sentAt:'2026-10-07',receivedAt:'',factoryReceivedAt:'',factoryReceiver:'',deliveryUpdate:id==='C-006'?'中国へ輸送中（表示確認用の架空記録）':'',checkedAt:id==='C-006'?'2026-10-09T00:00:00Z':'',checkedBy:id==='C-006'?owner:'',trackingHistory:[],memo:'サンプルの送り状番号。実際の荷物情報ではありません。'}];
  // Explicit demo timestamps; these are not imported operational events.
  project.updatedAt = `2026-10-${stage === 5 ? '06' : '08'}T${String(9 + index % 7).padStart(2, '0')}:30:00+09:00`;
  project.history = [{ date: '2026-10-02', actor: owner, text: '案件の開発を開始しました。' }];
  if (stage >= 3) project.history.push({ date: '2026-10-06', actor: owner, text: '型取り・試作を完了しました。' });
  if (stage >= 4) project.fitment = { year: '2026年〜（サンプル）', type: '確認用型式', seats: '5人', grade: '確認用グレード', shape: '標準仕様', exclusions: '実データ取り込み時に再確認' };
  if (stage === 5) project.launch = { status: 'confirmed', date: '2026-10-06', confirmedBy: owner, confirmedAt: '2026-10-06T03:30:00Z', note: '確認用サンプルの発売記録',urls:Object.fromEntries(values.salesChannels.map(x=>[x,`https://example.com/demo/${id}/${x}`])),orderChecked:Object.fromEntries(values.salesChannels.map(x=>[x,true])) };
  if (id === 'C-007') {
    project.notes = [
      { date: '2026-10-06', text: '試作品のフィッティングは良好。\n干渉部を微調整し、再確認後に結果を登録します。' },
      { date: TODAY, text: '現車での最終確認を予定。' },
    ];
    project.history.push({ date: TODAY, actor: owner, text: '装着確認を「確認待ち」にしました。' });
  }
  return project;
});
