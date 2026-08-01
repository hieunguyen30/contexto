const OpenAI = require('openai');

const EMBED_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 96;

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

async function embedChunks(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) return [];
  const openai = getClient();
  const out = new Array(chunks.length);

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const res = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: batch,
    });
    res.data.forEach((d, j) => {
      out[i + j] = d.embedding;
    });
  }

  return out;
}

async function embedText(text) {
  const [vec] = await embedChunks([text]);
  return vec;
}

module.exports = { embedChunks, embedText, EMBED_MODEL };
