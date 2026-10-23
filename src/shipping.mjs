import { normalizeSearch } from './workflow.mjs';
import { normalizeTrackingNumber,validateShipment,SHIPMENT_STATUSES } from './operations.mjs';

export function shipmentRows(projects,filters={}) {
  return projects.flatMap(project=>{
    const shipments=project.shipments||[];
    if (!shipments.length&&project.developmentMethod!=='purchase') return [];
    return (shipments.length?shipments:[null]).map(shipment=>({project,shipment,status:shipment?.status||'unregistered',owner:shipment?.owner||'',key:`${project.id}:${shipment?.id||'unregistered'}`}));
  }).filter(row=>{
    const text=normalizeSearch([row.project.manufacturer,row.project.car,row.project.sku,row.project.fakeSku,row.project.id,row.shipment?.trackingNumber,row.shipment?.upsNumber,row.shipment?.contents].join(' '));
    return (!filters.query||text.includes(normalizeSearch(filters.query)))&&(!filters.status||filters.status===row.status)&&(!filters.owner||row.owner===filters.owner);
  });
}

export function applyShipment(project,draft,actor,now=new Date().toISOString()) {
  const message=validateShipment(draft);
  if(message) throw new Error(message);
  const upsNumber=(draft.upsNumber||'').normalize('NFKC').replace(/\s/g,'').toUpperCase();
  if(upsNumber&&!/^[A-Z0-9]{1,40}$/.test(upsNumber)) throw new Error('UPS追跡番号は英数字で入力してください。');
  if(draft.status!=='preparing'&&!draft.owner) throw new Error('配送確認の担当を設定してください。');
  const factoryReceivedAt=draft.factoryReceivedAt||'';
  if(factoryReceivedAt&&(draft.status!=='received'||!draft.receivedAt)) throw new Error('中国到着を記録してから工場の受取を記録してください。');
  if(factoryReceivedAt&&(!/^\d{4}-\d{2}-\d{2}$/.test(factoryReceivedAt)||!Number.isFinite(Date.parse(factoryReceivedAt))||new Date(factoryReceivedAt).toISOString().slice(0,10)!==factoryReceivedAt||factoryReceivedAt<draft.receivedAt)) throw new Error('工場の受取日は中国到着日以降の有効な日付で記録してください。');
  if(factoryReceivedAt&&!draft.factoryReceiver?.trim()) throw new Error('工場の受取確認者を記録してください。');
  if(draft.checkNow&&!draft.deliveryUpdate?.trim()) throw new Error('追跡で確認した状況を記録してください。');
  const previous=(project.shipments||[]).find(s=>s.id===draft.id);
  const id=draft.id||crypto.randomUUID();
  const {checkNow,trackingHistory,...values}=draft;
  const recorded={...values,id,trackingNumber:normalizeTrackingNumber(draft.trackingNumber),destination:(draft.destination||'中国工場').trim(),contents:(draft.contents||'').trim(),memo:(draft.memo||'').trim(),factoryReceivedAt,factoryReceiver:factoryReceivedAt?draft.factoryReceiver.trim():'',checkedAt:previous?.checkedAt||'',checkedBy:previous?.checkedBy||'',trackingHistory:previous?.trackingHistory||[],updatedAt:now};
  if(checkNow){recorded.checkedAt=now;recorded.checkedBy=actor;recorded.trackingHistory=[...recorded.trackingHistory,{status:recorded.status,deliveryUpdate:recorded.deliveryUpdate,checkedAt:now,checkedBy:actor}];}
  recorded.upsNumber=upsNumber;
  return {...project,shipments:previous?project.shipments.map(s=>s.id===id?recorded:s):[...(project.shipments||[]),recorded],history:[...(project.history||[]),{date:now.slice(0,10),recordedAt:now,actor,text:`中国への発送：${SHIPMENT_STATUSES[recorded.status]}。${checkNow?'追跡確認を記録。':''}${recorded.contents}。工場受取 ${recorded.factoryReceivedAt?recorded.factoryReceivedAt+' · '+recorded.factoryReceiver:'未確認'}`} ]};
}
