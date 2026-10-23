import React from 'react';
import {BOARD_PHASES} from './board-phases.mjs';
import { KanbanIcon, TruckIcon, ClipboardTextIcon, CheckCircleIcon, BellIcon, CarProfileIcon, PlusIcon, ArrowRightIcon } from './icons.jsx';

// Keep route IDs stable. Both the sample and connected app use this menu.
export const NAV_GROUPS = [
  { label: '全体', items: [
    { id: 'board', label: '全体の進捗', description: '開発から販売までを確認', Icon: KanbanIcon },
    { id: 'mine', label: '自分の作業', description: '対応・受領・承認を確認', Icon: ClipboardTextIcon },
  ] },
  { label: '登録から販売まで', items: [
    ...BOARD_PHASES.map((phase,index)=>({...phase,step:index+1,Icon:ClipboardTextIcon})),
  ] },
  { label: '作業ツール', items: [
    {id:'numbering',label:'品番の台帳・発行',description:'自社品番・中国向けフェイク品番',Icon:PlusIcon},
    {id:'shipping',label:'中国への荷物追跡',description:'送り状・配達状況・工場の受取',Icon:TruckIcon},
  ] },
  { label: '開発候補', items: [
    { id: 'new', label: '他社の新商品', description: '新商品から案件登録へ進む', Icon: BellIcon },
  ] },
  { label: '日々の確認', items: [
    { id: 'inbox', label: 'お知らせ', description: '変更と販売開始を確認', Icon: BellIcon },
  ] },
  { label: 'データ・管理', items: [
    { id: 'fitment', label: '適合データ', description: '車種・年式・品番を検索', Icon: CarProfileIcon },
    { id: 'legacy', label: '以前の管理データ', description: '確認して新ボードに取り込む', Icon: CarProfileIcon, connectedOnly: true },
    { id: 'settings', label: '管理・取り込み', description: 'メンバー・資料・バックアップ', Icon: ClipboardTextIcon, connectedOnly: true },
  ] },
];
export const viewLabel = id => NAV_GROUPS.flatMap(group => group.items).find(item => item.id === id)?.label || '全体の進捗';

export function AppNavigation({ view, onSelect, onRegister, connected = false, unread = {}, allowed }) {
  return <nav className="app-navigation" aria-label="機能メニュー">{NAV_GROUPS.map(group => <section className="nav-group" key={group.label} aria-label={group.label}>
    <h2 className="nav-group-label">{group.label}</h2>
    {group.label==='登録から販売まで'&&<p className="nav-flow-help">ボードと同じ7工程です。中国向け品番と工場受取は②で確認します。</p>}
    <div className="nav-group-items">{group.items.filter(item => (connected || !item.connectedOnly)&&(!allowed||allowed.includes(item.id))&&(item.id!=='register'||onRegister)).map(({ id, label, description, Icon, step }) => <button key={id} type="button" className={view === id ? 'active' : ''} aria-label={label} aria-describedby={`nav-description-${id}${unread[id] > 0 ? ` nav-unread-${id}` : ''}`} aria-current={view === id ? 'page' : undefined} onClick={() => id==='register'?onRegister():onSelect(id)}>
      {step ? <span className="nav-step" aria-hidden="true">{step}</span> : <Icon size={23} aria-hidden="true" />}
      <span className="nav-copy"><span className="nav-label">{label}</span><span className="nav-description" id={`nav-description-${id}`}>{description}</span></span>
      {unread[id] > 0 ? <span className="nav-unread" id={`nav-unread-${id}`} aria-label={`未確認${unread[id]}件`}>{unread[id] > 99 ? '99+' : unread[id]}</span> : <ArrowRightIcon size={14} className="nav-arrow" aria-hidden="true" />}
    </button>)}</div>
  </section>)}</nav>;
}
