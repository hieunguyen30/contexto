const express = require('express');
const { Types } = require('mongoose');
const { Content } = require('../models');
const { embedText } = require('../services/embeddings');
const { claudeText } = require('../services/claude');
const { topKByCosine } = require('../utils/similarity');

const router = express.Router();

const TOP_K = 3;

function getUserId(req) {
  const raw = req.header('x-user-id');
  if (!raw || !Types.ObjectId.isValid(raw)) return null;
  return new Types.ObjectId(raw);
}

router.post('/', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing or invalid x-user-id header' });
    }

    const { content_id, message, target_language } = req.body || {};
    if (!content_id || !Types.ObjectId.isValid(content_id)) {
      return res.status(400).json({ error: 'Valid content_id is required' });
    }
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }
    if (!target_language) {
      return res.status(400).json({ error: 'target_language is required' });
    }

    const content = await Content.findOne(
      { _id: content_id, user_id: userId },
      { chunks: 1, embeddings: 1 }
    ).lean();
    if (!content) return res.status(404).json({ error: 'Content not found' });

    const embeddings = content.embeddings || [];
    const chunks = content.chunks || [];
    if (embeddings.length === 0 || chunks.length === 0) {
      return res.status(422).json({ error: 'Content has no indexed chunks' });
    }

    const queryVec = await embedText(message);
    const top = topKByCosine(queryVec, embeddings, TOP_K);

    const contextBlock = top
      .map(({ index, score }, i) => {
        const chunk = chunks[index] || '';
        return `[Context ${i + 1} | similarity=${score.toFixed(3)}]\n${chunk}`;
      })
      .join('\n\n');

    const system = `You are a language tutor. Answer in ${target_language}. Use only the provided context.`;
    const user = `${contextBlock}\n\nUser question:\n${message}`;

    const answer = await claudeText({ system, user, maxTokens: 1024 });
    return res.json({ answer });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
