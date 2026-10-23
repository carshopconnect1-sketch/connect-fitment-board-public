import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { newProject } from '../src/sample-data.mjs';
import { applyTasks } from '../src/workflow.mjs';

let vite, Board;
before(async () => {
  vite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, watch: null } });
  ({ Board } = await vite.ssrLoadModule('/src/components.jsx'));
});
after(async () => { await vite?.close(); });

test('カードの今の担当は案件責任者ではなく次の作業の担当を示す',()=>{
  const p=newProject({manufacturer:'トヨタ',car:'担当確認',owner:'担当A'},'C-991');
  p.tasks[0].owner='担当B';
  const html=renderToStaticMarkup(React.createElement(Board,{projects:[p],onSelect(){},onHold(){},onClear(){}}));
  assert.match(html,/<dt>今の担当<\/dt><dd>担当B<\/dd>/);
});

for (const [method, expected] of [['purchase', '他社製品の購入・受取'], ['own', '現車・仕様の確認']]) {
  test(`ボードの次の作業は${method}ルートの個別詳細と一致する`, () => {
    const project = applyTasks(newProject({ make: 'Toyota', manufacturer: 'トヨタ', car: '確認車種', owner: '担当A', developmentMethod: method }, 'C-990'), { plan: { status: 'done' } });
    const html = renderToStaticMarkup(React.createElement(Board, { projects: [project], selectedId: project.id, onSelect() {}, onHold() {}, onClear() {} }));
    assert.match(html, new RegExp(`<dd[^>]*>${expected}</dd>`));
  });
}
