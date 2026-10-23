import {primaryCases,sheetSaleDate} from './sheet-status.mjs';
import { stageOf } from './workflow.mjs';

export const NEWS_READ_KEY = 'connect-clazzio-read-v1';
const newsRevision = item => JSON.stringify([item.title, item.publishedAt, [...(item.codes || [])].sort(), item.url]);
export function unreadNews(items, read) {
  const unique = new Map(items.map(item => [item.id, item]));
  return [...unique.values()].filter(item => read[item.id] !== newsRevision(item));
}
export function acknowledgeNews(items, read) {
  const entries = new Map(Object.entries(read));
  for (const item of items) { entries.delete(item.id); entries.set(item.id, newsRevision(item)); }
  return Object.fromEntries([...entries].slice(-200));
}
export function parseNewsReadState(value) {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([key, revision]) => key.length <= 1000 && typeof revision === 'string' && revision.length <= 10000).slice(-200));
  } catch { return {}; }
}

export function launchDate(project) {
  if (stageOf(project) !== 5) return '';
  return sheetSaleDate(project);
}
export function listLaunched(projects) {
  return primaryCases(projects).filter(project => stageOf(project) === 5 && !project.hold)
    .sort((a, b) => launchDate(b).localeCompare(launchDate(a)) || a.id.localeCompare(b.id));
}
export function linkedProject(item, projects) {
  return projects.find(project => project.competitorSourceId === item.id);
}
export function purchaseDraft(item) {
  const label = item.title.replace(/^シートカバー(?:追加車種|新商品)?\s*[：:]?\s*/, '').replace(/\bE[A-Z]-\d{4}(?:-\d{2})?\b/g, '').replace(/^[\s：:]+/, '').trim();
  const maker = [['TOYOTA', 'トヨタ'], ['HONDA', 'ホンダ'], ['NISSAN', '日産'], ['SUZUKI', 'スズキ'], ['MAZDA', 'マツダ'], ['トヨタ', 'トヨタ'], ['ホンダ', 'ホンダ'], ['ニッサン', '日産'], ['日産', '日産'], ['スズキ', 'スズキ'], ['マツダ', 'マツダ']].find(([name]) => label.toUpperCase().startsWith(name));
  return { manufacturer: maker?.[1] || 'その他', car: maker ? label.slice(maker[0].length).replace(/^[\s：:]+/, '').trim() : label,
    sku: '', developmentMethod: 'purchase', purchaseSource: 'クラッツィオ', purchaseProduct: `${item.codes.join(' / ') || '品番要確認'} · ${label}`,
    competitorSourceId: item.id, competitorCodes: item.codes, competitorUrl: item.url };
}
