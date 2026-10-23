import test from 'node:test';
import assert from 'node:assert/strict';
import * as news from '../src/catalog.mjs';

const first = { id: 'article-1', title: 'シエンタ', publishedAt: '2026-10-05', codes: ['ET-1680'], url: 'https://www.11i.co.jp/news/article-1' };
const second = { ...first, id: 'article-2', title: 'フリード', url: 'https://www.11i.co.jp/news/article-2' };

test('new articles stay unread until acknowledged; later additions become unread again', () => {
  assert.equal(typeof news.unreadNews, 'function');
  assert.equal(typeof news.acknowledgeNews, 'function');
  assert.deepEqual(news.unreadNews([first], {}), [first]);
  const seen = news.acknowledgeNews([first], {});
  assert.deepEqual(news.unreadNews([first], seen), []);
  assert.deepEqual(news.unreadNews([second, first], seen), [second]);
});

test('changed article content becomes unread, but repeated fetches and code reordering do not', () => {
  assert.equal(typeof news.acknowledgeNews, 'function');
  const item = { ...first, codes: ['ET-1680', 'ET-1681'] };
  const seen = news.acknowledgeNews([item], {});
  assert.deepEqual(news.unreadNews([{ ...item, codes: [...item.codes].reverse(), checkedAt: 'later' }], seen), []);
  assert.equal(news.unreadNews([{ ...item, title: 'シエンタ 適合追加' }], seen).length, 1);
  assert.equal(news.unreadNews([{ ...item, codes: ['ET-1680', 'ET-1682'] }], seen).length, 1);
});

test('read history survives reload and temporary absence from the feed', () => {
  assert.equal(typeof news.parseNewsReadState, 'function');
  const seen = news.acknowledgeNews([first], {});
  const reloaded = news.parseNewsReadState(JSON.stringify(seen));
  const next = news.acknowledgeNews([second], reloaded);
  assert.deepEqual(news.unreadNews([first, second], next), []);
  assert.equal(news.unreadNews([{ ...first, publishedAt: '2026-10-08' }], next).length, 1);
});

test('missing or invalid browser storage falls back to unread without breaking the page', () => {
  assert.equal(typeof news.parseNewsReadState, 'function');
  for (const input of [null, '', 'invalid', 'null', '[]', '{"article-1":true}']) {
    assert.deepEqual(news.parseNewsReadState(input), {});
  }
  const seen = news.acknowledgeNews([first], {});
  assert.equal(news.unreadNews([first, first], {}).length, 1);
  assert.deepEqual(news.unreadNews([], seen), []);
});
