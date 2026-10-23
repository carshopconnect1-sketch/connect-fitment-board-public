import React from 'react';
import {competitorDisplay} from './competitor-display.mjs';
export function CompetitorProductCard({item,registered,onRegister,onOpen}){
 const info=competitorDisplay(item);
 return <article className="new-product-card"><div className="new-product-meta"><time dateTime={item.publishedAt}>掲載 {item.publishedAt}</time><span className="official-label">公式情報</span></div><h2>{info.car}</h2><dl className="competitor-fields"><div><dt>メーカー</dt><dd>{info.manufacturer||'公式詳細で確認'}</dd></div><div><dt>クラッツィオ品番</dt><dd>{item.codes?.join(' / ')||'公式詳細で確認'}</dd></div><div><dt>案件</dt><dd>{registered?'登録済み':'未登録'}</dd></div></dl><div className="new-product-actions"><a className="secondary compact" href={item.url} target="_blank" rel="noopener noreferrer">公式の仕様を確認 ↗</a>{registered?<button className="primary compact" onClick={onOpen}>登録した案件を開く →</button>:onRegister&&<button className="primary compact" onClick={onRegister}>この商品から案件を登録 →</button>}</div><details className="competitor-original"><summary>公式の掲載名・適合DB照合</summary><p>{item.title}</p><p>コネクト適合DB：未照合。登録時に重複を確認します。</p></details></article>;
}
