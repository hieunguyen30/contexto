// Retrieval behind a swappable interface:
//   index({ userId, contentId, embeddings })  -> { storeInMongo: boolean }
//   search({ userId, contentId, queryVec, k }) -> [{ index, score, text }]
// Backend is chosen with RETRIEVAL_BACKEND = memory (default) | vertex.
const { Types } = require('mongoose');
const { topKByCosineFast } = require('./similarity');
const logger = require('./logger');

// Fetches chunk text for the given indices without loading the whole chunks array.
async function fetchChunkTexts(Content, userId, contentId, indices) {
  if (indices.length === 0) return [];
  const [doc] = await Content.aggregate([
    { $match: { _id: new Types.ObjectId(String(contentId)), user_id: new Types.ObjectId(String(userId)) } },
    { $project: { texts: indices.map((i) => ({ $arrayElemAt: ['$chunks', i] })) } },
  ]);
  return doc ? doc.texts : [];
}

// Embeddings live inside the Content document and are scored in-process.
// Limits: BSON 16MB per document (~1.3k chunks at 1536 dims) and O(N) CPU on the API event loop.
function createMemoryRetriever({ Content }) {
  return {
    name: 'memory',
    async index() {
      return { storeInMongo: true };
    },
    async search({ userId, contentId, queryVec, k }) {
      const doc = await Content.findOne(
        { _id: contentId, user_id: userId },
        { chunks: 1, embeddings: 1 }
      ).lean();
      if (!doc) return null;
      const top = topKByCosineFast(queryVec, doc.embeddings || [], k);
      return top.map(({ index, score }) => ({ index, score, text: (doc.chunks || [])[index] || '' }));
    },
  };
}

// Vertex AI Vector Search. Vectors are stored in the index (not Mongo) with a content_id restrict,
// so every query is filtered to a single piece of content. Assumes unit-length embeddings and a
// DOT_PRODUCT_DISTANCE index, for which the returned distance equals cosine similarity.
function createVertexRetriever({ Content, config, http }) {
  const c = config;
  const base = `https://${c.region}-aiplatform.googleapis.com/v1/projects/${c.projectId}/locations/${c.region}`;
  const restricts = (contentId) => [{ namespace: 'content_id', allowList: [String(contentId)] }];

  return {
    name: 'vertex',
    async index({ contentId, embeddings }) {
      const BATCH = 100;
      for (let i = 0; i < embeddings.length; i += BATCH) {
        const datapoints = embeddings.slice(i, i + BATCH).map((vec, j) => ({
          datapointId: `${contentId}:${i + j}`,
          featureVector: vec,
          restricts: restricts(contentId),
        }));
        await http({ method: 'POST', url: `${base}/indexes/${c.indexId}:upsertDatapoints`, data: { datapoints } });
      }
      return { storeInMongo: false };
    },
    async search({ userId, contentId, queryVec, k }) {
      // Ownership check stays in Mongo (cheap, indexed); the vector DB only knows content_id.
      const owned = await Content.exists({ _id: contentId, user_id: userId });
      if (!owned) return null;
      const res = await http({
        method: 'POST',
        url: `https://${c.publicEndpointDomain}/v1/projects/${c.projectNumber}/locations/${c.region}/indexEndpoints/${c.indexEndpointId}:findNeighbors`,
        data: {
          deployedIndexId: c.deployedIndexId,
          queries: [{ datapoint: { featureVector: queryVec, restricts: restricts(contentId) }, neighborCount: k }],
        },
      });
      const neighbors = (res.data.nearestNeighbors?.[0]?.neighbors || []).map((n) => ({
        index: Number(n.datapoint.datapointId.split(':').pop()),
        score: n.distance,
      }));
      const texts = await fetchChunkTexts(Content, userId, contentId, neighbors.map((n) => n.index));
      return neighbors.map((n, i) => ({ ...n, text: texts[i] || '' }));
    },
  };
}

let singleton = null;
function getRetriever() {
  if (singleton) return singleton;
  const { Content } = require('../models');
  const backend = process.env.RETRIEVAL_BACKEND || 'memory';
  if (backend === 'vertex') {
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const required = ['VERTEX_PROJECT_ID', 'VERTEX_PROJECT_NUMBER', 'VERTEX_REGION', 'VERTEX_INDEX_ID',
      'VERTEX_INDEX_ENDPOINT_ID', 'VERTEX_DEPLOYED_INDEX_ID', 'VERTEX_PUBLIC_ENDPOINT_DOMAIN'];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) throw new Error(`RETRIEVAL_BACKEND=vertex requires: ${missing.join(', ')}`);
    singleton = createVertexRetriever({
      Content,
      config: {
        projectId: process.env.VERTEX_PROJECT_ID,
        projectNumber: process.env.VERTEX_PROJECT_NUMBER,
        region: process.env.VERTEX_REGION,
        indexId: process.env.VERTEX_INDEX_ID,
        indexEndpointId: process.env.VERTEX_INDEX_ENDPOINT_ID,
        deployedIndexId: process.env.VERTEX_DEPLOYED_INDEX_ID,
        publicEndpointDomain: process.env.VERTEX_PUBLIC_ENDPOINT_DOMAIN,
      },
      http: async (req) => (await auth.getClient()).request(req),
    });
  } else {
    singleton = createMemoryRetriever({ Content });
  }
  logger.info('Retrieval backend selected', { backend: singleton.name });
  return singleton;
}

module.exports = { getRetriever, createMemoryRetriever, createVertexRetriever };
