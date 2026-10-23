import {CompetitorProductCard} from './CompetitorProductCard.jsx';
import {displaySku} from './sheet-status.mjs';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRightIcon, ArrowSquareOutIcon, BellIcon } from './icons.jsx';
import { launchDate, linkedProject, listLaunched, purchaseDraft, NEWS_READ_KEY, unreadNews, acknowledgeNews, parseNewsReadState } from './catalog.mjs';
import { normalizeSearch } from './workflow.mjs';
import { topicDateTime } from './topics.mjs';
import {SALES_CHANNELS} from './case-workflow.mjs';

export function useOfficialNews(feedPath = '/api/clazzio-news', readKey = NEWS_READ_KEY) {
  const [feed, setFeed] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const [read, setRead] = useState(() => { try { return parseNewsReadState(localStorage.getItem(readKey)); } catch { return {}; } });
  const request = useRef(null);
  const openPending = useRef(false);
  const markRead = useCallback(() => {
    if (!feed) { openPending.current = true; return; }
    setRead(current => acknowledgeNews(feed.items, current));
  }, [feed]);
  useEffect(() => { try { localStorage.setItem(readKey, JSON.stringify(read)); } catch { /* Keep acknowledgement in memory when storage is unavailable. */ } }, [read, readKey]);
  useEffect(() => {
    const sync = event => { if (event.key === readKey) setRead(parseNewsReadState(event.newValue)); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [readKey]);
  const refresh = useCallback(async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const response = await fetch(feedPath, { signal: controller.signal, cache: 'no-cache' });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.items)) throw new Error(data.error || '公式情報を取得できませんでした。');
      setFeed(data);
      if (openPending.current) { setRead(current => acknowledgeNews(data.items, current)); openPending.current = false; }
      setError(data.warning || '');
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause.message);
    } finally {
      if (request.current === controller) { request.current = null; setLoading(false); }
    }
  }, [feedPath]);
  useEffect(() => {
    refresh();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 24 * 60 * 60 * 1000);
    return () => { clearInterval(timer); request.current?.abort(); request.current = null; };
  }, [refresh]);
  return { feed, error, loading, refresh, markRead, cancelPendingRead: () => { openPending.current = false; }, unreadCount: unreadNews(feed?.items || [], read).length };
}

export function OfficialNewsNotice({ news, onOpen }) {
  if (!news.feed?.items.length && !news.error) return null;
  return <button className={`official-news-notice ${news.unreadCount ? 'has-new' : ''}`} onClick={onOpen}><span className="news-notice-title"><BellIcon size={16} /><strong>クラッツィオ 新発売</strong></span>{news.unreadCount > 0 && <span className="news-new-mark"><span className="news-green-dot" aria-hidden="true" />新着{news.unreadCount}件</span>}{(!news.unreadCount || news.error) && <span className="notice-total">{news.error ? '取得状況を確認' : `${news.feed.items.length}件`}</span>}<small>{news.feed ? `最新掲載 ${news.feed.items[0]?.publishedAt || '—'}` : '公式ページで確認できます'}</small><span className="notice-action">一覧を見る<ArrowRightIcon size={15} /></span></button>;
}

export function NewProducts({ news, projects, query, onRegister, onSelect, sample=true, canCreate=true }) {
  const { feed, loading, error, refresh } = news;
  const text = normalizeSearch(query);
  const items = (feed?.items || []).filter(item => !text || normalizeSearch(`${item.title} ${item.codes.join(' ')}`).includes(text));
  return <section className="catalog-panel" aria-label="クラッツィオの新発売情報">
    <div className="catalog-toolbar"><div><strong>クラッツィオのシートカバー</strong><p>公式の最新情報10件から自動抽出 · 公式へのアクセスは1日1回</p></div><button className="secondary compact" disabled={loading} onClick={refresh}>{loading ? '確認中…' : '保存済み情報を更新'}</button></div>
    <div className="catalog-source"><time>取得 {feed?.checkedAt ? topicDateTime(feed.checkedAt) : '初回取得待ち'}</time>{feed?.nextCheckAt&&<time>次回 {topicDateTime(feed.nextCheckAt)}</time>}<a href="https://www.11i.co.jp/news?category=product_info" target="_blank" rel="noopener noreferrer">公式一覧を開く<ArrowSquareOutIcon size={14} /></a></div>
    <p className="catalog-context">コネクト適合DBの登録状況は未照合です。案件に登録済みかどうかは、この画面のデータで確認できます。</p>
    {error && <p role="alert" className="catalog-error">{error}{feed && ' 以下は前回取得した情報です。'}</p>}
    <div className="new-product-list">{items.map(item => {
      const project = linkedProject(item, projects);
      return <CompetitorProductCard key={item.id} item={item} registered={project} onOpen={()=>onSelect(project.id)} onRegister={canCreate?()=>onRegister(purchaseDraft(item)):null}/>;
    })}</div>
    {!items.length && <div className="empty-state"><strong>{loading && !feed ? '公式情報を確認しています' : query ? '検索条件に合う新発売情報がありません' : error ? '情報を取得できませんでした' : '公式の最新情報10件にシートカバーの新発売情報はありません'}</strong></div>}
    {sample?<p className="sample-footnote">案件登録はサンプル操作です。購入手続きは行いません。再読込で登録内容は初期化されます。</p>:<p className="sample-footnote">{canCreate?'青いボタンから案件を登録します。登録内容は社内で共有保存されます。購入手続きは担当者が行います。':'案件の登録は、案件責任者または登録担当者へ依頼してください。'}</p>}
  </section>;
}

export function LaunchedProducts({ projects, onSelect, onClear, sample=true }) {
  const sales = listLaunched(projects);
  return <section className="overview-scroll launched-products" aria-label="販売開始した案件の一覧"><div className="launched-intro"><strong>販売中 <span>{sales.length}件</span></strong><p>フロント向けに、販売開始した案件を新しい順でまとめています。</p></div><div className="table-wrap"><table><thead><tr><th>車種・品番</th><th>年式・型式</th><th>定員・グレード</th><th>販売開始日</th><th>販売先</th><th>担当</th><th><span className="sr-only">詳細</span></th></tr></thead><tbody>{sales.map(project => <tr key={project.id}><td><button className="case-link" onClick={() => onSelect(project.id)}>{project.manufacturer} {project.car}</button><small>{displaySku(project)} · {project.brand}</small></td><td>{project.fitment.year || '未確認'}<small>{project.fitment.type || '型式未確認'}</small></td><td>{project.fitment.seats || '—'}<small>{project.fitment.grade || 'グレード未確認'}</small></td><td><time>{launchDate(project) || '未記録'}</time></td><td><div className="sales-destinations">{project.sheetStatus?.category==='sold'?<span>シートの販売実績</span>:(project.salesChannels||['main','rakuten','yahoo']).map(key=><span key={key}>{SALES_CHANNELS[key]||key}</span>)}</div></td><td>{project.owner}</td><td><button className="secondary compact table-detail-button" aria-label={`${project.id}の詳細を開く`} onClick={() => onSelect(project.id)}>詳細を見る<ArrowRightIcon size={15} /></button></td></tr>)}</tbody></table></div>{!sales.length && <div className="empty-state"><strong>条件に合う販売中の案件がありません</strong><button className="text-button" onClick={onClear}>絞り込みを解除</button></div>}{sample&&<p className="sample-footnote">販売開始日・適合情報はサンプルです。販売先は商品ページの準備完了を表しています。</p>}</section>;
}
