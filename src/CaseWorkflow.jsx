import {CaseEntryForm} from './CaseEntryForm.jsx';
import {BOARD_PHASES} from './board-phases.mjs';
import React, { useState } from 'react';
import { Modal, FormActions } from './shared-forms.jsx';
import { OWNERS, STAGES, stageOf, nextTask, shortDate } from './workflow.mjs';
import { REGISTRATION_TYPES, SALES_CHANNELS, FLOW_STEPS, ownerLabel, registrationLabel, applyCaseSettings, requestHandover, acceptHandover, returnHandover } from './case-workflow.mjs';
import './case-workflow.css';

export function OwnerSelect({label,value,onChange,required=false}) {
  return <label>{label}<select required={required} value={value||''} onChange={e=>onChange(e.target.value)}><option value="">未割当</option>{OWNERS.map(x=><option key={x}>{x}</option>)}</select></label>;
}

export function RegistrationFields({draft,set,projects=[],showCategoryAdded=true,showExtras=true}) {
  const choices=projects.filter((p,i,list)=>list.findIndex(q=>q.manufacturer===p.manufacturer&&q.car===p.car&&q.generation===p.generation)===i);
  return <>
    <fieldset className="registration-choice full"><legend>登録区分 <span className="required">必須</span></legend>{Object.entries(REGISTRATION_TYPES).map(([id,name])=><label key={id} className={draft.registrationType===id?'selected':''}><input type="radio" name="registration-type" required checked={draft.registrationType===id} onChange={()=>{set('registrationType',id);set('baseVehicleId','');}}/><span><strong>{name}</strong><small>{id==='new'?'未登録車種・フルモデルチェンジ':'年式・マイナーチェンジ・仕様変更'}</small></span></label>)}</fieldset>
    {draft.registrationType==='existing'&&<label className="full" data-entry-field="baseVehicleId">追加先の既存車種・世代<select required value={draft.baseVehicleId||''} onChange={e=>{const p=projects.find(p=>p.id===e.target.value);set('baseVehicleId',e.target.value);if(p){set('manufacturer',p.manufacturer);set('car',p.car);set('generation',p.generation||'');set('categoryUrl',p.categoryUrl||p.tasks?.find(t=>t.id==='hp-category')?.referenceUrl||'');}}}><option value="">追加先を選択</option>{choices.map(p=><option value={p.id} key={p.id}>{p.manufacturer} {p.car} · {p.generation||'世代未確認'}</option>)}</select></label>}
    {showExtras&&<><label>世代・型式（分かる場合）<input value={draft.generation||''} onChange={e=>set('generation',e.target.value)} placeholder="新型／旧型を区別する情報"/></label>
    <label>HPカテゴリーページURL<input type="url" pattern="https://.*" value={draft.categoryUrl||''} onChange={e=>set('categoryUrl',e.target.value)} placeholder="https://…（後から記録可）"/></label></>}
    {showCategoryAdded&&draft.registrationType==='new'&&<label className="check-line full"><input type="checkbox" checked={!!draft.categoryAdded} onChange={e=>set('categoryAdded',e.target.checked)}/><span>HPへの新規車種追加は済んでいる<small>作成実績を引き継ぎます。品番・商品反映は別に確認します。</small></span></label>}
  </>;
}

export function CaseSettings({project,projects,actor,onClose,onSave}) {
 const[busy,setBusy]=useState(false);
 return <Modal title="案件の設定" wide busy={busy} onClose={onClose}><CaseEntryForm sample exclusions initialValues={{...project,handoverNote:''}} projects={projects} members={OWNERS.map(key=>({key,label:key}))} onClose={onClose} onBusyChange={setBusy} submitLabel="変更を保存" onSave={d=>onSave(applyCaseSettings(project,d,actor))} extraOptions={(d,set)=><label>責任者変更時の引継ぎ内容<textarea rows={3} value={d.handoverNote||''} onChange={e=>set('handoverNote',e.target.value)} placeholder="残作業・未解決事項など"/></label>}/></Modal>;
}

export function CaseSummary({project,onSettings,onHandover}) {
  if (!project.registrationType) return null;
  const pending=project.tasks.filter(t=>t.handover?.status==='pending');
  const category=project.tasks.find(t=>t.id==='hp-category');
  return <section className="case-summary" aria-label="登録区分と担当"><div><strong>{registrationLabel(project)}</strong><button className="text-button" onClick={onSettings}>設定・担当変更</button></div><p>{project.generation||'世代・型式は未記録'} · 案件責任者 <b>{ownerLabel(project.owner)}</b></p>{category&&<p className={category.status==='done'?'hp-done':'hp-pending'}>HP車種追加 {category.status==='done'?'済み':'未完了'}{category.status==='done'&&!category.referenceUrl&&' · URL未記録'}</p>}{pending.length>0&&onHandover&&<button className="handover-shortcut" onClick={onHandover}>引継ぎ受領待ち {pending.length}件 · 内容を見る →</button>}</section>;
}

export function HandoverEditor({project,actor,onClose,onSave}) {
  const available=project.tasks.filter(t=>t.required&&t.status!=='done');
  const first=nextTask(project);
  const [draft,setDraft]=useState({taskId:available.find(t=>t.id===first?.id)?.id||available[0]?.id||'',to:'',due:first?.due||'',context:''});
  const [error,setError]=useState('');const set=(k,v)=>setDraft(s=>({...s,[k]:v}));
  return <Modal title="担当へ引継ぎを依頼" onClose={onClose}><form onSubmit={e=>{e.preventDefault();try{onSave(requestHandover(project,draft.taskId,draft,actor));}catch(c){setError(c.message);}}}><div className="form-body field-grid"><p className="form-context full">依頼する担当 {actor} · {project.car}</p><label className="full">引継ぐ作業<select required value={draft.taskId} onChange={e=>{set('taskId',e.target.value);set('due',available.find(t=>t.id===e.target.value)?.due||'');}}>{available.map(t=><option key={t.id} value={t.id}>{t.name} · {ownerLabel(t.owner)}</option>)}</select></label><OwnerSelect label="引継ぎ先" value={draft.to} required onChange={v=>set('to',v)}/><label>対応期限<input type="date" required value={draft.due} onChange={e=>set('due',e.target.value)}/></label><label className="full">次にやること・渡す資料<textarea required rows={4} value={draft.context} onChange={e=>set('context',e.target.value)} placeholder="確認する仕様・成果物・未解決事項など"/></label><p className="form-explainer full">受取担当が受領するまで「引継ぎ待ち」です。作業の完了やお知らせの確認とは別に記録します。</p>{error&&<p className="form-error full" role="alert">{error}</p>}</div><FormActions onClose={onClose} label="引継ぎを依頼"/></form></Modal>;
}

export function CaseFlow({project,actor,onSettings,onRequest,onSave,onOpenTask}) {
  const [reasons,setReasons]=useState({});const [error,setError]=useState('');
  const requests=project.tasks.filter(t=>t.handover);
  const act=(task,returned)=>{try{onSave(returned?returnHandover(project,task.id,task.handover.id,actor,reasons[task.id]):acceptHandover(project,task.id,task.handover.id,actor));setError('');if(!returned)onOpenTask?.(task.id);}catch(c){setError(c.message);}};
  return <><CaseSummary project={project} onSettings={onSettings}/><section className="handover-section" aria-label="担当への引継ぎ"><div className="section-title"><h3>引継ぎ</h3><button className="secondary compact" onClick={onRequest} disabled={!project.tasks.some(t=>t.required&&t.status!=='done')}>＋ 引継ぎを依頼</button></div><p className="detail-caption">操作する担当：{actor}（サンプル）。受取担当に切り替えて受領を確認できます。</p>{!requests.length&&<p className="empty-handover">引継ぎ依頼はまだありません。</p>}{requests.map(t=>{const h=t.handover;const mine=h.status==='pending'&&h.to===actor&&t.owner===actor;return <article className={`handover-card ${h.status}`} key={t.id}><strong>{t.name}</strong><span className="handover-state">{h.status==='pending'?'受領待ち':h.status==='accepted'?'受領済み':'差し戻し'}</span><p>{ownerLabel(h.from)} → {ownerLabel(h.to)} · 期限 {shortDate(h.due)}</p><p>{h.context}</p><small>{new Date(h.requestedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}</small>{h.status==='returned'&&<p className="return-reason">理由：{h.reason} · 対応 {ownerLabel(t.owner)}</p>}{h.status==='accepted'&&<p>受領 {h.acceptedBy} · {new Date(h.acceptedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}</p>}{h.status==='pending'&&<div className="handover-actions"><button className="primary compact" disabled={!mine} onClick={()=>act(t,false)}>受領してこの作業を開く</button><label>差し戻し理由<input value={reasons[t.id]||''} onChange={e=>setReasons({...reasons,[t.id]:e.target.value})} placeholder="不足している情報など" disabled={!mine}/></label><button className="secondary compact" disabled={!mine} onClick={()=>act(t,true)}>理由を付けて差し戻す</button>{!mine&&<small>操作する担当を{h.to}に切り替えてください。</small>}</div>}</article>;})}{error&&<p role="alert" className="form-error">{error}</p>}</section><section className="flow-section" aria-label="作業フローと完了条件"><h3>作業フロー</h3><ol>{BOARD_PHASES.map((phase,i)=><li key={phase.id} className={stageOf(project)===i?'current':''}><b>{phase.label}</b><p>{phase.description}</p></li>)}</ol><div className="release-definition"><strong>販売開始の基準</strong><p>開発・適合・HP反映・必要な登録が完了し、対象販売先で正しい品番・適合・価格・納期で注文できることを確認して、最終確認者が確定します。</p></div></section></>;
}
