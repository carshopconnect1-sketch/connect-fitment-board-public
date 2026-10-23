import test from 'node:test';import assert from 'node:assert/strict';import {noticePresentation,groupNotices} from '../src/work-notices.mjs';
const n=(id,kind,caseId='1',read=false)=>({id,kind,caseId,read,at:`2026-10-13T00:00:0${id}Z`});
test('受領や承認の通知は具体的な作業画面へ進める',()=>{assert.equal(noticePresentation(n('1','handover')).route,'handover');assert.equal(noticePresentation(n('1','launch_requested')).route,'approval');assert.equal(noticePresentation(n('1','launch_approved')).category,'sales');});
test('同一案件の通常更新をまとめても未読と個々の履歴を保つ',()=>{const g=groupNotices([n('1','note','1',true),n('2','fitment'),n('3','note','2')],'updates');assert.equal(g.length,2);assert.equal(g[1].events.length,2);assert.equal(g[1].read,false);assert.equal(g[1].id,'2');});
test('承認依頼と受領依頼は更新のまとめに埋め込まない',()=>{const rows=[n('1','note'),n('2','handover'),n('3','launch_requested')];assert.equal(groupNotices(rows).length,2);assert.equal(groupNotices(rows,'updates').length,1);});
