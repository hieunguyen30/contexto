require('dotenv').config();

const express = require('express');
const { connectDB } = require('../db');
const { processIngest, PermanentIngestError } = require('../services/ingest');
const logger = require('../utils/logger');

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'contexto-worker' }));

// Pub/Sub push endpoint. 2xx acks the message; non-2xx makes Pub/Sub retry (with backoff) and eventually dead-letter.
app.post('/', async (req, res) => {
  const msg = req.body && req.body.message;
  if (!msg || !msg.data) return res.status(400).json({ error: 'Not a Pub/Sub push message' });

  let payload;
  try {
    payload = JSON.parse(Buffer.from(msg.data, 'base64').toString('utf8'));
  } catch {
    logger.error('Bad message payload; acking', { message_id: msg.messageId });
    return res.status(204).end(); // poison message: retrying cannot help
  }
  if (!payload.content_id || !payload.url || !payload.source_type) {
    logger.error('Message missing fields; acking', { message_id: msg.messageId, payload });
    return res.status(204).end();
  }

  try {
    await processIngest(payload);
    return res.status(204).end();
  } catch (err) {
    if (err instanceof PermanentIngestError) return res.status(204).end(); // already marked failed
    return res.status(500).json({ error: 'ingest failed; will be retried' });
  }
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  connectDB()
    .then(() => app.listen(PORT, '0.0.0.0', () => logger.info('Contexto worker listening', { port: Number(PORT) })))
    .catch((err) => {
      logger.error('Worker failed to start', { err });
      process.exit(1);
    });
}
