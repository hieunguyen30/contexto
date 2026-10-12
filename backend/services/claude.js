const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');
const { recordUsage } = require('../utils/requestContext');

// Override with ANTHROPIC_MODEL; old model IDs get retired and return 404 not_found_error.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

let client = null;
function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

function logUsage(message) {
  const u = message.usage || {};
  logger.info('llm_usage', recordUsage({
    kind: 'completion',
    model: MODEL,
    inputTokens: u.input_tokens || 0,
    outputTokens: u.output_tokens || 0,
  }));
}

function extractText(message) {
  const block = (message.content || []).find((b) => b.type === 'text');
  return block ? block.text : '';
}

function parseJson(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.search(/[\[{]/);
    const end = Math.max(candidate.lastIndexOf(']'), candidate.lastIndexOf('}'));
    if (start !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error('Claude response was not valid JSON');
  }
}

async function claudeJson({ system, user, maxTokens = 2048 }) {
  const anthropic = getClient();
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });
  logUsage(message);
  const text = extractText(message);
  return parseJson(text);
}

async function claudeText({ system, user, maxTokens = 1024 }) {
  const anthropic = getClient();
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });
  logUsage(message);
  return extractText(message);
}

module.exports = { claudeJson, claudeText, MODEL };
