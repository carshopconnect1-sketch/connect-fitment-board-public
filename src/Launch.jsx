import React, { useState } from 'react';
import { Modal, FormActions } from './shared-forms.jsx';
import { CheckCircleIcon, ArrowRightIcon } from './icons.jsx';
import { currentDate, TODAY, OWNERS } from './workflow.mjs';
import { SALES_CHANNELS, validHttps } from './case-workflow.mjs';
import { launchIssues } from './launch.mjs';
import {requestApproval,approveLaunch} from './approval.mjs';
import {LAUNCH_STATES} from './WorkPages.jsx';

export function LaunchPanel({ project, onOpen, onFitment, onTasks }) {
  const issues = launchIssues(project);
  const confirmed = project.launch?.status === 'confirmed';
  const review = project.launch?.status === 'needs-review';
  const pending = project.launch?.status === 'approval-pending';
  return <section className={`launch-panel ${confirmed ? 'confirmed' : ''}`} aria-label="販売開始の確認">
    <div className="launch-panel-title"><CheckCircleIcon size={21} weight={confirmed ? 'fill' : 'regular'} /><h3>{confirmed ? '販売開始 承認済み' : pending ? '最終確認者の承認待ち' : review ? '販売開始を再承認' : '販売開始の承認'}</h3></div>
    {confirmed ? <p>発売 {project.launch.date.replaceAll('-', '/')} · 確認 {project.launch.confirmedBy}</p> : <p>{review ? '適合または完了状態が変更されています。内容を確認して再承認を依頼してください。' : '準備を終えて承認依頼を出すと、指定した最終確認者が承認します。全員のお知らせに販売開始が届きます。'}</p>}
    {confirmed&&project.launch.urls&&<p>{Object.entries(project.launch.urls).filter(([,url])=>validHttps(url)).map(([id,url])=><a key={id} href={validHttps(url)} target="_blank" rel="noopener noreferrer">{SALES_CHANNELS[id]}の商品 ↗ </a>)}</p>}
    {!confirmed && issues.length > 0 && <ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
    {review && project.launch.date && <small>前回の発売記録 {project.launch.date} · {project.launch.confirmedBy}</small>}
    <div className="launch-panel-actions">{!confirmed&&issues.length>0&&onTasks&&<button className="secondary compact" onClick={onTasks}>HP・作業を確認</button>}{!confirmed && issues.some(issue => /^自社品番|^品番を|^適合情報/.test(issue)) && <button className="secondary compact" onClick={onFitment}>品番・適合を入力</button>}<button className={`${confirmed ? 'secondary' : 'primary'} compact`} onClick={onOpen} disabled={!confirmed && issues.length > 0}>{confirmed ? '承認記録を見る' : pending ? '承認依頼を見る' : '販売開始の承認を依頼'}<ArrowRightIcon size={15} /></button></div>
  </section>;
}

export function LaunchEditor({ project, actor, onClose, onSave }) {
  const [draft, setDraft] = useState({ date: project.launch?.date || currentDate(), confirmedBy: project.launch?.confirmedBy || actor || '担当A', reviewed: false, urls:project.launch?.urls||{},orderChecked:project.launch?.orderChecked||{}, note: project.launch?.note || '' });
  const [error, setError] = useState('');
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  const issues = launchIssues(project);
  const existing = project.launch?.status === 'confirmed';
  const pending=project.launch?.status==='approval-pending';
  const canAct=pending?project.reviewer===actor:project.owner===actor;
  return <Modal title={existing ? '販売開始の承認記録' : pending ? '販売開始の最終承認' : '販売開始の承認を依頼'} onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); try { onSave(pending?approveLaunch(project,actor):requestApproval(project,draft,actor,currentDate())); } catch (cause) { setError(cause.message); } }}>
      <div className="form-body"><fieldset className="field-grid launch-form-fields" disabled={existing||!canAct}><p className="form-context full">{project.manufacturer} {project.car} <span>{project.sku || '品番未定'}</span></p>
        <p className="form-explainer full">案件責任者が依頼し、指定した最終確認者だけが承認します。承認後は全員に日時付きで通知します。公開画面はサンプルです。</p>
        <p className="work-approval-summary full">状態：{LAUNCH_STATES[project.launch?.status]||'準備中'}<br/>案件責任者：{project.owner||'未割当'}<br/>最終確認者：{project.reviewer||'未割当'}<br/>操作中：{actor}{existing&&<><br/>承認：{project.launch.confirmedBy} · {new Date(project.launch.confirmedAt).toLocaleString('ja-JP')}</>}</p>
        <label>実際の発売日<input type="date" required max={currentDate()} disabled={pending||existing} value={draft.date} onChange={event=>set('date',event.target.value)}/></label>
        {project.registrationType&&(project.salesChannels||Object.keys(SALES_CHANNELS)).map(id=><section className="publication-check full" key={id}><h3>{SALES_CHANNELS[id]}の公開確認</h3><label>公開商品URL<input required disabled={pending} type="url" pattern="https://.*" value={draft.urls[id]||''} onChange={e=>set('urls',{...draft.urls,[id]:e.target.value})} placeholder="https://…"/></label><label className="check-line"><input required disabled={pending} type="checkbox" checked={draft.orderChecked[id]===true} onChange={e=>set('orderChecked',{...draft.orderChecked,[id]:e.target.checked})}/><span>品番・適合・価格・納期が正しく、注文できることを確認</span></label></section>)}
        <label className="full">確認メモ（任意）<textarea rows={3} disabled={pending} value={draft.note} onChange={event => set('note', event.target.value)} placeholder="最終確認した内容、公開した商品ページなど" /></label>
        <label className="full launch-review-check"><input type="checkbox" required checked={draft.reviewed} onChange={event => set('reviewed', event.target.checked)} /><span>適合・品番・販売準備を確認しました</span></label>
        {issues.length > 0 && <p className="form-error full" role="alert">{issues.join(' ')}</p>}{error && <p className="form-error full" role="alert">{error}</p>}
      </fieldset>{!existing&&!canAct&&<p className="form-explainer">{pending?`${project.reviewer||'最終確認者'}の承認を待っています。`:`案件責任者 ${project.owner||'未割当'} が承認を依頼します。`}</p>}</div>{existing||!canAct?<footer className="form-actions"><button type="button" className="secondary" onClick={onClose}>閉じる</button></footer>:<FormActions onClose={onClose} label={pending?'承認して全員に知らせる':'最終確認者へ承認を依頼'}/>}
    </form>
  </Modal>;
}
