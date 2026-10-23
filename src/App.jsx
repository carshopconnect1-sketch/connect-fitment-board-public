import {isProduct,matchesProductScope} from './products.mjs';
import {ProductScope} from './ProductFields.jsx';
import {resolveSampleSheet} from './sheet-resolution.mjs';
import {ProgressView} from './ProgressList.jsx';
import {SheetStatusBar,SheetCaseList} from './SheetStatus.jsx';
import {primaryCases,sheetCategory} from './sheet-status.mjs';
import {GuidedTaskDialog} from './GuidedTaskDialog.jsx';
import {WorkActionDesk} from './WorkActionDesk.jsx';
import {completeAndHandover} from './guided-completion.mjs';
import {nextTask} from './workflow.mjs';
import {applyAfterLaunch} from './operations.mjs';
import {WorkspaceControls,VIEW_DESCRIPTION,emptyFilters} from './WorkspaceUI.jsx';
import { ShippingBoard } from './ShippingBoard.jsx';
import { applyShipment } from './shipping.mjs';
import React, { useEffect, useState } from 'react';
import { MagnifyingGlassIcon, PlusIcon, XIcon, FunnelIcon, ListIcon, CheckCircleIcon } from './icons.jsx';
import { Board, Overview, Detail, TaskEditor, FitmentEditor, AddCase, NoteEditor } from './components.jsx';
import { SAMPLE_PROJECTS, newProject } from './sample-data.mjs';
import { TopicAnnouncements } from './TopicAnnouncements.jsx';
import { DevelopmentEditor, ShipmentEditor, AfterLaunchEditor } from './Operations.jsx';
import { useOfficialNews, OfficialNewsNotice, NewProducts, LaunchedProducts } from './Catalog.jsx';
import { LaunchEditor } from './Launch.jsx';
import { CaseSettings, HandoverEditor } from './CaseWorkflow.jsx';
import { requireLaunchReview } from './launch.mjs';
import { currentDate, TODAY, STAGES, CHANNELS, OWNERS, STATUS_LABELS, stageOf, filterProjects, applyTasks } from './workflow.mjs';
import {requestApproval,reviewAfterChange,noticeFor,visibleNotices,ackNotice} from './approval.mjs';
import {MyWork,WorkInbox,NoticeStrip} from './WorkPages.jsx';
import { AppNavigation, viewLabel } from './AppNavigation.jsx';

function initialProjects() {
  const rows=structuredClone(SAMPLE_PROJECTS).map(p=>({...p,reviewer:'担当B',approvals:[]}));
  const p={...newProject({manufacturer:'トヨタ',car:'承認テスト（サンプル）',registrationType:'new',developmentMethod:'purchase',owner:'担当A',brand:'Refinad',salesChannels:['main']},'C-013'),sku:'T0022-01',reviewer:'担当B',fitment:{year:'2026年〜',type:'確認用型式',seats:'5人',grade:'サンプル',shape:'確認用仕様',exclusions:'なし'},approvals:[]};
  p.tasks=p.tasks.map(t=>({...t,status:'done',owner:'担当A',referenceUrl:t.id.startsWith('hp-')?'https://example.com/category':'',note:'サンプルの確認結果'}));
  rows.push(requestApproval(p,{date:currentDate(),reviewed:true,urls:{main:'https://example.com/product'},orderChecked:{main:true},note:'承認の操作を試すためのサンプル'},'担当A',currentDate()));rows.push({...newProject({flowVersion:2,manufacturer:'ホンダ',car:'登録フロー確認（サンプル）',registrationType:'new',developmentMethod:'own',owner:'担当A',due:currentDate(),salesChannels:['main'],brand:'Refinad'},'C-014'),reviewer:'担当B',approvals:[]});rows[1].sheetStatus={category:'review',stage:1,reviewType:'入荷確認',question:'現物は入荷済みですか？ 到着日か、現在の入荷予定を確認してください。',issues:['進捗は入荷、到着欄は入荷待ちのため確認'],source:{serial:'DEMO-002',status:'入荷'},sku:rows[1].sku,sourceModifiedAt:'2026-10-16T02:00:00Z'};const sold=rows.find(p=>p.launch?.status==='confirmed')||rows[10];sold.sheetStatus={category:'sold',stage:6,issues:[],launchDate:'2026/10/09',source:{serial:'DEMO-SOLD',status:'販売開始'},sku:sold.sku,sourceModifiedAt:'2026-10-16T02:00:00Z'};return rows;
}
export function App() {
  const [statusView,setStatusView]=useState('active');
  const [projects, setProjects] = useState(initialProjects);
  const [actor, setActor] = useState('担当A');
  const [workNotices,setWorkNotices]=useState(()=>projects.filter(p=>p.launch?.status==='approval-pending').map(p=>noticeFor(p,'launch_requested',[p.reviewer],p.launch.requestedAt)));const myNotices=visibleNotices(workNotices,actor);const unread=myNotices.filter(n=>!n.read).length;
  const [view, setView] = useState('board'), [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('tasks'), [expanded, setExpanded] = useState(false);
  const [filters, setFilters] = useState({ query: '', quick: 'all', channel: '', owner: '', brand: '',productKind:'seat' });
  const [extraFilters, setExtraFilters] = useState(false), [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState(null), [toast, setToast] = useState('');
  const [editingShipment, setEditingShipment] = useState(null);const [editingTask,setEditingTask]=useState(null);
  const [initialCase, setInitialCase] = useState(null);
  const news = useOfficialNews();
  const [mobileDetail, setMobileDetail] = useState(false);
  const project = projects.find(item => item.id === selectedId);
  const visible = filterProjects(primaryCases(projects), { ...filters, currentOwner: actor },currentDate());
  const closeModal = React.useCallback(() => setModal(null), []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { const listener = event => { if (event.key === 'Escape' && !modal) { setSelectedId(null); setExpanded(false); setMobileDetail(false); setMobileNav(false); } }; document.addEventListener('keydown', listener); return () => document.removeEventListener('keydown', listener); }, [modal]);
  const selectProject = id => { setSelectedId(id); setTab('tasks'); setMobileDetail(true); };
  const clearFilters = () => setFilters(emptyFilters(filters.productKind));
  const change = (updated, text, details = {}) => { const recordedAt = new Date().toISOString(); const before=projects.find(p=>p.id===updated.id);updated=reviewAfterChange(before,updated);const add=[];if(updated.launch?.requestId!==before.launch?.requestId&&updated.launch?.status==='approval-pending')add.push(noticeFor(updated,'launch_requested',[updated.reviewer],recordedAt));if(updated.launch?.status==='confirmed'&&before.launch?.status!=='confirmed')add.push(noticeFor(updated,'launch_approved',OWNERS,recordedAt));if(updated.launch?.status==='needs-review'&&before.launch?.status!=='needs-review')add.push(noticeFor(updated,'launch_review',OWNERS,recordedAt));if(stageOf(updated)!==stageOf(before)&&updated.launch?.status!=='confirmed')add.push(noticeFor(updated,'stage_changed',OWNERS,recordedAt));for(const t of updated.tasks)if(t.handover?.status==='pending'&&t.handover.id!==before.tasks.find(q=>q.id===t.id)?.handover?.id)add.push(noticeFor({...updated,launch:{requestId:t.handover.id}},'handover',[t.handover.to],recordedAt));if(add.length)setWorkNotices(n=>[...n,...add.filter(x=>!n.some(y=>y.id===x.id))]); setProjects(current => current.map(item => item.id === updated.id ? { ...updated, updatedAt: recordedAt, history: [...updated.history, { date: recordedAt.slice(0,10), recordedAt, actor, text, ...details }] } : item)); if(!details.keepOpen)setModal(null); setToast(text); };
  const openWork=(id,kind,taskId)=>{selectProject(id);setView('board');clearFilters();if(kind==='settings'){setModal('settings');return;}if(kind==='handover'){setTab('flow');return;}if(kind==='approval'||kind==='review'||kind?.startsWith('launch_')){setModal('launch');return;}if(taskId){setEditingTask(taskId);setModal('tasks');}};
  const showView = id => { if(id==='register'){setInitialCase({productKind:filters.productKind==='seat'?'seat':filters.productKind==='accessories'?'other':filters.productKind,brand:filters.productKind==='seat'?'Refinad':''});setModal('add');setMobileNav(false);return;} if (id === 'new') news.markRead(); else news.cancelPendingRead(); setView(id); clearFilters(); setExpanded(false); setMobileNav(false); if (['new', 'launched','shipping','mine','inbox','arrange','development','fitting','approval','numbering'].includes(id)) { setSelectedId(null); setMobileDetail(false); } };
  return <div className={`app-shell ${project ? 'has-detail' : ''} ${expanded ? 'detail-expanded' : ''} ${mobileDetail ? 'mobile-detail-open' : ''}`}>
    <aside className={`sidebar ${mobileNav ? 'mobile-visible' : ''}`} aria-label="メインメニュー"><div className="brand-mark"><img src="/assets/connect-wordmark.png" alt="CAR SHOP CONNECT" /></div><AppNavigation onRegister={()=>showView('register')} view={view} onSelect={showView} unread={{ new: news.unreadCount,inbox:unread }} /><div className="sidebar-bottom">適合・開発管理</div></aside>
    {mobileNav && <button className="nav-backdrop" aria-label="メニューを閉じる" onClick={() => setMobileNav(false)} />}
    <header className="topbar"><button className="icon-button mobile-menu" aria-label="メニューを開く" aria-expanded={mobileNav} onClick={() => setMobileNav(!mobileNav)}><ListIcon size={25} /></button><strong>適合・開発管理</strong><div><span className="sample-tag">フリー操作・サンプル</span><label className="actor-select"><span>操作する担当（サンプル）</span><select aria-label="操作する担当（サンプル）" value={actor} onChange={e=>setActor(e.target.value)}>{OWNERS.map(x=><option key={x}>{x}</option>)}</select></label><time>2026年10月23日 更新</time></div></header>
    <main className="workspace" tabIndex={0}><div className="workspace-heading"><h1>{viewLabel(view)}</h1>{['board','arrange','development','fitting','sales','approval','launched','fitment'].includes(view)&&<ProductScope value={filters.productKind} onChange={kind=>{setFilters({...emptyFilters(),productKind:kind});setSelectedId(null);setMobileDetail(false);setExpanded(false);}}/>}<p>{VIEW_DESCRIPTION[view]}</p></div>
      {view==='board'&&<SheetStatusBar accessories={filters.productKind!=='seat'} projects={projects.filter(p=>matchesProductScope(p,filters.productKind))} value={statusView} onChange={v=>{setStatusView(v);clearFilters();}} sample/>}
      <div className={view==='board'?'progress-utilities':'workspace-notices'}>{view!=='inbox'&&<NoticeStrip unread={unread} onOpen={()=>showView('inbox')}/>}
      {view==='board'&&statusView==='active'&&<WorkActionDesk compact projects={projects.filter(x=>sheetCategory(x)==='active'&&matchesProductScope(x,filters.productKind))} actor={actor} members={OWNERS.map(key=>({key,label:key}))} onOpen={openWork}/>}
      {filters.productKind==='seat'&&!['new','shipping','mine','inbox'].includes(view) && <OfficialNewsNotice news={news} onOpen={() => showView('new')} />}</div>
      {['arrange','sales'].includes(view)&&<div className="phase-tools"><strong>{view==='arrange'?'購入・発送で使うツール':'品番登録・販売準備で使うツール'}</strong><button className="secondary" onClick={()=>showView('numbering')}>品番を登録・発行 →</button><button className="secondary" onClick={()=>showView('shipping')}>中国への荷物追跡 →</button></div>}<WorkspaceControls view={view} filters={filters} setFilters={setFilters} extra={extraFilters} onExtra={()=>setExtraFilters(!extraFilters)} count={visible.length} onAdd={()=>{setInitialCase({productKind:filters.productKind==='seat'?'seat':filters.productKind==='accessories'?'other':filters.productKind,brand:filters.productKind==='seat'?'Refinad':''});setModal('add');}}/>
      {view==='board'&&statusView!=='active'?<SheetCaseList projects={visible.filter(x=>sheetCategory(x)===statusView)} category={statusView} onOpen={selectProject} onClear={clearFilters}/>:view==='mine'?<MyWork projects={projects} actor={actor} query={filters.query} onOpen={openWork}/>:view==='inbox'?<WorkInbox projects={projects} actor={actor} query={filters.query} notices={myNotices} onOpen={openWork} onRead={id=>setWorkNotices(n=>ackNotice(n,id,actor))}/>:view === 'shipping' ? <ShippingBoard projects={projects} query={filters.query} onSelect={id=>{selectProject(id);setTab('shipments');}} onEdit={(id,shipment)=>{setSelectedId(id);setTab('shipments');setEditingShipment(shipment);setModal('shipment');}}/> : view === 'new' ? <NewProducts news={news} projects={projects} query={filters.query} onRegister={draft => { setInitialCase(draft); setModal('add'); }} onSelect={id => { setView('board'); clearFilters(); selectProject(id); }} /> : view === 'launched' ? <LaunchedProducts projects={visible} onSelect={selectProject} onClear={clearFilters} /> : ['board','arrange','development','fitting'].includes(view) ? (view==='board'?<ProgressView projects={visible.filter(x=>sheetCategory(x)==='active')} onOpen={openWork} onClear={clearFilters}><Board key={view} initialStage={view==='arrange'?1:view==='development'?2:view==='fitting'?3:0} projects={view==='arrange'?visible.filter(p=>stageOf(p)===1):view==='fitting'?visible.filter(p=>stageOf(p)===3):view==='development'?visible.filter(p=>stageOf(p)===2):visible.filter(x=>sheetCategory(x)==='active')} selectedId={selectedId} onSelect={openWork} onHold={item => change({ ...item, hold: !item.hold }, `${item.hold ? '保留を解除' : '保留に変更'}しました。`)} onClear={clearFilters} /></ProgressView>:<Board key={view} initialStage={view==='arrange'?1:view==='development'?2:view==='fitting'?3:0} projects={view==='arrange'?visible.filter(p=>stageOf(p)===1):view==='fitting'?visible.filter(p=>stageOf(p)===3):view==='development'?visible.filter(p=>stageOf(p)===2):visible.filter(x=>sheetCategory(x)==='active')} selectedId={selectedId} onSelect={openWork} onHold={item => change({ ...item, hold: !item.hold }, `${item.hold ? '保留を解除' : '保留に変更'}しました。`)} onClear={clearFilters} />) : <Overview projects={visible} view={view} onSelect={id=>{selectProject(id);if(view==='approval')setModal('launch');if(view==='numbering')setModal('fitment');}} onClear={clearFilters} />}
    </main>
    {project && <Detail onResolveSheet={v=>change(resolveSampleSheet(project,v,actor),'確認結果を保存しました。')} actor={actor} onSettings={()=>setModal('settings')} onHandover={()=>setModal('handover')} onWorkflowSave={updated=>change(updated,'引継ぎの記録を更新しました。')} project={project} tab={tab} setTab={setTab} expanded={expanded} onExpand={() => setExpanded(!expanded)} onClose={() => { setSelectedId(null); setExpanded(false); setMobileDetail(false); }} onEdit={task=>{setEditingTask(task?.id||nextTask(project)?.id||null);setModal('tasks');}} onFitment={() => setModal(isProduct(project)?'settings':'fitment')} onNote={() => setModal('note')} onDevelopment={() => setModal('development')} onShipment={shipment => { setEditingShipment(shipment); setModal('shipment'); }} onAfterLaunch={() => {setEditingTask(project.afterLaunchTasks.find(t=>t.status!=='done')?.id||project.afterLaunchTasks[0]?.id);setModal('tasks');}} onLaunch={() => setModal('launch')} />}
    {modal === 'tasks' && project && [...project.tasks,...project.afterLaunchTasks].find(t=>t.id===editingTask) && <GuidedTaskDialog key={project.id+':'+editingTask} project={project} task={[...project.tasks,...project.afterLaunchTasks].find(t=>t.id===editingTask)} after={project.afterLaunchTasks.some(t=>t.id===editingTask)} actor={actor} manager canEdit members={OWNERS.map(key=>({key,label:key}))} onClose={closeModal} onOpenTask={t=>setEditingTask(t.id)} onRoute={route=>{closeModal();if(route==='handover')setTab('flow');else if(route==='approval')setModal('launch');else if(route==='settings')setModal('settings');else if(route==='shipping')setTab('shipments');else if(route==='after'){setEditingTask(project.afterLaunchTasks.find(t=>t.status!=='done')?.id||project.afterLaunchTasks[0]?.id);setModal('tasks');}else setTab(route);}} onSave={async(intent,d,h)=>{const updated=intent==='handover'?completeAndHandover(project,editingTask,d,h,actor,currentDate(),{admin:true}):(project.afterLaunchTasks.some(t=>t.id===editingTask)?applyAfterLaunch(project,{[editingTask]:{...d,status:intent==='complete'?'done':d.status}},currentDate()):applyTasks(project,{[editingTask]:{...d,status:intent==='complete'?'done':d.status}},currentDate(),actor));change(updated,intent==='handover'?'作業を完了し、次の担当へ引継ぎを依頼しました。':intent==='complete'?'作業を完了しました。':'作業内容を保存しました。',{keepOpen:true});return updated;}}/>}
    {modal === 'settings' && project && <CaseSettings project={project} projects={projects} actor={actor} onClose={closeModal} onSave={updated=>change(updated,'案件の設定を更新しました。')} />}
    {modal === 'handover' && project && <HandoverEditor project={project} actor={actor} onClose={closeModal} onSave={updated=>{change(updated,'担当へ引継ぎを依頼しました。');setTab('flow');}} />}
    {modal === 'fitment' && project && <FitmentEditor project={project} projects={projects} onClose={closeModal} onSave={(fitment, sku, fakeSku) => {
      const salesChanged = sku !== project.sku || Object.keys(fitment).some(key => fitment[key] !== project.fitment[key]);
      if (!salesChanged && fakeSku === project.fakeSku) { closeModal(); return; }
      const values = { ...project, fitment, sku, fakeSku };
      const updated = salesChanged ? requireLaunchReview(values) : values;
      change(updated, `品番・適合情報を更新しました。${salesChanged && updated.launch?.status === 'needs-review' ? '発売の再確認が必要です。' : ''}`);
    }} />}
    {modal === 'launch' && project && <LaunchEditor actor={actor} project={project} onClose={closeModal} onSave={updated => change(updated, updated.launch.status==='confirmed'?'販売開始を承認し、全員へお知らせしました。':'最終確認者へ承認を依頼しました。')} />}
    {modal === 'note' && project && <NoteEditor onClose={closeModal} onSave={text => change({ ...project, notes: [...project.notes, { date: TODAY, text }] }, 'メモを追加しました。')} />}
    {modal === 'development' && project && <DevelopmentEditor project={project} onClose={closeModal} onSave={values => {
      const purchase = values.developmentMethod === 'purchase';
      const updated = { ...project, ...values, tasks: project.tasks.map(task => task.id === 'arrange' ? { ...task, name: purchase ? '他社製品の購入・受取' : '現車・仕様の確認', description: purchase ? '型取り用の他社製品を購入し、対象仕様と受け取りを確認してください。' : '現車の手配と車両仕様を確認してください。' } : task) };
      change(updated, '型取り情報を更新しました。');
    }} />}
    {modal === 'shipment' && project && <ShipmentEditor project={project} shipment={editingShipment} onClose={closeModal} onSave={shipment => {
      change(applyShipment(project,shipment,actor), `発送記録を${shipment.id ? '更新' : '追加'}しました。`);
    }} />}
    {modal === 'afterLaunch' && project && <AfterLaunchEditor project={project} onClose={closeModal} onSave={updated => change(updated, '販売開始後の確認を更新しました。')} />}
    {modal === 'add' && <AddCase actor={actor} initialValues={{owner:actor,...initialCase}} projects={projects} onClose={closeModal} onSave={values => { const id = `C-${String(Math.max(...projects.map(p => Number(p.id.slice(2)))) + 1).padStart(3, '0')}`; const created = {...newProject({...values,flowVersion:2,needsChina:isProduct(values)?!!values.needsChina:values.developmentMethod==='purchase'||values.needsChina,createdBy:actor}, id,actor),reviewer:values.reviewer||'',approvals:[]}; setProjects(current => [...current, created]); setFilters(emptyFilters(isProduct(created)?created.productKind:'seat'));setStatusView('active'); setView('board'); selectProject(id); closeModal(); setToast(values.owner?'案件を登録しました。次の作業から入力を続けられます。':`サンプル担当を${actor}に仮設定して登録しました。次の作業へ進めます。`);setEditingTask(created.tasks.find(t=>t.required!==false&&t.status!=='done')?.id);setModal('tasks'); }} />}
    <div className="toast-region" role="status" aria-live="polite">{toast && <div className="toast"><CheckCircleIcon size={20} weight="fill" /><span>{toast}</span><button className="icon-button" aria-label="通知を閉じる" onClick={() => setToast('')}><XIcon size={16} /></button></div>}</div>
  </div>;
}
