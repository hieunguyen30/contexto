// Retrieval interface: optimized top-k matches the reference, and the Vertex backend builds correct requests.
const assert = require('assert');
const { topKByCosine, topKByCosineFast } = require('../utils/similarity');
const { createMemoryRetriever, createVertexRetriever } = require('../utils/retrieval');

let passed = 0, failed = 0;
async function t(name, fn) {
  try { await fn(); console.log('  ok  ', name); passed++; } catch (e) { console.log('  FAIL', name, '->', e.message); failed++; }
}
const rnd = (n) => Array.from({ length: n }, () => Math.random() - 0.5);

(async () => {
  console.log('\n--- top-k ---');
  await t('topKByCosineFast matches topKByCosine on random data', async () => {
    const vecs = Array.from({ length: 500 }, () => rnd(32));
    const q = rnd(32);
    const a = topKByCosine(q, vecs, 5), b = topKByCosineFast(q, vecs, 5);
    assert.deepStrictEqual(b.map((x) => x.index), a.map((x) => x.index));
    b.forEach((x, i) => assert.ok(Math.abs(x.score - a[i].score) < 1e-12));
  });
  await t('zero vectors and k > N are safe', async () => {
    assert.deepStrictEqual(topKByCosineFast([1, 0], [[0, 0]], 3), [{ index: 0, score: 0 }]);
    assert.deepStrictEqual(topKByCosineFast([0, 0], [[1, 0]], 3), []);
  });

  console.log('\n--- memory retriever ---');
  await t('returns text of best chunks; null for unknown content', async () => {
    const doc = { chunks: ['a', 'b', 'c'], embeddings: [[1, 0], [0, 1], [0.9, 0.1]] };
    const Content = { findOne: (q) => ({ lean: async () => (q._id === 'known' ? doc : null) }) };
    const r = createMemoryRetriever({ Content });
    const hits = await r.search({ userId: 'u', contentId: 'known', queryVec: [1, 0], k: 2 });
    assert.deepStrictEqual(hits.map((h) => h.text), ['a', 'c']);
    assert.strictEqual(await r.search({ userId: 'u', contentId: 'nope', queryVec: [1, 0], k: 2 }), null);
    assert.deepStrictEqual(await r.index({}), { storeInMongo: true });
  });

  console.log('\n--- vertex retriever ---');
  const config = { projectId: 'p', projectNumber: '123', region: 'us-central1', indexId: 'idx', indexEndpointId: 'ep',
    deployedIndexId: 'dep', publicEndpointDomain: 'x.vdb.vertexai.goog' };
  await t('index upserts datapoints with content_id restrict and skips Mongo storage', async () => {
    const calls = [];
    const r = createVertexRetriever({ Content: {}, config, http: async (req) => { calls.push(req); return { data: {} }; } });
    const out = await r.index({ contentId: 'c1', embeddings: Array.from({ length: 150 }, () => [1, 0]) });
    assert.deepStrictEqual(out, { storeInMongo: false });
    assert.strictEqual(calls.length, 2); // batches of 100
    assert.match(calls[0].url, /indexes\/idx:upsertDatapoints$/);
    assert.deepStrictEqual(calls[0].data.datapoints[0].restricts, [{ namespace: 'content_id', allowList: ['c1'] }]);
    assert.strictEqual(calls[1].data.datapoints[0].datapointId, 'c1:100');
  });
  await t('search filters by content_id, maps neighbors, enforces ownership', async () => {
    const calls = [];
    const OID = '507f1f77bcf86cd799439011';
    const Content = {
      exists: async (q) => (q.user_id === OID ? { _id: 1 } : null),
      aggregate: async () => [{ texts: ['t7', 't2'] }],
    };
    const http = async (req) => { calls.push(req); return { data: { nearestNeighbors: [{ neighbors: [
      { datapoint: { datapointId: `${OID}:7` }, distance: 0.9 }, { datapoint: { datapointId: `${OID}:2` }, distance: 0.8 }] }] } }; };
    const r = createVertexRetriever({ Content, config, http });
    const hits = await r.search({ userId: OID, contentId: OID, queryVec: [1, 0], k: 2 });
    assert.deepStrictEqual(hits.map((h) => [h.index, h.text, h.score]), [[7, 't7', 0.9], [2, 't2', 0.8]]);
    assert.match(calls[0].url, /x\.vdb\.vertexai\.goog\/v1\/projects\/123\/.*indexEndpoints\/ep:findNeighbors$/);
    assert.deepStrictEqual(calls[0].data.queries[0].datapoint.restricts[0].allowList, [OID]);
    assert.strictEqual(await r.search({ userId: 'intruder', contentId: OID, queryVec: [1, 0], k: 2 }), null);
    assert.strictEqual(calls.length, 1, 'no vector query for non-owner');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
