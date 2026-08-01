const express = require('express');
const { Types } = require('mongoose');
const { Content } = require('../models');
const { chunkText } = require('../utils/chunker');
const { extractArticle, extractYoutube } = require('../utils/extractors');
const { embedChunks } = require('../services/embeddings');

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

    const { title, text } =
      source_type === 'youtube'
        ? await extractYoutube(url)
        : await extractArticle(url);

    if (!text || text.trim().length < 20) {
      return res.status(422).json({ error: 'Could not extract usable text from source' });
    }

    const chunks = chunkText(text, 500, 50);
    if (chunks.length === 0) {
      return res.status(422).json({ error: 'Text could not be chunked' });
    }

    const embeddings = await embedChunks(chunks);

    const doc = await Content.create({
      user_id: userId,
      title,
      source_url: url,
      source_type,
      raw_text: text,
      chunks,
      embeddings,
      language: target_language,
    });

    return res.status(201).json({
      content_id: doc._id,
      chunk_count: chunks.length,
      preview: chunks[0].slice(0, 280),
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
