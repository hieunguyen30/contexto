const { Schema, model, Types } = require('mongoose');

const VocabItemSchema = new Schema(
  {
    user_id: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    content_id: { type: Types.ObjectId, ref: 'Content', required: true, index: true },
    difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
    word: { type: String, required: true, trim: true },
    definition: { type: String, required: true },
    example_sentence: { type: String },
    translation: { type: String },
    ease_factor: { type: Number, default: 2.5 },
    interval: { type: Number, default: 0 },
    repetitions: { type: Number, default: 0 },
    next_review_date: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

VocabItemSchema.index({ user_id: 1, word: 1 });

module.exports = model('VocabItem', VocabItemSchema);
