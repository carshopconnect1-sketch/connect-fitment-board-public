import { currentDate } from './workflow.mjs';
import React, { useState } from 'react';
import { BellIcon, CheckIcon, ArrowRightIcon } from './icons.jsx';
import { collectTopics, featuredTopics, topicDateTime } from './topics.mjs';

export function TopicAnnouncements({ projects, onSelect, actionOnly=false }) {
  const [seen, setSeen] = useState(() => new Set());
  const [expanded, setExpanded] = useState(false), [showSeen, setShowSeen] = useState(false), [compact, setCompact] = useState(true);
  const topics = collectTopics(projects,currentDate());
  const unread = actionOnly?topics:topics.filter(topic => !seen.has(topic.id));
  const reviewed = topics.filter(topic => seen.has(topic.id));
  const list = showSeen ? topics : expanded ? unread : featuredTopics(unread);
  const acknowledge = id => setSeen(current => new Set([...current, id]));
  return <section className={`topics-panel ${compact ? "is-collapsed" : ""}`} aria-label="案件のトピックス">
    <header className="topics-header"><h2><BellIcon size={19} /><span>{actionOnly?'対応が必要なこと':'トピックス'}</span><b className={unread.length ? 'unread-count' : 'unread-count clear'}>{actionOnly?'要対応':'未確認'} {unread.length}</b></h2>{compact && unread[0] && <button type="button" className="topic-preview" onClick={()=>onSelect(unread[0].projectId,unread[0].kind)} title={`${unread[0].car}：${unread[0].message}`}>{unread[0].car}：{unread[0].message} →</button>}<span className="topics-source">{actionOnly?'管理中の案件から自動抽出':'全案件から自動抽出'}</span><div className="topic-controls"><button type="button" onClick={()=>setCompact(!compact)} aria-expanded={!compact}>{compact ? "お知らせを開く" : "閉じる"}</button>{!compact && unread.length > 3 && <button onClick={() => { setExpanded(!expanded); setShowSeen(false); }} aria-expanded={expanded}>{expanded ? '折りたたむ' : `すべて見る (${unread.length})`}</button>}{!compact && reviewed.length > 0 && <button onClick={() => setShowSeen(!showSeen)} aria-pressed={showSeen}>{showSeen ? '未確認へ' : `確認済み (${reviewed.length})`}</button>}</div></header>
    {!compact && (list.length ? <div className={`topic-grid ${expanded || showSeen ? 'topic-grid-expanded' : ''}`}>{list.map(topic => <article className={`topic-item ${topic.kind} ${seen.has(topic.id) ? 'reviewed' : ''}`} key={topic.id}><button className="topic-open" onClick={() => onSelect(topic.projectId,topic.kind)} aria-label={`${topic.car}：${topic.message}。案件を開く`}><span className="topic-label">{topic.label}</span><strong>{topic.car}<small>{topic.sku}</small></strong><p>{topic.message}</p><div className="topic-stamp"><time dateTime={topic.updatedAt || undefined}>更新 {topicDateTime(topic.updatedAt)}</time>{topic.kind === 'overdue' && <span>{topic.detail}</span>}</div><span className="topic-meta">{actionOnly?'対応する':'案件を開く'}<ArrowRightIcon size={13} /></span></button>{!actionOnly&&<button className="topic-ack" title={seen.has(topic.id) ? '確認済み' : '確認済みにする'} disabled={seen.has(topic.id)} onClick={() => acknowledge(topic.id)} aria-label={`${topic.car}のお知らせを確認済みにする`}><CheckIcon size={13} />{seen.has(topic.id) ? '確認済み' : '確認する'}</button>}</article>)}</div> : <p className="topics-empty"><CheckIcon size={16} />{actionOnly?'対応が必要なことはありません。担当・期限・引継ぎに動きがあると表示します。':'未確認のお知らせはありません。新しい動きがあると、ここに表示されます。'}</p>)}
  </section>;
}
