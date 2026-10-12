// Auth middleware: Firebase ID token verification and uid -> user mapping, plus dev-mode guardrails.
const assert = require('assert');
const express = require('express');
const request = require('supertest');
const { createAuth } = require('../middleware/auth');

let passed = 0, failed = 0;
async function t(name, fn) {
  try { await fn(); console.log('  ok  ', name); passed++; } catch (e) { console.log('  FAIL', name, '->', e.message); failed++; }
}

function appWith(auth) {
  const app = express();
  app.get('/me', auth, (req, res) => res.json({ id: String(req.userId) }));
  app.use((err, req, res, _n) => res.status(500).json({ error: err.message }));
  return app;
}
const OID = '507f1f77bcf86cd799439011';

(async () => {
  console.log('\n--- firebase mode ---');
  let lookups = 0;
  const User = { findOneAndUpdate: (q) => ({ lean: async () => { lookups++; return { _id: `id-for-${q.firebase_uid}` }; } }) };
  const verifyToken = async (tok) => {
    if (tok === 'good') return { uid: 'u1', email: 'A@x.com' };
    throw Object.assign(new Error('bad'), { code: 'auth/argument-error' });
  };
  const app = appWith(createAuth({ mode: 'firebase', verifyToken, User }));

  await t('no Authorization header → 401', async () => {
    assert.strictEqual((await request(app).get('/me')).status, 401);
  });
  await t('x-user-id is ignored in firebase mode', async () => {
    assert.strictEqual((await request(app).get('/me').set('x-user-id', OID)).status, 401);
  });
  await t('invalid token → 401', async () => {
    assert.strictEqual((await request(app).get('/me').set('Authorization', 'Bearer nope')).status, 401);
  });
  await t('valid token maps uid → user and is cached', async () => {
    const r1 = await request(app).get('/me').set('Authorization', 'Bearer good');
    const r2 = await request(app).get('/me').set('Authorization', 'Bearer good');
    assert.strictEqual(r1.status, 200);
    assert.strictEqual(r1.body.id, 'id-for-u1');
    assert.strictEqual(r2.body.id, 'id-for-u1');
    assert.strictEqual(lookups, 1, 'second request should hit the cache');
  });

  console.log('\n--- dev mode ---');
  const dev = appWith(createAuth({ mode: 'dev' }));
  await t('x-user-id accepted', async () => {
    assert.strictEqual((await request(dev).get('/me').set('x-user-id', OID)).body.id, OID);
  });
  await t('missing/invalid x-user-id → 401', async () => {
    assert.strictEqual((await request(dev).get('/me')).status, 401);
    assert.strictEqual((await request(dev).get('/me').set('x-user-id', 'zzz')).status, 401);
  });
  await t('dev mode refuses to start in production', async () => {
    const prev = [process.env.NODE_ENV, process.env.AUTH_MODE];
    process.env.NODE_ENV = 'production'; process.env.AUTH_MODE = 'dev';
    try { assert.throws(() => createAuth(), /not allowed/); }
    finally { process.env.NODE_ENV = prev[0]; if (prev[1] === undefined) delete process.env.AUTH_MODE; else process.env.AUTH_MODE = prev[1]; }
  });
  await t('production defaults to firebase mode', async () => {
    const prev = [process.env.NODE_ENV, process.env.AUTH_MODE];
    process.env.NODE_ENV = 'production'; delete process.env.AUTH_MODE;
    try {
      const a = appWith(createAuth({ verifyToken }));
      assert.strictEqual((await request(a).get('/me').set('x-user-id', OID)).status, 401);
    } finally { process.env.NODE_ENV = prev[0]; if (prev[1] !== undefined) process.env.AUTH_MODE = prev[1]; }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
