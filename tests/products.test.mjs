import test from 'node:test';
import assert from 'node:assert/strict';
import {entryIssues,entrySummary} from '../src/entry-form.mjs';
import {newProject} from '../src/sample-data.mjs';
import {taskBlockers} from '../src/work-flow.mjs';
import {launchIssues} from '../src/launch.mjs';
import {filterProjects} from '../src/workflow.mjs';
import {matchesProductScope} from '../src/products.mjs';

const draft={productKind:'neck',productName:'低反発ネックパッド',productSpec:'汎用／黒・ベージュ／2個セット',developmentMethod:'own',manufacturer:'',car:'',owner:'担当A',reviewer:'担当B',due:'2026-10-20',salesChannels:['main'],brand:'Sandii'};
test('既存シートの案件とその他商品は一覧・検索で混在しない',()=>{const seat=newProject({car:'既存車種'},'S');const item=newProject({...draft,flowVersion:2},'P');assert.equal(matchesProductScope(seat),true);assert.equal(matchesProductScope(item),false);assert.deepEqual(filterProjects([seat,item],{productKind:'seat'}).map(p=>p.id),['S']);assert.deepEqual(filterProjects([seat,item],{productKind:'accessories'}).map(p=>p.id),['P']);assert.deepEqual(filterProjects([seat,item],{productKind:'accessories',query:'ベージュ'}).map(p=>p.id),['P']);});
test('汎用商品はメーカー・車種・新規車種区分なしで登録できる',()=>{
 assert.deepEqual(entryIssues(draft,0),{});assert.deepEqual(entryIssues(draft,1),{});
 assert.ok(entryIssues({...draft,productName:''},0).productName);
 assert.ok(entrySummary(draft).some(([k,v])=>k==='商品名'&&v===draft.productName));
});
test('新商品は専用の作業を持ち、適合DB・車両・中国発送を勝手に要求しない',()=>{
 const p=newProject({...draft,flowVersion:2},'P-001');
 assert.equal(p.car,draft.productName);assert.equal(p.productName,draft.productName);
 assert.equal(p.needsChina,false);assert.equal(p.tasks.some(t=>['table','vehicle-setup','fitting','china-number','factory-receive'].includes(t.id)),false);
 assert.ok(p.tasks.some(t=>t.id==='product-quality'));assert.ok(p.tasks.some(t=>t.id==='product-sample'));
 assert.ok(p.tasks.every(t=>t.status==='todo'));assert.equal(p.launch.status,'pending');
});
test('既製品仕入れは試作を要求せず、中国への発送は明示選択時だけ追加する',()=>{
 const p=newProject({...draft,productKind:'steering',developmentMethod:'purchase',flowVersion:2},'P-002');
 assert.equal(p.tasks.some(t=>t.id==='product-sample'),false);assert.equal(p.needsChina,false);
 const china=newProject({...draft,needsChina:true,flowVersion:2},'P-003');
 assert.ok(china.tasks.some(t=>t.id==='factory-receive'));assert.equal(china.tasks.some(t=>t.id==='china-number'),false);
});
test('品質確認は前作業と証拠が必要で、商品は品番と仕様なしでは発売できない',()=>{
 const p=newProject({...draft,flowVersion:2},'P-004');const quality=p.tasks.find(t=>t.id==='product-quality');
 assert.ok(taskBlockers(p,quality,{completion:true}).length>0);
 const done={...p,sku:'NP-001',tasks:p.tasks.map(t=>({...t,status:'done',note:'確認済み',referenceUrl:'https://example.com/product'}))};
 assert.equal(launchIssues(done).length,0);
 assert.ok(launchIssues({...done,sku:''}).some(x=>x.includes('品番')));
 assert.ok(launchIssues({...done,productSpec:''}).some(x=>x.includes('仕様')));
 assert.ok(launchIssues({...done,tasks:done.tasks.map(t=>t.id===quality.id?{...t,status:'todo'}:t)}).length>0);
});
