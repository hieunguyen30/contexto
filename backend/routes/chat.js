const express = require('express');
const { Types } = require('mongoose');
const { embedText } = require('../services/embeddings');
const { claudeText } = require('../services/claude');
const { getRetriever } = require('../utils/retrieval');

const { requireAuth, getUserId } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const TOP_K = 3;


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

    const queryVec = await embedText(message);
    const top = await getRetriever().search({ userId, contentId: content_id, queryVec, k: TOP_K });
    if (top === null) return res.status(404).json({ error: 'Content not found' });
    if (top.length === 0) return res.status(422).json({ error: 'Content has no indexed chunks' });

    const contextBlock = top
      .map(({ text, score }, i) => `[Context ${i + 1} | similarity=${score.toFixed(3)}]\n${text}`)
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
