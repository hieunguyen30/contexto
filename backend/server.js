require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { connectDB } = require('./db');
const logger = require('./utils/logger');
const requestLog = require('./middleware/requestLog');
const contentRouter = require('./routes/content');
const vocabRouter = require('./routes/vocab');
const chatRouter = require('./routes/chat');
const statsRouter = require('./routes/stats');
const practiceRouter = require('./routes/practice');

const app = express();

// Restrict to the frontend origin(s) when CORS_ORIGIN is set (comma-separated); open in local dev.
const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors(corsOrigins.length ? { origin: corsOrigins } : undefined));
app.use(requestLog);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'contexto-backend' });
});

app.use('/api/content', contentRouter);
app.use('/api/vocab', vocabRouter);
app.use('/api/chat', chatRouter);
app.use('/api/stats', statsRouter);
app.use('/api/practice', practiceRouter);

app.use((err, req, res, _next) => {
  logger.error('Unhandled request error', { err, method: req.method, path: req.originalUrl });
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 4000;

// Local dev only (no Pub/Sub): ingestion runs inside this process, so a restart orphans in-flight jobs.
// Re-queue them on boot. With Pub/Sub, redelivery handles this instead.
async function resumeLocalIngests() {
  if (process.env.PUBSUB_TOPIC) return;
  const { Content } = require('./models');
  const { publishIngest } = require('./services/queue');
  await Content.updateMany({ status: 'processing' }, { $set: { status: 'queued' } });
  const orphans = await Content.find({ status: 'queued' }, { source_url: 1, source_type: 1 }).lean();
  for (const c of orphans) {
    await publishIngest({ content_id: String(c._id), url: c.source_url, source_type: c.source_type });
  }
  if (orphans.length) logger.info('Resumed local ingests', { count: orphans.length });
}

connectDB()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      logger.info('Contexto backend listening', { port: Number(PORT) });
    });
    resumeLocalIngests().catch((err) => logger.error('Resume of local ingests failed', { err }));
  })
  .catch((err) => {
    logger.error('Failed to connect to MongoDB', { err });
    process.exit(1);
  });
