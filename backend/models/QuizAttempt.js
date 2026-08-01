const { Schema, model, Types } = require('mongoose');

const QuizAttemptSchema = new Schema(
  {
    user_id: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    vocab_item_id: { type: Types.ObjectId, ref: 'VocabItem', required: true, index: true },
    correct: { type: Boolean, required: true },
    response_time_ms: { type: Number, required: true, min: 0 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

module.exports = model('QuizAttempt', QuizAttemptSchema);
