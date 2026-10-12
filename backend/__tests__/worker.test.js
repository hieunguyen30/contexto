// Worker idempotency + Pub/Sub push handling. Uses an in-memory Content fake; no DB or network.
const assert = require('assert');
const request = require('supertest');

process.env.OPENAI_API_KEY = 'dummy';
const { processIngest, PermanentIngestError } = require('../services/ingest');
const app = require('../worker/server');

function fakeContent(initial) {
  const docs = new Map(initial.map((d) => [String(d._id), { ...d }]));
  const matches = (d, q) => {
    if (String(d._id) !== String(q._id)) return false;
    return q.$or.some((c) =>
      c.status.$in ? c.status.$in.includes(d.status) : d.status === c.status && d.processing_started_at < c.processing_started_at.$lt
    );
  };
  return {
    docs,
    async findOneAndUpdate(q, u) {
      const d = docs.get(String(q._id));
      if (!d || !matches(d, q)) return null;
      Object.assign(d, u.$set);
      return d;
    },
    async updateOne(q, u) {
      Object.assign(docs.get(String(q._id)), u.$set);
    },
  };
}

function makeDeps(Content, overrides = {}) {
  const calls = { extract: 0, embed: 0, save: 0 };
  return {
    calls,
    deps: {
      Content,
      extract: async () => { calls.extract++; return { title: 'T', text: 'Hola mundo. '.repeat(20) }; },
      embedChunks: async (c) => { calls.embed++; return c.map(() => [1, 0]); },
      saveRawText: async () => { calls.save++; return { gcs_uri: 'gs://b/raw_text/x.txt' }; },
      ...overrides,
    },
  };
}

const doc = (status, extra = {}) => ({ _id: 'a'.repeat(24), status, created_at: new Date(), ...extra });
const payload = { content_id: 'a'.repeat(24), url: 'http://x', source_type: 'article' };

let passed = 0, failed = 0;
async function t(name, fn) {
  try { await fn(); console.log('  ok  ', name); passed++; } catch (e) { console.log('  FAIL', name, '->', e.message); failed++; }
}

(async () => {
  console.log('\n--- worker idempotency ---');
  await t('queued → ready with chunks, embeddings, gcs_uri', async () => {
    const C = fakeContent([doc('queued')]); const { deps, calls } = makeDeps(C);
    assert.strictEqual(await processIngest(payload, deps), 'done');
    const d = C.docs.get(payload.content_id);
    assert.strictEqual(d.status, 'ready');
    assert.ok(d.chunks.length > 0 && d.embeddings.length === d.chunks.length);
    assert.strictEqual(d.gcs_uri, 'gs://b/raw_text/x.txt');
    assert.strictEqual(calls.embed, 1);
  });
  await t('redelivery after ready is skipped (no scrape/embed/save)', async () => {
    const C = fakeContent([doc('queued')]); const { deps, calls } = makeDeps(C);
    await processIngest(payload, deps);
    assert.strictEqual(await processIngest(payload, deps), 'skipped');
    assert.deepStrictEqual(calls, { extract: 1, embed: 1, save: 1 });
  });
  await t('concurrent duplicate deliveries process exactly once', async () => {
    const C = fakeContent([doc('queued')]); const { deps, calls } = makeDeps(C);
    const r = await Promise.all([processIngest(payload, deps), processIngest(payload, deps)]);
    assert.deepStrictEqual(r.sort(), ['done', 'skipped']);
    assert.strictEqual(calls.extract, 1);
  });
  await t('fresh "processing" claim is not stolen', async () => {
    const C = fakeContent([doc('processing', { processing_started_at: new Date() })]); const { deps, calls } = makeDeps(C);
    assert.strictEqual(await processIngest(payload, deps), 'skipped');
    assert.strictEqual(calls.extract, 0);
  });
  await t('stale "processing" claim (crashed worker) is re-claimed', async () => {
    const C = fakeContent([doc('processing', { processing_started_at: new Date(Date.now() - 3600e3) })]); const { deps } = makeDeps(C);
    assert.strictEqual(await processIngest(payload, deps), 'done');
  });
  await t('transient failure → failed + rethrown; retry then succeeds', async () => {
    const C = fakeContent([doc('queued')]);
    let n = 0;
    const { deps } = makeDeps(C, { embedChunks: async (c) => { if (n++ === 0) throw new Error('openai 503'); return c.map(() => [1]); } });
    await assert.rejects(processIngest(payload, deps), /openai 503/);
    assert.strictEqual(C.docs.get(payload.content_id).status, 'failed');
    assert.match(C.docs.get(payload.content_id).error, /openai 503/);
    assert.strictEqual(await processIngest(payload, deps), 'done');
    assert.strictEqual(C.docs.get(payload.content_id).status, 'ready');
  });

  console.log('\n--- worker push endpoint ---');
  const push = (obj) => ({ message: { messageId: '1', data: Buffer.from(JSON.stringify(obj)).toString('base64') } });
  await t('non-Pub/Sub body → 400', async () => {
    assert.strictEqual((await request(app).post('/').send({})).status, 400);
  });
  await t('malformed payload is acked (204), not retried', async () => {
    const r = await request(app).post('/').send({ message: { data: Buffer.from('not json').toString('base64') } });
    assert.strictEqual(r.status, 204);
  });
  await t('missing fields acked (204)', async () => {
    assert.strictEqual((await request(app).post('/').send(push({ content_id: 'x' }))).status, 204);
  });
  await t('PermanentIngestError type is distinguishable', async () => {
    assert.ok(new PermanentIngestError('x') instanceof Error);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
