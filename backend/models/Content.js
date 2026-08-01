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
    raw_text: { type: String, required: true },
    chunks: { type: [String], default: [] },
    embeddings: { type: [[Number]], default: [] },
    language: { type: String, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

module.exports = model('Content', ContentSchema);
