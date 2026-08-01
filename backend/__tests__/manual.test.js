// Quick smoke test for pure utilities. Run with: node __tests__/manual.test.js
const assert = require('assert');

const { chunkText, splitSentences, estimateTokens } = require('../utils/chunker');
const { updateSM2 } = require('../utils/sm2');
const { cosineSimilarity, topKByCosine } = require('../utils/similarity');

let passed = 0;
let failed = 0;
function t(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL ${name}: ${err.message}`);
    failed++;
  }
}

console.log('\n--- splitSentences ---');
t('English period boundaries', () => {
  const s = splitSentences('Hello world. This is a test. And another!');
  assert.deepStrictEqual(s, ['Hello world.', 'This is a test.', 'And another!']);
});
t('Question + exclamation', () => {
  const s = splitSentences('Why? Because. Wow!');
  assert.deepStrictEqual(s, ['Why?', 'Because.', 'Wow!']);
});
t('CJK end punctuation', () => {
  const s = splitSentences('今日は晴れだ。明日は雨かも？');
  assert.deepStrictEqual(s, ['今日は晴れだ。', '明日は雨かも？']);
});
t('Single sentence (no terminal punct)', () => {
  const s = splitSentences('Just one fragment here');
  assert.deepStrictEqual(s, ['Just one fragment here']);
});

console.log('\n--- chunkText ---');
t('Empty input returns []', () => {
  assert.deepStrictEqual(chunkText(''), []);
});
t('Preserves whole sentences (no mid-sentence cuts)', () => {
  const sentences = [];
  for (let i = 0; i < 20; i++) {
    sentences.push(
      `This is sentence number ${i} containing roughly twenty words to push chunk size, the quick brown fox jumps over the lazy dog repeatedly across the field.`
    );
  }
  const text = sentences.join(' ');
  const chunks = chunkText(text, 100, 20);
  assert.ok(chunks.length >= 2, `expected multiple chunks, got ${chunks.length}`);
  // Each chunk must end on sentence-final punctuation.
  chunks.forEach((c, i) => {
    assert.ok(/[.!?。！？…]$/.test(c.trim()), `chunk ${i} does not end on a sentence boundary: "${c.slice(-40)}"`);
  });
});
t('Overlap reuses tail sentence(s) of prior chunk', () => {
  const text = Array.from({ length: 10 }, (_, i) => `Sentence ${i} is here.`).join(' ');
  const chunks = chunkText(text, 30, 10);
  assert.ok(chunks.length >= 2);
  // Some sentence from the tail of chunk[0] must appear at the start of chunk[1].
  const tailSentences = chunks[0].split(/(?<=[.!?])\s+/).filter(Boolean);
  const tailMatch = tailSentences.some((s) => chunks[1].startsWith(s));
  assert.ok(tailMatch, `chunk[1] did not start with any tail sentence of chunk[0]: "${chunks[1].slice(0, 60)}"`);
});

console.log('\n--- updateSM2 ---');
const baseItem = () => ({ ease_factor: 2.5, interval: 1, repetitions: 0 });
t('Quality 5 on fresh card → interval=1, reps=1, ef=2.6', () => {
  const r = updateSM2(baseItem(), 5);
  assert.strictEqual(r.interval, 1);
  assert.strictEqual(r.repetitions, 1);
  assert.ok(Math.abs(r.ease_factor - 2.6) < 1e-9);
});
t('Quality 5 after reps=1 → interval=6, reps=2', () => {
  const r = updateSM2({ ease_factor: 2.6, interval: 1, repetitions: 1 }, 5);
  assert.strictEqual(r.interval, 6);
  assert.strictEqual(r.repetitions, 2);
});
t('Quality 5 after reps=2 with ef=2.6 → interval=round(6*2.6)=16', () => {
  const r = updateSM2({ ease_factor: 2.6, interval: 6, repetitions: 2 }, 5);
  assert.strictEqual(r.interval, 16);
  assert.strictEqual(r.repetitions, 3);
});
t('Quality 2 (fail) resets reps=0, interval=1', () => {
  const r = updateSM2({ ease_factor: 2.0, interval: 16, repetitions: 3 }, 2);
  assert.strictEqual(r.repetitions, 0);
  assert.strictEqual(r.interval, 1);
});
t('Ease factor floor 1.3', () => {
  const r = updateSM2({ ease_factor: 1.3, interval: 6, repetitions: 2 }, 3);
  assert.ok(r.ease_factor >= 1.3 - 1e-9);
});
t('Invalid quality throws', () => {
  assert.throws(() => updateSM2(baseItem(), 6));
  assert.throws(() => updateSM2(baseItem(), -1));
  assert.throws(() => updateSM2(baseItem(), 'high'));
});
t('next_review_date is a Date object in the future', () => {
  const r = updateSM2(baseItem(), 5);
  assert.ok(r.next_review_date instanceof Date);
  assert.ok(r.next_review_date.getTime() > Date.now() - 1000 * 60 * 60);
});

console.log('\n--- cosineSimilarity ---');
t('Identical vectors → 1', () => {
  assert.ok(Math.abs(cosineSimilarity([1, 2, 3], [1, 2, 3]) - 1) < 1e-9);
});
t('Orthogonal vectors → 0', () => {
  assert.ok(Math.abs(cosineSimilarity([1, 0], [0, 1])) < 1e-9);
});
t('Opposite vectors → -1', () => {
  assert.ok(Math.abs(cosineSimilarity([1, 0], [-1, 0]) + 1) < 1e-9);
});
t('Zero vector → 0 (no NaN)', () => {
  const r = cosineSimilarity([0, 0, 0], [1, 2, 3]);
  assert.strictEqual(r, 0);
});
t('topKByCosine returns top-k sorted desc', () => {
  const q = [1, 0, 0];
  const vecs = [[0, 1, 0], [1, 0.1, 0], [-1, 0, 0], [0.5, 0.5, 0]];
  const top = topKByCosine(q, vecs, 2);
  assert.strictEqual(top.length, 2);
  assert.ok(top[0].score >= top[1].score);
  assert.strictEqual(top[0].index, 1);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
