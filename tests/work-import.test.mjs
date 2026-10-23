import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importRows} from '../src/work-import.mjs';
test('CSV quoted fields, commas, newlines and BOM preserve source IDs',()=>{
  const rows=importRows('\uFEFF元データID,メーカー,車種,自社品番,登録区分,型取り方法,追加先ID\r\nold-1,トヨタ,"検証,車種",T0022-01,既存,購入,base-1\r\nold-2,ホンダ,"検証\n車種",,新規,自社,');
  assert.equal(rows.length,2);assert.equal(rows[0].car,'検証,車種');assert.equal(rows[0].registrationType,'existing');assert.equal(rows[1].car,'検証\n車種');
});
test('TSV requires explicit classification and rejects duplicate or excessive rows',()=>{
  assert.equal(importRows('id-1\tトヨタ\t検証車種\t\t新規\t購入').length,1);
  assert.throws(()=>importRows('id-1\tトヨタ\t検証車種'),/登録区分/);
  assert.throws(()=>importRows('id-1\tトヨタ\t検証車種\t\t既存\t購入'),/追加先/);
  assert.throws(()=>importRows(Array(2).fill('id-1\tトヨタ\t検証車種\t\t新規\t購入').join('\n')),/重複/);
  assert.throws(()=>importRows(Array.from({length:101},(_,i)=>`${i}\tトヨタ\t車種\t\t新規\t購入`).join('\n')),/100/);
  assert.throws(()=>importRows('id,トヨタ,"未閉じ'),/閉じ/);
});
