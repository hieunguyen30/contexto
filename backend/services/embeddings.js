const OpenAI = require('openai');
const logger = require('../utils/logger');
const { recordUsage } = require('../utils/requestContext');

// EMBED_PROVIDER = openai (default) | vertex. Vectors from different providers are not comparable
// (and differ in size: 1536 vs 768), so switching providers requires re-ingesting existing content.
const PROVIDER = () => process.env.EMBED_PROVIDER || 'openai';
const OPENAI_MODEL = 'text-embedding-3-small';
const VERTEX_MODEL = process.env.VERTEX_EMBED_MODEL || 'text-embedding-005';
const BATCH_SIZE = 96;
const VERTEX_BATCH = 25;

// Kept for callers that import the constant.
const EMBED_MODEL = OPENAI_MODEL;

let client = null;
function getClient() {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

async function embedOpenAI(chunks) {
  const openai = getClient();
  const out = new Array(chunks.length);
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const res = await openai.embeddings.create({ model: OPENAI_MODEL, input: batch });
    logger.info('llm_usage', recordUsage({
      kind: 'embedding',
      model: OPENAI_MODEL,
      inputTokens: (res.usage && (res.usage.prompt_tokens || res.usage.total_tokens)) || 0,
    }));
    res.data.forEach((d, j) => {
      out[i + j] = d.embedding;
    });
  }
  return out;
}

let vertexAuth = null;
async function embedVertex(chunks, taskType) {
  const project = process.env.VERTEX_PROJECT_ID;
  const region = process.env.VERTEX_REGION || 'us-central1';
  if (!project) throw new Error('VERTEX_PROJECT_ID is not set');
  if (!vertexAuth) {
    const { GoogleAuth } = require('google-auth-library');
    vertexAuth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  }
  const http = await vertexAuth.getClient();
  const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${project}/locations/${region}/publishers/google/models/${VERTEX_MODEL}:predict`;
  const out = new Array(chunks.length);
  for (let i = 0; i < chunks.length; i += VERTEX_BATCH) {
    const batch = chunks.slice(i, i + VERTEX_BATCH);
    const res = await http.request({
      method: 'POST',
      url,
      data: { instances: batch.map((content) => ({ content, task_type: taskType })) },
    });
    let tokens = 0;
    res.data.predictions.forEach((p, j) => {
      out[i + j] = p.embeddings.values;
      tokens += (p.embeddings.statistics && p.embeddings.statistics.token_count) || 0;
    });
    logger.info('llm_usage', recordUsage({ kind: 'embedding', model: VERTEX_MODEL, inputTokens: tokens }));
  }
  return out;
}

async function embedChunks(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) return [];
  return PROVIDER() === 'vertex' ? embedVertex(chunks, 'RETRIEVAL_DOCUMENT') : embedOpenAI(chunks);
}

async function embedText(text) {
  if (PROVIDER() === 'vertex') return (await embedVertex([text], 'RETRIEVAL_QUERY'))[0];
  const [vec] = await embedOpenAI([text]);
  return vec;
}

module.exports = { embedChunks, embedText, EMBED_MODEL };
