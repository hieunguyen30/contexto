require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { connectDB } = require('./db');
const logger = require('./utils/logger');
const contentRouter = require('./routes/content');
const vocabRouter = require('./routes/vocab');
const chatRouter = require('./routes/chat');

const app = express();

// Restrict to the frontend origin(s) when CORS_ORIGIN is set (comma-separated); open in local dev.
const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors(corsOrigins.length ? { origin: corsOrigins } : undefined));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'contexto-backend' });
});

app.use('/api/content', contentRouter);
app.use('/api/vocab', vocabRouter);
app.use('/api/chat', chatRouter);

app.use((err, req, res, _next) => {
  logger.error('Unhandled request error', { err, method: req.method, path: req.originalUrl });
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 4000;

connectDB()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      logger.info('Contexto backend listening', { port: Number(PORT) });
    });
  })
  .catch((err) => {
    logger.error('Failed to connect to MongoDB', { err });
    process.exit(1);
  });
