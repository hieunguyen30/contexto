const { Schema, model } = require('mongoose');

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    target_language: { type: String, required: true },
    native_language: { type: String, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

module.exports = model('User', UserSchema);
