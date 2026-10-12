const express = require('express');
const { Types } = require('mongoose');
const { Content, VocabItem, User } = require('../models');
const { claudeJson } = require('../services/claude');
const { loadRawText } = require('../services/storage');
const { updateSM2 } = require('../utils/sm2');

const router = express.Router();

const VALID_DIFFICULTY = new Set(['beginner', 'intermediate', 'advanced']);

function getUserId(req) {
  const raw = req.header('x-user-id');
  if (!raw || !Types.ObjectId.isValid(raw)) return null;
  return new Types.ObjectId(raw);
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

router.post('/extract', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing or invalid x-user-id header' });
    }

    const { content_id, difficulty_level } = req.body || {};
    if (!content_id || !Types.ObjectId.isValid(content_id)) {
      return res.status(400).json({ error: 'Valid content_id is required' });
    }
    if (!difficulty_level || !VALID_DIFFICULTY.has(difficulty_level)) {
      return res
        .status(400)
        .json({ error: `difficulty_level must be one of: ${[...VALID_DIFFICULTY].join(', ')}` });
    }

    const [content, user] = await Promise.all([
      Content.findOne({ _id: content_id, user_id: userId }, { embeddings: 0 }).lean(),
      User.findById(userId).lean(),
    ]);
    if (!content) return res.status(404).json({ error: 'Content not found' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const sourceText = await loadRawText(content);
    if (!sourceText.trim()) {
      return res.status(422).json({ error: 'Content has no text to extract from' });
    }

    const system =
      'You are a language-learning assistant. You return ONLY valid JSON with no commentary, ' +
      'no code fences, and no extra prose.';

    const userPrompt = [
      `Target language: ${content.language}`,
      `Learner's native language: ${user.native_language}`,
      `Learner difficulty level: ${difficulty_level}`,
      '',
      'From the source content below, identify the 10 MOST USEFUL vocabulary words for a',
      `${difficulty_level} learner of ${content.language}. Prefer words that are common,`,
      'transferable, and useful beyond this single text. Avoid proper nouns.',
      '',
      'Return a JSON array of exactly 10 objects with this shape:',
      '[{',
      `  "word": "<word in ${content.language}, lemma form>",`,
      `  "definition": "<short definition in ${content.language}>",`,
      '  "example_sentence": "<a sentence from the source that uses the word; if none exists, write a natural one>",',
      `  "translation": "<translation of the word into ${user.native_language}>"`,
      '}]',
      '',
      'SOURCE CONTENT:',
      '"""',
      sourceText.slice(0, 60000),
      '"""',
    ].join('\n');

    const parsed = await claudeJson({ system, user: userPrompt, maxTokens: 2048 });
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return res.status(502).json({ error: 'Claude did not return a vocab list' });
    }

    const today = startOfToday();
    const docs = parsed
      .filter((v) => v && typeof v.word === 'string' && v.word.trim())
      .slice(0, 10)
      .map((v) => ({
        user_id: userId,
        content_id: content._id,
        word: v.word.trim(),
        definition: String(v.definition || '').trim(),
        example_sentence: String(v.example_sentence || '').trim(),
        translation: String(v.translation || '').trim(),
        ease_factor: 2.5,
        interval: 1,
        repetitions: 0,
        next_review_date: today,
      }));

    const saved = await VocabItem.insertMany(docs);
    return res.status(201).json({ vocab: saved });
  } catch (err) {
    return next(err);
  }
});

router.post('/quiz/generate', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing or invalid x-user-id header' });
    }

    const { vocab_item_id } = req.body || {};
    if (!vocab_item_id || !Types.ObjectId.isValid(vocab_item_id)) {
      return res.status(400).json({ error: 'Valid vocab_item_id is required' });
    }

    const item = await VocabItem.findOne({ _id: vocab_item_id, user_id: userId }).lean();
    if (!item) return res.status(404).json({ error: 'Vocab item not found' });

    const [content, user] = await Promise.all([
      Content.findById(item.content_id).lean(),
      User.findById(userId).lean(),
    ]);
    const targetLanguage = content?.language || 'unknown';
    const nativeLanguage = user?.native_language || 'English';

    const system =
      'You are a language-learning quiz generator. You return ONLY valid JSON with no ' +
      'commentary, no code fences, and no extra prose.';

    const userPrompt = [
      `Target language: ${targetLanguage}`,
      `Learner's native language: ${nativeLanguage}`,
      '',
      'Generate three quiz questions for the following vocabulary word.',
      '',
      `Word: ${item.word}`,
      `Definition: ${item.definition}`,
      `Original sentence from source: ${item.example_sentence || '(none)'}`,
      `Translation in ${nativeLanguage}: ${item.translation}`,
      '',
      'Return a JSON object with EXACTLY this shape:',
      '{',
      '  "fill_in_blank": {',
      '    "sentence": "<the original sentence with the target word replaced by ____>",',
      '    "answer": "<the target word>"',
      '  },',
      '  "multiple_choice": {',
      `    "question": "<a question in ${nativeLanguage} asking what the word means>",`,
      `    "options": ["<correct definition or translation>", "<plausible distractor>", "<plausible distractor>", "<plausible distractor>"],`,
      '    "answer_index": 0',
      '  },',
      '  "translation": {',
      `    "prompt": "<a short sentence in ${targetLanguage} using the word, asking for translation>",`,
      `    "answer": "<the correct translation into ${nativeLanguage}>"`,
      '  }',
      '}',
      '',
      'Rules:',
      '- If no original sentence is provided, write a natural one for fill_in_blank.',
      '- Shuffle multiple_choice options yourself and set answer_index to the correct position (0-3).',
      '- All distractors must be plausible but clearly wrong.',
    ].join('\n');

    const quiz = await claudeJson({ system, user: userPrompt, maxTokens: 1024 });
    return res.json({ vocab_item_id: item._id, word: item.word, quiz });
  } catch (err) {
    return next(err);
  }
});

router.get('/due', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing or invalid x-user-id header' });
    }
    const now = new Date();
    const items = await VocabItem.find({
      user_id: userId,
      next_review_date: { $lte: now },
    })
      .sort({ next_review_date: 1 })
      .lean();
    return res.json({ items });
  } catch (err) {
    return next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing or invalid x-user-id header' });
    }
    const filter = { user_id: userId };
    const { content_id } = req.query;
    if (content_id) {
      if (!Types.ObjectId.isValid(String(content_id))) {
        return res.status(400).json({ error: 'Invalid content_id' });
      }
      filter.content_id = content_id;
    }
    const items = await VocabItem.find(filter).sort({ created_at: -1 }).lean();
    return res.json({ items });
  } catch (err) {
    return next(err);
  }
});

router.post('/review', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing or invalid x-user-id header' });
    }

    const { vocab_item_id, quality } = req.body || {};
    if (!vocab_item_id || !Types.ObjectId.isValid(vocab_item_id)) {
      return res.status(400).json({ error: 'Valid vocab_item_id is required' });
    }
    if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
      return res.status(400).json({ error: 'quality must be an integer 0..5' });
    }

    const item = await VocabItem.findOne({ _id: vocab_item_id, user_id: userId });
    if (!item) return res.status(404).json({ error: 'Vocab item not found' });

    const update = updateSM2(item, quality);
    item.ease_factor = update.ease_factor;
    item.interval = update.interval;
    item.repetitions = update.repetitions;
    item.next_review_date = update.next_review_date;
    await item.save();

    return res.json({
      vocab_item: item.toObject(),
      next_review_date: item.next_review_date,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
