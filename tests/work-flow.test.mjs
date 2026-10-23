import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject} from '../src/sample-data.mjs';
import {boardStageOf,BOARD_STAGES} from '../src/workflow.mjs';
import {makeDetailedTasks,workGroups,taskBlockers} from '../src/work-flow.mjs';
const base={registrationType:'new',developmentMethod:'purchase',car:'確認車種',owner:'担当A',salesChannels:['main']};
test('承認待ちは販売準備と販売中の間に独立表示し保存stageを変えない',()=>{
 const p=newProject(base,'TEST');p.tasks=p.tasks.map(t=>({...t,status:'done'}));p.launch.status='approval-pending';
 assert.deepEqual(BOARD_STAGES,['案件登録','購入・発送','開発・試作','品質・適合確認','品番登録・販売準備','販売開始の承認','販売開始']);assert.equal(boardStageOf(p),5);p.launch.status='confirmed';assert.equal(boardStageOf(p),6);
});
test('新規購入は発送とHPカテゴリ、既存自社はそれらを不要として扱う',()=>{
 const a=makeDetailedTasks(base);const b=makeDetailedTasks({...base,registrationType:'existing',developmentMethod:'own'});
 assert(a.some(t=>t.id==='factory-receive'&&t.required));assert(a.some(t=>t.id==='hp-category'&&t.required));assert(!b.some(t=>t.id==='factory-receive'&&t.required));assert(!b.some(t=>t.id==='hp-category'&&t.required));
});
test('受取を完了しても工場確認が済むまで型取り完了を拒否する',()=>{
 const p={...base,tasks:makeDetailedTasks(base)};p.tasks.find(t=>t.id==='arrange').status='done';assert(taskBlockers(p,p.tasks.find(t=>t.id==='sample')).some(x=>x.includes('工場')));
});
test('HPカテゴリは開発が未完了でも先に作業できる',()=>{
 const p={...base,tasks:makeDetailedTasks(base)};assert.deepEqual(taskBlockers(p,p.tasks.find(t=>t.id==='hp-category')),[]);
});
test('担当未割当・引継ぎ受領待ちを完了の妨げとして示す',()=>{
 const p={...base,tasks:makeDetailedTasks(base)};const t=p.tasks.find(t=>t.id==='plan');t.owner='';assert(taskBlockers(p,t).some(x=>x.includes('担当')));t.owner='担当B';t.handover={status:'pending'};assert(taskBlockers(p,t).some(x=>x.includes('受領')));
});
test('12分類は承認と発売後も含みCSV変換の確認を別のチェックにする',()=>{
 const p={...base,tasks:makeDetailedTasks(base),afterLaunchTasks:[],launch:{status:'pending'}};assert.equal(workGroups(p).length,12);assert(p.tasks.some(t=>t.id==='csv-test'));assert(p.tasks.some(t=>t.id==='order'));
});
