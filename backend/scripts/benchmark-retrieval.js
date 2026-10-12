#!/usr/bin/env node
// Times chat retrieval (everything /api/chat does between "query embedded" and "context ready")
// at several chunk counts. The OpenAI/Claude calls are excluded on purpose: they're identical for every backend.
//
//   MONGODB_URI=mongodb://localhost:27018/bench node scripts/benchmark-retrieval.js [--sizes 100,1000] [--iters 30]
//   RETRIEVAL_BACKEND=vertex VERTEX_*=...  node scripts/benchmark-retrieval.js   # adds the vertex backend
require('dotenv').config();
const { monitorEventLoopDelay } = require('perf_hooks');
const { Types } = require('mongoose');
const { calculateObjectSize } = require('bson');
const BSON_LIMIT = 16 * 1024 * 1024;
const { connectDB, mongoose } = require('../db');
const { Content } = require('../models');
const { topKByCosine, topKByCosineFast } = require('../utils/similarity');
const { createMemoryRetriever, getRetriever } = require('../utils/retrieval');

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : dflt; };
const SIZES = arg('sizes', '100,1000,10000').split(',').map(Number);
const ITERS = Number(arg('iters', 30));
const CONCURRENCY = Number(arg('concurrency', 10));
const DIM = Number(arg('dim', 1536)); // text-embedding-3-small

function unitVec(dim) {
  const v = Array.from({ length: dim }, () => Math.random() - 0.5);
  const m = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / m);
}
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
const ms = (n) => Math.round(n * 100) / 100;

async function timeOne(fn) { const t = process.hrtime.bigint(); await fn(); return Number(process.hrtime.bigint() - t) / 1e6; }

async function measure(label, fn) {
  await fn(); // warm connection / JIT
  const lat = [];
  for (let i = 0; i < ITERS; i++) lat.push(await timeOne(fn));
  const h = monitorEventLoopDelay({ resolution: 1 }); h.enable();
  const t0 = process.hrtime.bigint();
  await Promise.all(Array.from({ length: CONCURRENCY }, fn));
  const wall = Number(process.hrtime.bigint() - t0) / 1e6;
  h.disable();
  return {
    label, p50: ms(pct(lat, 50)), p95: ms(pct(lat, 95)), mean: ms(lat.reduce((a, b) => a + b, 0) / lat.length),
    [`wall_${CONCURRENCY}x_parallel`]: ms(wall), max_event_loop_delay_ms: ms(h.max / 1e6),
  };
}

(async () => {
  await connectDB();
  const results = [];
  const userId = new Types.ObjectId();
  const queryVec = unitVec(DIM);
  const memory = createMemoryRetriever({ Content });
  const backends = [
    ['legacy (findOne + sort-all cosine)', async (cid) => {
      const c = await Content.findOne({ _id: cid, user_id: userId }, { chunks: 1, embeddings: 1 }).lean();
      topKByCosine(queryVec, c.embeddings, 3).map(({ index }) => c.chunks[index]);
    }],
    ['memory retriever (single-pass top-k)', (cid) => memory.search({ userId, contentId: cid, queryVec, k: 3 })],
  ];
  if (process.env.RETRIEVAL_BACKEND === 'vertex') {
    const vertex = getRetriever();
    backends.push(['vertex vector search', (cid) => vertex.search({ userId, contentId: cid, queryVec, k: 3 })]);
  }

  for (const n of SIZES) {
    console.error(`[bench] preparing ${n} chunks`);
    const chunks = Array.from({ length: n }, (_, i) => `chunk ${i} ` + 'lorem ipsum '.repeat(40));
    const embeddings = Array.from({ length: n }, () => unitVec(DIM));
    let doc;
    const bsonBytes = calculateObjectSize({ chunks, embeddings });
    if (bsonBytes <= BSON_LIMIT) {
      doc = await Content.create({ user_id: userId, title: `bench-${n}`, source_type: 'article', language: 'es', status: 'ready', chunks, embeddings });
    } else {
      results.push({ chunks: n, error: `a Content document with ${n} x ${DIM}-d embeddings is ${ms(bsonBytes / 1048576)} MB of BSON, over MongoDB's 16 MB limit` });
      // Still measure the scoring cost alone, with vectors held in RAM.
      const cpu = [];
      for (let i = 0; i < 5; i++) cpu.push(await timeOne(async () => topKByCosine(queryVec, embeddings, 3)));
      const fast = [];
      for (let i = 0; i < 5; i++) fast.push(await timeOne(async () => topKByCosineFast(queryVec, embeddings, 3)));
      results.push({ chunks: n, note: 'scoring only (vectors already in RAM, no DB fetch)', legacy_cosine_p50_ms: ms(pct(cpu, 50)), fast_cosine_p50_ms: ms(pct(fast, 50)) });
      continue;
    }
    const bsonMB = ms((await Content.collection.stats?.().catch(() => null))?.avgObjSize / 1e6 || 0);
    for (const [label, run] of backends) {
      console.error(`[bench]   measuring ${label} @ ${n}`);
      if (label.startsWith('vertex')) await getRetriever().index({ userId, contentId: doc._id, embeddings });
      results.push({ chunks: n, ...(await measure(label, () => run(doc._id))) });
    }
    await Content.deleteOne({ _id: doc._id });
    void bsonMB;
  }
  console.log(JSON.stringify({ dim: DIM, iters: ITERS, node: process.version, results }, null, 2));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
