// Seeds one user + one content doc (default 700 chunks x 1536-d) for load tests. Prints the ids as JSON.
//   MONGODB_URI=... node scripts/seed-bench-content.js [--chunks 700]
require('dotenv').config();
const { Types } = require('mongoose');
const { connectDB, mongoose } = require('../db');
const { User, Content } = require('../models');

const i = process.argv.indexOf('--chunks');
const N = i > -1 ? Number(process.argv[i + 1]) : 700;
const unit = () => { const v = Array.from({ length: 1536 }, () => Math.random() - 0.5); const m = Math.sqrt(v.reduce((s, x) => s + x * x, 0)); return v.map((x) => x / m); };

(async () => {
  await connectDB();
  const user = await User.create({ email: `loadtest-${Date.now()}@example.com`, target_language: 'Spanish', native_language: 'English' });
  const content = await Content.create({
    user_id: user._id, title: 'load test', source_type: 'article', language: 'Spanish', status: 'ready',
    chunks: Array.from({ length: N }, (_, k) => `chunk ${k} ` + 'lorem ipsum '.repeat(40)),
    embeddings: Array.from({ length: N }, unit), chunk_count: N,
  });
  console.log(JSON.stringify({ user_id: String(user._id), content_id: String(content._id), chunks: N }));
  await mongoose.disconnect();
  void Types;
})().catch((e) => { console.error(e); process.exit(1); });
