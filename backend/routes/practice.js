const express = require('express');
const { Types } = require('mongoose');
const { VocabItem, Content, User } = require('../models');
const { claudeText } = require('../services/claude');
const { requireAuth, getUserId } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const MAX_SENTENCE_CHARS = 300;

// The daily prompt: write a sentence using one of your due words, get short feedback from the tutor.
router.post('/feedback', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { vocab_item_id, sentence } = req.body || {};
    if (!vocab_item_id || !Types.ObjectId.isValid(vocab_item_id)) {
      return res.status(400).json({ error: 'Valid vocab_item_id is required' });
    }
    if (typeof sentence !== 'string' || sentence.trim().length < 3) {
      return res.status(400).json({ error: 'sentence is required' });
    }
    if (sentence.length > MAX_SENTENCE_CHARS) {
      return res.status(400).json({ error: `sentence must be at most ${MAX_SENTENCE_CHARS} characters` });
    }

    const item = await VocabItem.findOne({ _id: vocab_item_id, user_id: userId }).lean();
    if (!item) return res.status(404).json({ error: 'Vocab item not found' });
    const [content, user] = await Promise.all([
      Content.findOne({ _id: item.content_id }, { language: 1 }).lean(),
      User.findById(userId, { native_language: 1 }).lean(),
    ]);
    const language = (content && content.language) || 'the target language';
    const native = (user && user.native_language) || 'English';

    const system =
      `You are a friendly ${language} tutor. The learner wrote one sentence using a vocabulary word. ` +
      `Reply in ${native} in at most 4 short lines: (1) is the sentence correct and natural, ` +
      `(2) a corrected version in ${language} if needed, (3) one tip. Be encouraging and concise.`;
    const userMsg = `Word: ${item.word} (${item.definition})\nLearner's sentence: ${sentence.trim()}`;

    const feedback = await claudeText({ system, user: userMsg, maxTokens: 300 });
    return res.json({ feedback });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
