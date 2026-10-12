const express = require('express');
const { Types } = require('mongoose');
const { Content } = require('../models');
const { publishIngest } = require('../services/queue');
const logger = require('../utils/logger');

const router = express.Router();

const SUPPORTED_SOURCES = new Set(['youtube', 'article']);

function getUserId(req) {
  const raw = req.header('x-user-id');
  if (!raw || !Types.ObjectId.isValid(raw)) return null;
  return new Types.ObjectId(raw);
}

router.post('/ingest', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing or invalid x-user-id header' });
    }

    const { url, source_type, target_language } = req.body || {};
    if (!url || !source_type || !target_language) {
      return res
        .status(400)
        .json({ error: 'url, source_type, and target_language are required' });
    }
    if (!SUPPORTED_SOURCES.has(source_type)) {
      return res
        .status(400)
        .json({ error: `source_type must be one of: ${[...SUPPORTED_SOURCES].join(', ')}` });
    }

    // Placeholder title until the worker scrapes the real one.
    const doc = await Content.create({
      user_id: userId,
      title: url,
      source_url: url,
      source_type,
      language: target_language,
      status: 'queued',
    });

    try {
      await publishIngest({ content_id: String(doc._id), url, source_type });
    } catch (err) {
      await Content.updateOne({ _id: doc._id }, { $set: { status: 'failed', error: 'Could not enqueue ingestion' } });
      logger.error('Publish failed', { err, content_id: String(doc._id) });
      return res.status(503).json({ error: 'Could not enqueue ingestion; try again' });
    }

    return res.status(202).json({ content_id: doc._id, status: 'queued' });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id/status', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing or invalid x-user-id header' });
    }
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const item = await Content.findOne(
      { _id: id, user_id: userId },
      { status: 1, error: 1, chunk_count: 1, title: 1 }
    ).lean();
    if (!item) return res.status(404).json({ error: 'Content not found' });
    return res.json({
      content_id: item._id,
      status: item.status || 'ready',
      error: item.error || null,
      chunk_count: item.chunk_count || 0,
      title: item.title,
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/library', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing or invalid x-user-id header' });
    }

    const items = await Content.find(
      { user_id: userId },
      { embeddings: 0, raw_text: 0, chunks: 0 }
    )
      .sort({ created_at: -1 })
      .lean();

    return res.json({ items });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing or invalid x-user-id header' });
    }
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const item = await Content.findOne(
      { _id: id, user_id: userId },
      { embeddings: 0, raw_text: 0, chunks: 0 }
    ).lean();
    if (!item) return res.status(404).json({ error: 'Content not found' });
    return res.json(item);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
