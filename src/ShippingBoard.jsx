import React,{useState} from 'react';
import { SHIPMENT_STATUSES,UPS_TRACKING_URL,INTERNATIONAL_TRACKING_URL } from './operations.mjs';
import { shipmentRows } from './shipping.mjs';
import { OWNERS } from './workflow.mjs';
import { ownerLabel } from './case-workflow.mjs';
import { topicDateTime } from './topics.mjs';
import './shipping.css';

const STATES={unregistered:'発送未登録',...SHIPMENT_STATUSES};
export function ShippingBoard({projects,query,onEdit,onSelect}) {
  const [status,setStatus]=useState(''),[owner,setOwner]=useState(''),[caseId,setCaseId]=useState(''),[message,setMessage]=useState('');
  const all=shipmentRows(projects,{query});
  const rows=shipmentRows(projects,{query,status,owner});
  const copy=async number=>{try{await navigator.clipboard.writeText(number);setMessage('送り状番号をコピーしました。ヤマト公式に貼り付けて確認してください。');}catch{setMessage('表示された送り状番号をコピーして確認してください。');}};
  return <section className="shipping-board" aria-label="中国への発送一覧">
    <div className="shipping-intro"><div><h2>中国への発送・到着を追う</h2><p>開発工程とは別に、荷物ごとの状況と工場の受取を管理します。</p><small>実際の荷物は社内画面で自動追跡・通知します。この一覧は操作確認用のサンプルです。</small></div><a className="primary compact" href="https://m-connect.co.jp/wp-admin/admin-post.php?action=connect_fitment_board&view=shipping" target="_blank" rel="noopener noreferrer">社内の自動追跡を開く ↗</a></div>
    <div className="shipping-states"><button aria-pressed={!status} onClick={()=>setStatus('')}>すべて <b>{all.length}</b></button>{Object.entries(STATES).map(([id,label])=><button className={id} aria-pressed={status===id} key={id} onClick={()=>setStatus(id)}>{label} <b>{all.filter(r=>r.status===id).length}</b></button>)}</div>
    <div className="shipping-toolbar"><label>配送確認の担当<select value={owner} onChange={e=>setOwner(e.target.value)}><option value="">すべて</option>{OWNERS.map(x=><option key={x}>{x}</option>)}</select></label><label className="shipping-case-select">発送を登録する案件<select value={caseId} onChange={e=>setCaseId(e.target.value)}><option value="">案件を選択</option>{projects.map(p=><option key={p.id} value={p.id}>{p.car} · {p.sku||'品番未定'} · {p.id}</option>)}</select></label><button className="primary compact" disabled={!caseId} onClick={()=>onEdit(caseId,null)}>＋ 発送を登録</button></div>
    <div className="table-wrap"><table><thead><tr><th>車種・送付するもの</th><th>状況・担当</th><th>送り状番号</th><th>発送・中国到着</th><th>追跡確認・工場受取</th><th>操作</th></tr></thead><tbody>{rows.map(({project:p,shipment:s,status:state,owner:person,key})=><tr key={key}><td><button className="case-link" onClick={()=>onSelect(p.id)}>{p.manufacturer} {p.car}</button><small>{s?.contents||'型取り用製品 · 発送の登録待ち'}</small><small>{p.sku||'品番未定'} · {p.id}</small></td><td><span className={`shipment-state ${state}`}>{STATES[state]}</span><small>配送確認 {ownerLabel(person)}</small>{s?.status==='issue'&&<small className="late">要対応：{s.deliveryUpdate||'状況を記録してください'}</small>}</td><td><strong className="shipping-number">{s?.trackingNumber||'未発行'}</strong>{s?.upsNumber&&<small>UPS {s.upsNumber}</small>}{s?.trackingNumber&&<button className="text-button" onClick={()=>copy(s.trackingNumber)}>番号をコピー</button>}</td><td><small>発送 {s?.sentAt||'未記録'}</small><small>中国到着 {s?.receivedAt||'未記録'}</small></td><td>{s?.deliveryUpdate||'追跡状況は未記録'}<small>最終確認 {s?.checkedAt?topicDateTime(s.checkedAt)+' · '+s.checkedBy:'未記録'}</small><small>工場受取 {s?.factoryReceivedAt?`${s.factoryReceivedAt} · ${s.factoryReceiver}`:'未確認'}</small></td><td><div className="shipping-row-actions">{s?.trackingNumber&&<a className="secondary compact" href={INTERNATIONAL_TRACKING_URL} target="_blank" rel="noopener noreferrer">ヤマトで追跡 ↗</a>}{s?.upsNumber&&<a className="secondary compact" href={UPS_TRACKING_URL} target="_blank" rel="noopener noreferrer">UPSで追跡 ↗</a>}<button className="primary compact" onClick={()=>onEdit(p.id,s)}>{s?'状況を更新':'発送を登録'}</button></div></td></tr>)}</tbody></table></div>{!rows.length&&<p className="shipping-empty">条件に合う発送はありません。上の案件選択から発送を登録できます。</p>}<p className="copy-feedback" role="status">{message}</p>
  </section>;
}
