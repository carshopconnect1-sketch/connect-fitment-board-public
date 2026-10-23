import test from 'node:test';
import assert from 'node:assert/strict';
import { skuIssues } from '../src/sku.mjs';

test('手入力は別案件・別欄・全角の同じ品番を保存しない', () => {
  const projects = [{ id: 'A', sku: 'NEW-001', fakeSku: 'CHINA-001' }];
  assert.ok(skuIssues({ sku: 'ｎｅｗ-００１', fakeSku: '' }, projects).length);
  assert.ok(skuIssues({ sku: '', fakeSku: 'NEW-001' }, projects).length);
  assert.ok(skuIssues({ sku: 'CHINA-001', fakeSku: '' }, projects).length);
});
test('中国向け品番の重複は用途が分かる名前で表示する', () => {
  const projects = [{ id: 'A', sku: 'NEW-001', fakeSku: 'CHINA-001' }];
  assert.match(skuIssues({ fakeSku: 'china-001' }, projects)[0], /フェイク品番/);
});
test('同じ案件の自社品番と中国向け品番を混同しない', () => {
  assert.ok(skuIssues({ sku: 'SAME', fakeSku: 'same' }, []).length);
  assert.deepEqual(skuIssues({ sku: '', fakeSku: '' }, []), []);
});
test('既存案件の品番を変更せず編集できる', () => {
  const projects = [{ id: 'A', sku: 'NEW-001', fakeSku: 'CHINA-001' }];
  assert.deepEqual(skuIssues(projects[0], projects, 'A'), []);
});
test('旧確認版のDEMO番号を自社・中国向けの正式品番として保存しない', () => {
  for (const key of ['sku', 'fakeSku']) {
    for (const value of ['DEMO-NEW-0001', 'ｄｅｍｏ-ｆａｋｅ-０００１']) {
      assert.match(skuIssues({ [key]: value }, [])[0], /確認用の仮番号/);
    }
  }
});
test('品番の確認は入力値・元案件を変更しない', () => {
  const draft = { sku: 'NEW-001', fakeSku: 'CHINA-001' };
  const before = structuredClone(draft);
  assert.deepEqual(skuIssues(draft, []), []);
  assert.deepEqual(draft, before);
});
