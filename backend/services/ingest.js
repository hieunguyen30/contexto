const { Content } = require('../models');
const { chunkText } = require('../utils/chunker');
const { extractArticle, extractYoutube } = require('../utils/extractors');
const embeddingsService = require('./embeddings');
const storage = require('./storage');
const logger = require('../utils/logger');

// Errors that retrying cannot fix: the worker acks the message instead of triggering redelivery.
class PermanentIngestError extends Error {}

// A "processing" claim older than this is treated as a crashed worker and can be re-claimed.
const STALE_PROCESSING_MS = 10 * 60 * 1000;

const defaultDeps = {
  Content,
  extract: (source_type, url) =>
    source_type === 'youtube' ? extractYoutube(url) : extractArticle(url),
  embedChunks: (chunks) => embeddingsService.embedChunks(chunks),
  saveRawText: storage.saveRawText,
};

/**
 * scrape -> chunk -> embed -> save. Idempotent: safe under Pub/Sub redelivery.
 * Returns 'done' | 'skipped'. Throws on retryable failure (after marking the doc failed).
 */
async function processIngest({ content_id, url, source_type }, deps = defaultDeps) {
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);

  // Atomic claim: only one delivery wins; "ready" is never reprocessed.
  const content = await deps.Content.findOneAndUpdate(
    {
      _id: content_id,
      $or: [
        { status: { $in: ['queued', 'failed'] } },
        { status: 'processing', processing_started_at: { $lt: staleBefore } },
      ],
    },
    { $set: { status: 'processing', processing_started_at: new Date(), error: null } },
    { new: true }
  );
  if (!content) {
    logger.info('Ingest skipped (already ready, in progress, or missing)', { content_id });
    return 'skipped';
  }

  const started = Date.now();
  try {
    const { title, text } = await deps.extract(source_type, url);
    if (!text || text.trim().length < 20) {
      throw new PermanentIngestError('Could not extract usable text from source');
    }
    const chunks = chunkText(text, 500, 50);
    if (chunks.length === 0) throw new PermanentIngestError('Text could not be chunked');

    const embeddings = await deps.embedChunks(chunks);
    const stored = await deps.saveRawText(content_id, text);

    await deps.Content.updateOne(
      { _id: content_id },
      {
        $set: { title: title || url, chunks, embeddings, chunk_count: chunks.length, status: 'ready', error: null, ...stored },
      }
    );
    logger.info('ingest_complete', {
      content_id,
      chunk_count: chunks.length,
      duration_ms: Date.now() - started,
      // enqueue -> ready, what the 30s SLO is measured on
      e2e_ms: Date.now() - new Date(content.created_at).getTime(),
    });
    return 'done';
  } catch (err) {
    await deps.Content.updateOne(
      { _id: content_id },
      { $set: { status: 'failed', error: String(err.message || err).slice(0, 500) } }
    );
    logger.error('ingest_failed', { content_id, err, permanent: err instanceof PermanentIngestError });
    throw err;
  }
}

module.exports = { processIngest, PermanentIngestError };
