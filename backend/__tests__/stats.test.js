// Streak calculation + auth/validation on the new stats and practice routes.
const assert = require('assert');
const express = require('express');
const request = require('supertest');
const { computeStreak } = require('../utils/stats');

process.env.ANTHROPIC_API_KEY = 'dummy';
const statsRouter = require('../routes/stats');
const practiceRouter = require('../routes/practice');

let passed = 0, failed = 0;
async function t(name, fn) {
  try { await fn(); console.log('  ok  ', name); passed++; } catch (e) { console.log('  FAIL', name, '->', e.message); failed++; }
}
const NOW = new Date('2026-10-14T15:00:00Z');

(async () => {
  console.log('\n--- streak ---');
  await t('no activity → 0', () => assert.strictEqual(computeStreak([], NOW), 0));
  await t('reviewed today only → 1', () => assert.strictEqual(computeStreak(['2026-10-14'], NOW), 1));
  await t('consecutive days ending today', () =>
    assert.strictEqual(computeStreak(['2026-10-14', '2026-10-13', '2026-10-12'], NOW), 3));
  await t('streak stays alive when only yesterday is done', () =>
    assert.strictEqual(computeStreak(['2026-10-13', '2026-10-12'], NOW), 2));
  await t('a missed day breaks the streak', () =>
    assert.strictEqual(computeStreak(['2026-10-14', '2026-10-12', '2026-10-11'], NOW), 1));
  await t('last activity two days ago → 0', () => assert.strictEqual(computeStreak(['2026-10-12'], NOW), 0));
  await t('crosses month boundaries', () =>
    assert.strictEqual(computeStreak(['2026-11-01', '2026-10-31', '2026-10-30'], new Date('2026-11-01T01:00:00Z')), 3));

  console.log('\n--- routes ---');
  const app = express();
  app.use(express.json());
  app.use('/api/stats', statsRouter);
  app.use('/api/practice', practiceRouter);
  app.use((err, req, res, _n) => res.status(500).json({ error: err.message }));
  const U = '507f1f77bcf86cd799439011';
  await t('GET /api/stats without user → 401', async () => {
    assert.strictEqual((await request(app).get('/api/stats')).status, 401);
  });
  await t('POST /api/practice/feedback without user → 401', async () => {
    assert.strictEqual((await request(app).post('/api/practice/feedback').send({})).status, 401);
  });
  await t('practice feedback validates vocab_item_id', async () => {
    const r = await request(app).post('/api/practice/feedback').set('x-user-id', U).send({ vocab_item_id: 'x', sentence: 'hola amigo' });
    assert.strictEqual(r.status, 400);
  });
  await t('practice feedback validates sentence presence and length', async () => {
    const id = '507f1f77bcf86cd799439012';
    assert.strictEqual((await request(app).post('/api/practice/feedback').set('x-user-id', U).send({ vocab_item_id: id })).status, 400);
    const long = 'a'.repeat(301);
    assert.strictEqual((await request(app).post('/api/practice/feedback').set('x-user-id', U).send({ vocab_item_id: id, sentence: long })).status, 400);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
