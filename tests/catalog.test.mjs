import test from 'node:test';
import assert from 'node:assert/strict';
import * as catalog from '../src/catalog.mjs';
import * as feed from '../worker/clazzio-feed.mjs';
import { SAMPLE_PROJECTS } from '../src/sample-data.mjs';

const card = (title, date, href, detail = '') => `<article class="news-category-card"><span class="news-category-card-date">${date}</span><span class="news-category-card-vehicle"><a href="${href}">${title}</a></span><span class="news-category-card-detail-value">${detail}</span></article>`;
const fixture = card('シートカバー追加車種：ET-1667 トヨタ：アルファード', '2026/10/05', 'https://www.11i.co.jp/news/test-1') + card('フロアマット追加車種：ET-1667', '2026/10/05', 'https://www.11i.co.jp/news/test-2') + card('シートカバー追加車種：エブリィ', '2026/09/14', '/news/test-3', 'R8/5～DA18WES-6083Jr. 販売開始');

test('extracts only official seat-cover articles and codes, newest first', () => {
  assert.equal(typeof feed.parseClazzioNews, 'function');
  const items = feed.parseClazzioNews(fixture);
  assert.equal(items.length, 2);
  assert.equal(items[0].publishedAt, '2026-10-05');
  assert.deepEqual(items[0].codes, ['ET-1667']);
  assert.deepEqual(items[1].codes, ['ES-6083']);
  assert.equal(items[1].url, 'https://www.11i.co.jp/news/test-3');
});

test('rejects unexpected upstream markup instead of reporting zero new products', () => {
  assert.equal(typeof feed.parseClazzioNews, 'function');
  assert.throws(() => feed.parseClazzioNews('<html>maintenance</html>'));
  assert.equal(feed.parseClazzioNews(card('フロアマット', '2026/10/05', '/news/test')).length, 0);
});

test('omits invalid dates, script links, other origins and duplicate articles', () => {
  assert.equal(typeof feed.parseClazzioNews, 'function');
  const html = fixture + fixture + card('シートカバー', '2026/02/30', '/news/bad') + card('シートカバー', '2026/10/05', 'javascript:alert(1)') + card('シートカバー', '2026/10/05', 'https://example.test/news/leak');
  assert.equal(feed.parseClazzioNews(html).length, 2);
});

test('listed sales exclude unfinished and held cases and use latest launch date', () => {
  assert.equal(typeof catalog.listLaunched, 'function');
  const sales = catalog.listLaunched(SAMPLE_PROJECTS);
  assert.deepEqual(sales.map(p => p.id), ['C-011', 'C-012']);
  assert.equal(catalog.launchDate(sales[0]), '2026-10-06');
  assert.equal(catalog.listLaunched([{ ...sales[0], hold: true }]).length, 0);
});

test('a competitor code must not be compared to our own SKU or assumed absent from DB', () => {
  assert.equal(typeof catalog.linkedProject, 'function');
  const item = { id: 'source-1', codes: ['ET-1667'] };
  assert.equal(catalog.linkedProject(item, [{ id: 'C-001', sku: 'ET-1667' }]), undefined);
  assert.equal(catalog.linkedProject(item, [{ id: 'C-002', competitorSourceId: 'source-1' }]).id, 'C-002');
});

test('purchase draft keeps competitor code separate from the new sales SKU', () => {
  assert.equal(typeof catalog.purchaseDraft, 'function');
  const draft = catalog.purchaseDraft({ id: 'source-1', title: 'シートカバー追加車種：ET-1667 トヨタ：アルファード', codes: ['ET-1667'], url: 'https://www.11i.co.jp/news/test' });
  assert.equal(draft.developmentMethod, 'purchase');
  assert.equal(draft.manufacturer, 'トヨタ');
  assert.equal(draft.car, 'アルファード');
  assert.equal(draft.sku, '');
  assert.equal(draft.competitorSourceId, 'source-1');
  assert.match(draft.purchaseProduct, /ET-1667/);
});

const savedFeed = checkedAt => ({items:feed.parseClazzioNews(fixture),checkedAt,sourceUrl:feed.CLAZZIO_NEWS_URL,pollIntervalHours:24,status:'ok',warning:''});
test('workers deduplicate saved-feed reads and never request the official site', async () => {
  let calls = 0, time = Date.parse('2026-10-08T06:00:00Z');
  const getFeed = feed.createClazzioFeed(async (url) => { assert.equal(url,feed.CENTRAL_FEED_URL);calls++; return Response.json(savedFeed(new Date(time).toISOString())); }, () => time);
  const [first, second] = await Promise.all([getFeed(), getFeed()]);
  assert.equal(calls, 1);
  assert.equal(first, second);
  time += 4 * 60 * 1000;
  assert.equal((await getFeed()).checkedAt, first.checkedAt);
  time += 60 * 1000;
  assert.notEqual((await getFeed()).checkedAt, first.checkedAt);
  assert.equal(calls, 2);
});

test('saved-feed failure is not cached as an empty successful official update', async () => {
  let calls = 0;
  const getFeed = feed.createClazzioFeed(async () => { calls++; return calls === 1 ? new Response('unavailable', { status: 503 }) : Response.json(savedFeed('2026-10-08T06:00:00Z')); });
  await assert.rejects(getFeed());
  assert.equal((await getFeed()).items.length, 2);
  assert.equal(calls, 2);
});

test('uses a redirect mode supported by the edge and rejects redirects', async () => {
  const getFeed = feed.createClazzioFeed(async (url, options) => {
    assert.equal(options.redirect, 'manual');
    return new Response(null, { status: 302, headers: { Location: 'https://other.test/' } });
  });
  await assert.rejects(getFeed(), /HTTP 302/);
});

test('separate worker instances only read the same central daily feed', async () => {
  const urls=[];const read=async url=>{urls.push(url);return Response.json({...savedFeed('2026-10-08T06:00:00Z'),privatePassword:'must be dropped'});};
  const results=await Promise.all([feed.createClazzioFeed(read)(),feed.createClazzioFeed(read)()]);
  assert.deepEqual(urls,[feed.CENTRAL_FEED_URL,feed.CENTRAL_FEED_URL]);
  assert.equal(results[0].checkedAt,results[1].checkedAt);assert.equal(results[0].privatePassword,undefined);
});
test('unexpected sources and unsafe article URLs cannot reach the frontend', async () => {
  for(const data of [{...savedFeed('2026-10-08T06:00:00Z'),sourceUrl:'https://other.example/'},{...savedFeed('2026-10-08T06:00:00Z'),items:[{...savedFeed('').items[0],url:'javascript:alert(1)'}]}]) {
    await assert.rejects(feed.createClazzioFeed(async()=>Response.json(data))());
  }
});
test('official failure keeps the prior timestamp and warning supplied by the daily store', async () => {
  const old=savedFeed('2026-10-08T06:00:00Z');const result=await feed.createClazzioFeed(async()=>Response.json({...old,status:'error',warning:'次の日に再確認します。'}))();
  assert.equal(result.checkedAt,old.checkedAt);assert.equal(result.status,'error');assert.equal(result.items.length,2);assert.match(result.warning,/次の日/);
});
test('initial pending saved feeds are rechecked without waiting five minutes', async () => {
  let time=Date.parse('2026-10-08T06:00:00Z'),calls=0;
  const getFeed=feed.createClazzioFeed(async url=>{assert.equal(url,feed.CENTRAL_FEED_URL);calls++;return Response.json(calls===1?{...savedFeed(''),items:[],status:'pending'}:savedFeed('2026-10-08T06:00:30Z'));},()=>time);
  assert.equal((await getFeed()).status,'pending');time+=29000;await getFeed();assert.equal(calls,1);time+=1000;assert.equal((await getFeed()).items.length,2);assert.equal(calls,2);
});
