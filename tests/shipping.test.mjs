import test from 'node:test';
import assert from 'node:assert/strict';
import { shipmentRows,applyShipment } from '../src/shipping.mjs';
const p={id:'C-970',car:'確認車種',manufacturer:'ホンダ',owner:'担当A',developmentMethod:'purchase',shipments:[],history:[]};
const draft={id:'S-1',owner:'担当B',status:'transit',trackingNumber:'1234-5678-9012',sentAt:'2026-10-08',receivedAt:'',destination:'中国工場',contents:'型取り用カバー',memo:'',deliveryUpdate:'中国へ輸送中',checkNow:true};
test('購入型取りの発送未登録も独立した発送一覧に表示する',()=>{
  assert.equal(shipmentRows([p])[0].status,'unregistered');
});
test('送り状番号で全案件を探し、担当と輸送中を絞り込む',()=>{
  const updated=applyShipment(p,draft,'担当A','2026-10-09T06:00:00Z');
  const rows=shipmentRows([updated],{query:'１２３４５６７８９０１２',status:'transit',owner:'担当B'});
  assert.equal(rows.length,1);
  assert.equal(rows[0].shipment.checkedBy,'担当A');
  assert.equal(rows[0].shipment.checkedAt,'2026-10-09T06:00:00Z');
});
test('中国到着と工場の受取を別に記録する',()=>{
  const arrived=applyShipment(p,{...draft,status:'received',receivedAt:'2026-10-09'},'担当A');
  assert.equal(arrived.shipments[0].factoryReceivedAt,'');
  assert.throws(()=>applyShipment(p,{...draft,factoryReceivedAt:'2026-10-09',factoryReceiver:'窓口担当'},'担当A'),/中国到着/);
  assert.throws(()=>applyShipment(arrived,{...arrived.shipments[0],factoryReceivedAt:'2026-10-07',factoryReceiver:'窓口担当'},'担当A'),/受取日/);
});
test('追跡確認では確認内容と担当を記録し、前回の確認履歴を保持する',()=>{
  assert.throws(()=>applyShipment(p,{...draft,deliveryUpdate:''},'担当A'),/追跡で確認/);
  const first=applyShipment(p,draft,'担当A','2026-10-09T06:00:00Z');
  const second=applyShipment(first,{...draft,status:'customs',deliveryUpdate:'通関中'},'担当B','2026-10-09T08:00:00Z');
  assert.equal(second.shipments[0].trackingHistory.length,2);
  assert.equal(second.shipments[0].trackingHistory[0].checkedBy,'担当A');
  assert.equal(first.shipments[0].status,'transit');
});
test('発送管理の更新では開発作業の完了・発売状態を変更しない',()=>{
  const project={...p,tasks:[{id:'sample',status:'todo'}],launch:{status:'pending'}};
  const next=applyShipment(project,draft,'担当B');
  assert.deepEqual(next.tasks,project.tasks);
  assert.deepEqual(next.launch,project.launch);
});

test('海外側のUPS番号を別に記録して検索でき、不正文字は拒否する',()=>{
  const next=applyShipment(p,{...draft,upsNumber:'１ｚ９９９ＡＡ１０１２３４５６７８４'},'担当A');
  assert.equal(next.shipments[0].upsNumber,'1Z999AA10123456784');
  assert.equal(shipmentRows([next],{query:'1z999aa'}).length,1);
  assert.throws(()=>applyShipment(p,{...draft,upsNumber:'<script>'},'担当A'),/英数字/);
});
