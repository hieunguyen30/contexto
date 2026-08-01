// Route-level smoke tests against a stubbed app (no DB, no external APIs).
// Verifies routing order, parameter validation, and CORS.
const assert = require('assert');
const express = require('express');
const cors = require('cors');
const request = require('supertest');

process.env.OPENAI_API_KEY = 'dummy';
process.env.ANTHROPIC_API_KEY = 'dummy';

const contentRouter = require('../routes/content');
const vocabRouter = require('../routes/vocab');
const chatRouter = require('../routes/chat');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/content', contentRouter);
app.use('/api/vocab', vocabRouter);
app.use('/api/chat', chatRouter);
app.use((err, req, res, _next) => {
  res.status(err.status || 500).json({ error: err.message });
});

const FAKE_USER = '507f1f77bcf86cd799439011';
const FAKE_OID = '507f1f77bcf86cd799439012';

let passed = 0, failed = 0;
async function t(name, fn) {
  try { await fn(); console.log('  ok  ', name); passed++; }
  catch (err) { console.log('  FAIL', name, '->', err.message); failed++; }
}

(async () => {
  console.log('\n--- content router ---');
  await t('GET /api/content/library without user_id → 401', async () => {
    const r = await request(app).get('/api/content/library');
    assert.strictEqual(r.status, 401);
  });
  await t('GET /api/content/library WITH user_id should NOT be 400 (shadowed-by-:id bug)', async () => {
    const r = await request(app).get('/api/content/library').set('x-user-id', FAKE_USER);
    // If shadowed by /:id, ObjectId.isValid('library') fails → 400.
    // Once fixed, it tries the DB query (which will fail because no DB) → 500.
    // Either way, NOT 400.
    assert.notStrictEqual(r.status, 400, 'GET /library is being shadowed by /:id');
  });
  await t('GET /api/content/<bogus> → 400 invalid id', async () => {
    const r = await request(app).get('/api/content/notanid').set('x-user-id', FAKE_USER);
    assert.strictEqual(r.status, 400);
  });
  await t('POST /api/content/ingest missing fields → 400', async () => {
    const r = await request(app)
      .post('/api/content/ingest')
      .set('x-user-id', FAKE_USER)
      .send({});
    assert.strictEqual(r.status, 400);
  });
  await t('POST /api/content/ingest bad source_type → 400', async () => {
    const r = await request(app)
      .post('/api/content/ingest')
      .set('x-user-id', FAKE_USER)
      .send({ url: 'http://x', source_type: 'pdf', target_language: 'es' });
    assert.strictEqual(r.status, 400);
  });

  console.log('\n--- vocab router ---');
  await t('GET /api/vocab/due without user_id → 401', async () => {
    const r = await request(app).get('/api/vocab/due');
    assert.strictEqual(r.status, 401);
  });
  await t('POST /api/vocab/extract bad content_id → 400', async () => {
    const r = await request(app)
      .post('/api/vocab/extract')
      .set('x-user-id', FAKE_USER)
      .send({ content_id: 'nope', difficulty_level: 'beginner' });
    assert.strictEqual(r.status, 400);
  });
  await t('POST /api/vocab/extract bad difficulty → 400', async () => {
    const r = await request(app)
      .post('/api/vocab/extract')
      .set('x-user-id', FAKE_USER)
      .send({ content_id: FAKE_OID, difficulty_level: 'expert' });
    assert.strictEqual(r.status, 400);
  });
  await t('POST /api/vocab/review bad quality → 400', async () => {
    const r = await request(app)
      .post('/api/vocab/review')
      .set('x-user-id', FAKE_USER)
      .send({ vocab_item_id: FAKE_OID, quality: 7 });
    assert.strictEqual(r.status, 400);
  });
  await t('POST /api/vocab/review non-integer quality → 400', async () => {
    const r = await request(app)
      .post('/api/vocab/review')
      .set('x-user-id', FAKE_USER)
      .send({ vocab_item_id: FAKE_OID, quality: 3.5 });
    assert.strictEqual(r.status, 400);
  });

  console.log('\n--- chat router ---');
  await t('POST /api/chat without user_id → 401', async () => {
    const r = await request(app).post('/api/chat').send({});
    assert.strictEqual(r.status, 401);
  });
  await t('POST /api/chat (no trailing slash) matches the route', async () => {
    const r = await request(app)
      .post('/api/chat')
      .set('x-user-id', FAKE_USER)
      .send({});
    // Missing content_id → 400 (not 404, which would mean the route didn't match).
    assert.strictEqual(r.status, 400);
  });
  await t('POST /api/chat missing message → 400', async () => {
    const r = await request(app)
      .post('/api/chat')
      .set('x-user-id', FAKE_USER)
      .send({ content_id: FAKE_OID, target_language: 'es' });
    assert.strictEqual(r.status, 400);
  });

  console.log('\n--- CORS preflight ---');
  await t('OPTIONS preflight allows x-user-id', async () => {
    const r = await request(app)
      .options('/api/content/library')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'x-user-id, content-type');
    assert.strictEqual(r.status, 204);
    const allow = (r.headers['access-control-allow-headers'] || '').toLowerCase();
    assert.ok(allow.includes('x-user-id'), `missing x-user-id in allow-headers: ${allow}`);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
