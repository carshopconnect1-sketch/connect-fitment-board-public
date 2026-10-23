import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject} from '../src/sample-data.mjs';
import {applyTasks,stageOf} from '../src/workflow.mjs';
import {completeAndHandover} from '../src/guided-completion.mjs';

const values={flowVersion:2,manufacturer:'ホンダ',car:'フリー操作確認',registrationType:'new',developmentMethod:'own',owner:'',due:'2026-10-23',salesChannels:['main']};
const handover={taskId:'candidate',to:'担当B',due:'2026-10-26',context:'対象仕様を確認済み。重複を確認してください。'};

test('a demo registration with no owner can complete registration and reach purchasing',()=>{
 let p=newProject(values,'FREE-001','担当A');
 assert.equal(p.owner,'担当A');
 assert(p.tasks.every(t=>t.owner==='担当A'));
 for(const task of p.tasks.filter(t=>t.required!==false&&t.stage===0)){
  p=applyTasks(p,{[task.id]:{status:'done',note:'サンプルの仕様・重複・担当を確認済み'}},'2026-10-23','担当A');
 }
 assert.equal(stageOf(p),1);
 assert.equal(newProject(values,'STRICT').owner,'');
});

test('free demo handover records the acting employee without changing the assigned owner',()=>{
 const p=newProject({...values,owner:'担当B'},'FREE-002','担当A');
 const draft={owner:'担当B',note:'対象仕様を確認済み'};
 assert.throws(()=>completeAndHandover(p,'plan',draft,handover,'担当A','2026-10-23'),/担当者または案件責任者/);
 const q=completeAndHandover(p,'plan',draft,handover,'担当A','2026-10-23',{admin:true});
 assert.equal(q.owner,'担当B');
 assert.equal(q.tasks.find(t=>t.id==='plan').completedBy,'担当A');
 assert.equal(q.tasks.find(t=>t.id==='candidate').handover.from,'担当A');
 assert.equal(q.tasks.find(t=>t.id==='candidate').handover.status,'pending');
 assert.equal(p.tasks.find(t=>t.id==='plan').status,'todo');
});

test('free editing still requires evidence, prerequisites and recipient acceptance',()=>{
 const p=newProject({...values,owner:'担当B'},'FREE-003','担当A');
 assert.throws(()=>completeAndHandover(p,'plan',{owner:'担当B',note:''},handover,'担当A','2026-10-23',{admin:true}),/確認結果/);
 assert.throws(()=>completeAndHandover(p,'intake',{owner:'担当B',note:'担当を確認'},handover,'担当A','2026-10-23',{admin:true}),/未完了/);
 const q=completeAndHandover(p,'plan',{owner:'担当B',note:'仕様確認済み'},handover,'担当A','2026-10-23',{admin:true});
 assert.throws(()=>applyTasks(q,{candidate:{status:'done',note:'確認済み'}},'2026-10-23','担当B'),/受領/);
});
