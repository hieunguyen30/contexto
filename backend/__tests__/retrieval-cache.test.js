// In-process retrieval cache: hits skip Mongo decode, ownership is still enforced, LRU is byte-bounded.
const assert = require('assert');
const { createMemoryRetriever } = require('../utils/retrieval');

let passed = 0, failed = 0;
async function t(name, fn) {
  try { await fn(); console.log('  ok  ', name); passed++; } catch (e) { console.log('  FAIL', name, '->', e.message); failed++; }
}

function fakeStore(docs) {
  const calls = { findOne: 0, exists: 0 };
  return {
    calls,
    Content: {
      findOne: (q) => ({ lean: async () => { calls.findOne++; const d = docs[q._id]; return d && d.owner === q.user_id ? d : null; } }),
      exists: async (q) => { calls.exists++; const d = docs[q._id]; return d && d.owner === q.user_id ? { _id: 1 } : null; },
    },
  };
}
const mk = (owner, n) => ({
  owner,
  chunks: Array.from({ length: n }, (_, i) => 'c' + i),
  embeddings: Array.from({ length: n }, (_, i) => [i === 0 ? 1 : 0, i === 1 ? 1 : 0, 0.1]),
});

(async () => {
  console.log('\n--- memory retriever cache ---');
  await t('second search is served from cache (no re-fetch) with identical results', async () => {
    const { Content, calls } = fakeStore({ a: mk('u1', 3) });
    const r = createMemoryRetriever({ Content });
    const first = await r.search({ userId: 'u1', contentId: 'a', queryVec: [0, 1, 0], k: 2 });
    const second = await r.search({ userId: 'u1', contentId: 'a', queryVec: [0, 1, 0], k: 2 });
    assert.deepStrictEqual(second, first);
    assert.strictEqual(first[0].text, 'c1');
    assert.strictEqual(calls.findOne, 1);
    assert.strictEqual(calls.exists, 1);
  });
  await t('cache hit still enforces ownership', async () => {
    const { Content } = fakeStore({ a: mk('u1', 3) });
    const r = createMemoryRetriever({ Content });
    await r.search({ userId: 'u1', contentId: 'a', queryVec: [1, 0, 0], k: 1 });
    assert.strictEqual(await r.search({ userId: 'intruder', contentId: 'a', queryVec: [1, 0, 0], k: 1 }), null);
  });
  await t('concurrent cold requests share a single load', async () => {
    const { Content, calls } = fakeStore({ a: mk('u1', 3) });
    const r = createMemoryRetriever({ Content });
    await Promise.all([1, 2, 3, 4, 5].map(() => r.search({ userId: 'u1', contentId: 'a', queryVec: [1, 0, 0], k: 1 })));
    assert.strictEqual(calls.findOne, 1);
  });
  await t('byte-bounded LRU evicts the least recently used content', async () => {
    const { Content, calls } = fakeStore({ a: mk('u', 3), b: mk('u', 3), c: mk('u', 3) });
    const probe = createMemoryRetriever({ Content: fakeStore({ a: mk('u', 3) }).Content });
    await probe.search({ userId: 'u', contentId: 'a', queryVec: [1, 0, 0], k: 1 });
    const one = probe._stats().bytes;
    const r = createMemoryRetriever({ Content, cacheBytes: Math.floor(one * 2.5) }); // room for 2 entries
    const s = (id) => r.search({ userId: 'u', contentId: id, queryVec: [1, 0, 0], k: 1 });
    await s('a'); await s('b'); await s('a'); await s('c'); // b is least recently used -> evicted
    assert.strictEqual(r._stats().entries, 2);
    const before = calls.findOne;
    await s('a');
    assert.strictEqual(calls.findOne, before, 'a stays cached');
    await s('b');
    assert.strictEqual(calls.findOne, before + 1, 'b was evicted and reloaded');
  });
  await t('empty (not yet ready) content is not cached', async () => {
    const { Content, calls } = fakeStore({ a: { owner: 'u', chunks: [], embeddings: [] } });
    const r = createMemoryRetriever({ Content });
    assert.deepStrictEqual(await r.search({ userId: 'u', contentId: 'a', queryVec: [1], k: 1 }), []);
    await r.search({ userId: 'u', contentId: 'a', queryVec: [1], k: 1 });
    assert.strictEqual(calls.findOne, 2);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
