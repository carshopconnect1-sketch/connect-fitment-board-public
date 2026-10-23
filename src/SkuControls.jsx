import {isProduct} from './products.mjs';
import React from 'react';
import { PlusIcon, PencilSimpleIcon } from './icons.jsx';

const ISSUANCE_HINT = '実際の品番は、社内の品番発行画面で発行・共有保存します。';
const ISSUANCE_URL = 'https://m-connect.co.jp/wp-admin/admin-post.php?action=connect_fitment_board&view=numbering';

export function SkuSummary({ project, onEdit, onIssue, canIssue = true, connected = false }) {
  if(isProduct(project))return <section className="sku-summary" aria-label="商品の販売品番"><div className="sku-summary-value"><span>販売品番</span><strong>{project.sku||'未登録'}</strong>{onEdit&&<button className="secondary compact" onClick={onEdit}>商品情報・品番を編集</button>}</div><small>商品品番は商品設定で登録します。</small></section>;
  return <section className="sku-summary" aria-label="自社・中国向けの品番">
    <div className="sku-summary-value"><span>自社品番</span><strong>{project.sku || '未発行'}</strong>{onEdit&&<button className="text-button compact" aria-label="品番を編集" onClick={onEdit}><PencilSimpleIcon size={13} />編集</button>}</div>
    <div className="sku-summary-value fake"><span>フェイク品番</span><strong>{project.fakeSku || '未発行'}</strong></div>
    {canIssue&&(!project.sku || !project.fakeSku) && <div className="sku-create-actions">{!project.sku && (onIssue?<button className="secondary compact" onClick={()=>onIssue('new')}><PlusIcon size={15}/>新品番を発行 →</button>:<a className="secondary compact" href={ISSUANCE_URL} target="_blank" rel="noopener noreferrer"><PlusIcon size={15} />新品番を発行 ↗</a>)}{!project.fakeSku && (onIssue?<button className="secondary compact" onClick={()=>onIssue('existing')}><PlusIcon size={15}/>フェイク品番を発行 →</button>:<a className="secondary compact" href={`${ISSUANCE_URL}&mode=existing`} target="_blank" rel="noopener noreferrer"><PlusIcon size={15} />フェイク品番を発行 ↗</a>)}</div>}
    <small>{connected?'自社品番は販売用、フェイク品番は中国工場への送付用です。':<>中国工場へ送る正式な品番です。<br />{ISSUANCE_HINT}</>}</small>
  </section>;
}

export function SkuFields({ draft, set }) {
  return <section className="sku-fields full" aria-label="自社・中国向けの品番を入力">
    {[['sku', '自社品番（販売用）', '新品番を発行'], ['fakeSku', 'フェイク品番（中国向け）', 'フェイク品番を発行']].map(([key, label, action]) => <div className="sku-field" key={key}><label htmlFor={`case-${key}`}>{label}</label><div className="sku-input-row"><input id={`case-${key}`} value={draft[key] || ''} placeholder={key === 'sku' ? '既存の自社品番を入力・未発行でも登録可' : '中国工場へ送る正式な品番を入力'} onChange={event => set(key, event.target.value)} /><a className="secondary compact" href={`${ISSUANCE_URL}${key === 'fakeSku' ? '&mode=existing' : ''}`} target="_blank" rel="noopener noreferrer"><PlusIcon size={15} />{action} ↗</a></div></div>)}
    <p className="sku-field-hint">中国工場へ送る正式な品番です。{ISSUANCE_HINT} 社内画面にはWordPressへのログインが必要です。この確認版の案件入力はタブ内保存です。</p>
  </section>;
}
