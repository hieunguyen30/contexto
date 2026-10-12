const { Schema, model, Types } = require('mongoose');

const ContentSchema = new Schema(
  {
    user_id: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    source_url: { type: String },
    source_type: {
      type: String,
      enum: ['youtube', 'pdf', 'article'],
      required: true,
    },
    // Lifecycle of async ingestion. Docs created before this existed have no status and are treated as ready.
    status: {
      type: String,
      enum: ['queued', 'processing', 'ready', 'failed'],
      default: 'ready',
      index: true,
    },
    error: { type: String, default: null },
    processing_started_at: { type: Date },
    // Full text lives in Cloud Storage (gcs_uri); raw_text is only used when no bucket is configured (local dev).
    raw_text: { type: String },
    gcs_uri: { type: String },
    chunks: { type: [String], default: [] },
    chunk_count: { type: Number, default: 0 },
    embeddings: { type: [[Number]], default: [] },
    language: { type: String, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

module.exports = model('Content', ContentSchema);
