const normalize = value => String(value || '').normalize('NFKC').trim().toUpperCase();
const codesOf = project => [project.sku, project.fakeSku].map(normalize).filter(Boolean);

export function skuIssues(draft, projects, excludeId) {
  const issues = [];
  const used = new Set(projects.filter(project => project.id !== excludeId).flatMap(codesOf));
  for (const [key, label] of [['sku', '自社品番'], ['fakeSku', 'フェイク品番']]) {
    if (/^DEMO-(NEW|FAKE)-/.test(normalize(draft[key]))) issues.push(`${label}に確認用の仮番号は使えません。正式な品番を入力してください。`);
    if (normalize(draft[key]) && used.has(normalize(draft[key]))) issues.push(`${label}は別の案件で使用されています。`);
  }
  if (normalize(draft.sku) && normalize(draft.sku) === normalize(draft.fakeSku)) issues.push('自社品番とフェイク品番には別の品番を入力してください。');
  return issues;
}
