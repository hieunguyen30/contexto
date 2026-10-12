const { Schema, model } = require('mongoose');

const UserSchema = new Schema(
  {
    firebase_uid: { type: String, unique: true, sparse: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    target_language: { type: String, required: true, default: 'Spanish' },
    native_language: { type: String, required: true, default: 'English' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

module.exports = model('User', UserSchema);
