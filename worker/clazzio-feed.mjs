export const CLAZZIO_NEWS_URL = 'https://www.11i.co.jp/news?category=product_info';
export const CENTRAL_FEED_URL = 'https://m-connect.co.jp/wp-json/connect-fitment-news/v1/feed';
const CACHE_MS = 5 * 60 * 1000;
function plainText(value) {
  return value.replace(/<[^>]*>/g, '').replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex, dec) => {
    const code = parseInt(hex || dec, hex ? 16 : 10);
    return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  }).replace(/&(?:nbsp|amp|quot|lt|gt|apos);/g, entity => ({ '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&apos;': "'" })[entity]).replace(/\s+/g, ' ').trim();
}
export function parseClazzioNews(html) {
  const cards = [...html.matchAll(/<article\b[^>]*class=["'][^"']*\bnews-category-card\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/g)];
  if (!cards.length) throw new Error('公式ページの表示形式を確認できませんでした。');
  const items = new Map();
  for (const [, card] of cards.slice(0, 10)) {
    const date = card.match(/class=["']news-category-card-date["'][^>]*>([\s\S]*?)<\/span>/)?.[1]?.trim().replaceAll('/', '-');
    const titleAnchor = card.match(/class=["']news-category-card-vehicle["'][^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/);
    if (!titleAnchor || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) continue;
    const parsedDate = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) continue;
    const title = plainText(titleAnchor[2]).slice(0, 240);
    if (!title.includes('シートカバー')) continue;
    let url;
    try { url = new URL(plainText(titleAnchor[1]), CLAZZIO_NEWS_URL); } catch { continue; }
    if (url.origin !== 'https://www.11i.co.jp' || !url.pathname.startsWith('/news/') || url.username || url.password) continue;
    const detail = plainText(card.match(/class=["']news-category-card-detail-value["'][^>]*>([\s\S]*?)<\/span>/)?.[1] || '');
    const codes = [...new Set(`${title} ${detail}`.normalize('NFKC').match(/E[A-Z]-\d{4}(?:-\d{2})?(?!\d)/g) || [])];
    items.set(url.href, { id: url.href, url: url.href, title, codes, publishedAt: date });
  }
  return [...items.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function createClazzioFeed(fetcher = fetch, now = () => Date.now()) {
  let cached, inFlight;
  return async function getFeed() {
    const ttl = cached?.status === 'pending' || cached?.status === 'checking' ? 30000 : CACHE_MS;
    if (cached && now() - Date.parse(cached.savedAt) < ttl) return cached;
    if (!inFlight) inFlight = (async () => {
      // m-connect owns the only daily official request; workers only read its saved result.
      const response = await fetcher(CENTRAL_FEED_URL, { signal: AbortSignal.timeout(10000), redirect: 'manual', headers: { accept: 'application/json' }, cf: { cacheTtl: 300 } });
      if (!response.ok) throw new Error(`Saved Clazzio feed: HTTP ${response.status}`);
      const body = await response.text();
      if (body.length > 100000) throw new Error('保存済み情報を確認できませんでした。');
      const data = JSON.parse(body);
      if (data.sourceUrl !== CLAZZIO_NEWS_URL || data.pollIntervalHours !== 24 || !Array.isArray(data.items) || data.items.length > 10) throw new Error('保存済み情報を確認できませんでした。');
      const items = data.items.map(item => {
        const url = new URL(item.url);
        if (url.origin !== 'https://www.11i.co.jp' || !url.pathname.startsWith('/news/') || url.username || url.password || typeof item.title !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.publishedAt) || !Array.isArray(item.codes) || item.codes.some(code => !/^E[A-Z]-\d{4}(?:-\d{2})?$/.test(code))) throw new Error('保存済み情報を確認できませんでした。');
        return { id: url.href, url: url.href, title: item.title.slice(0,240), codes: item.codes.slice(0,20), publishedAt: item.publishedAt };
      });
      cached = { items, checkedAt: data.checkedAt || '', nextCheckAt: data.nextCheckAt || '', sourceUrl: CLAZZIO_NEWS_URL, scope: '公式の最新情報10件', pollIntervalHours: 24, status: data.status, warning: typeof data.warning === 'string' ? data.warning.slice(0,400) : '', savedAt: new Date(now()).toISOString() };
      return cached;
    })().finally(() => { inFlight = undefined; });
    return inFlight;
  };
}
const getFeed = createClazzioFeed();
export async function clazzioFeedResponse(request) {
  if (request.method !== 'GET') return Response.json({ error: '読み取り専用です。' }, { status: 405, headers: { Allow: 'GET' } });
  try { return Response.json(await getFeed(), { headers: { 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' } }); }
  catch (error) {
    console.error('Clazzio feed failed', error.name, error.message);
    return Response.json({ error: error.name === 'TimeoutError' ? '公式情報の取得がタイムアウトしました。' : '公式情報を取得できませんでした。公式ページで確認してください。' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
