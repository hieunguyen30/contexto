// Phase 6 pieces that run without GCP: reviews-due job, request cost accounting.
const assert = require('assert');
const { run, buildEmail } = require('../jobs/reviewsDue');
const { runWithContext, getContext, recordUsage, costUsd } = require('../utils/requestContext');

let passed = 0, failed = 0;
async function t(name, fn) {
  try { await fn(); console.log('  ok  ', name); passed++; } catch (e) { console.log('  FAIL', name, '->', e.message); failed++; }
}

(async () => {
  console.log('\n--- reviews-due job ---');
  const VocabItem = { aggregate: async () => [{ _id: 'u1', due: 3 }, { _id: 'u2', due: 1 }, { _id: 'u3', due: 2 }] };
  const User = { find: () => ({ lean: async () => [
    { _id: 'u1', email: 'a@x.com' }, { _id: 'u2', email: 'b@x.com' }, { _id: 'u3', email: 'u3@no-email.invalid' }] }) };
  await t('emails every user with due words, skips placeholder addresses', async () => {
    const sent = [];
    const r = await run({ VocabItem, User, send: async (m) => sent.push(m), appUrl: 'https://app' });
    assert.deepStrictEqual(r, { candidates: 2, sent: 2, failed: 0 });
    assert.deepStrictEqual(sent.map((m) => m.to), ['a@x.com', 'b@x.com']);
    assert.match(sent[0].subject, /^3 words due/);
    assert.match(sent[1].subject, /^1 word due/);
  });
  await t('one failing send does not stop the rest and is counted', async () => {
    const sent = [];
    const r = await run({ VocabItem, User, send: async (m) => { if (m.to === 'a@x.com') throw new Error('smtp down'); sent.push(m); } });
    assert.deepStrictEqual(r, { candidates: 2, sent: 1, failed: 1 });
    assert.strictEqual(sent.length, 1);
  });
  await t('no due items → no work', async () => {
    const r = await run({ VocabItem: { aggregate: async () => [] }, User, send: async () => { throw new Error('should not send'); } });
    assert.strictEqual(r.candidates, 0);
  });
  await t('email body links to dashboard', () => assert.match(buildEmail({ email: 'a', due: 2 }, 'https://app').text, /https:\/\/app\/dashboard/));

  console.log('\n--- LLM cost accounting ---');
  await t('cost = tokens x per-million price', () => {
    assert.ok(Math.abs(costUsd('claude-sonnet-4-20250514', 1000, 500) - (1000 * 3 + 500 * 15) / 1e6) < 1e-12);
    assert.strictEqual(costUsd('unknown-model', 1000, 1000), 0);
  });
  await t('usage accumulates on the current request only', async () => {
    let inner;
    await runWithContext({}, async () => {
      recordUsage({ kind: 'embedding', model: 'text-embedding-3-small', inputTokens: 1000 });
      await new Promise((r) => setTimeout(r, 5)); // survives async hops
      recordUsage({ kind: 'completion', model: 'claude-sonnet-4-20250514', inputTokens: 100, outputTokens: 10 });
      inner = { ...getContext() };
    });
    assert.strictEqual(inner.tokens_in, 1100);
    assert.strictEqual(inner.tokens_out, 10);
    assert.ok(inner.cost_usd > 0);
    assert.strictEqual(getContext(), undefined);
    assert.doesNotThrow(() => recordUsage({ kind: 'x', model: 'text-embedding-3-small', inputTokens: 1 })); // no context: no-op
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
