// Authentication. Two modes, chosen by AUTH_MODE (default: "firebase" in production, "dev" otherwise):
//   firebase  Authorization: Bearer <Firebase ID token>, verified server-side; uid is mapped to a User doc.
//   dev       x-user-id header (local development and tests only; refused in production).
const { Types } = require('mongoose');
const logger = require('../utils/logger');

const CACHE_TTL_MS = 5 * 60 * 1000;

function resolveMode() {
  const mode = process.env.AUTH_MODE || (process.env.NODE_ENV === 'production' ? 'firebase' : 'dev');
  if (mode === 'dev' && process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_MODE=dev is not allowed when NODE_ENV=production');
  }
  if (mode !== 'dev' && mode !== 'firebase') throw new Error(`Unknown AUTH_MODE: ${mode}`);
  return mode;
}

function defaultVerifier() {
  const { getApps, initializeApp } = require('firebase-admin/app');
  const { getAuth } = require('firebase-admin/auth');
  if (!getApps().length) initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  return (token) => getAuth().verifyIdToken(token);
}

// First sign-in creates the User doc. Languages get defaults the user can change later.
async function findOrCreateUser(User, decoded) {
  const email = (decoded.email || `${decoded.uid}@no-email.invalid`).toLowerCase();
  const user = await User.findOneAndUpdate(
    { firebase_uid: decoded.uid },
    { $setOnInsert: { firebase_uid: decoded.uid, email, target_language: 'Spanish', native_language: 'English' } },
    { new: true, upsert: true }
  ).lean();
  return user._id;
}

function createAuth({ verifyToken, User, mode = resolveMode() } = {}) {
  const cache = new Map(); // uid -> { id, expires }
  let verify = verifyToken;

  async function requireAuth(req, res, next) {
    try {
      if (mode === 'dev') {
        const raw = req.header('x-user-id');
        if (!raw || !Types.ObjectId.isValid(raw)) {
          return res.status(401).json({ error: 'Missing or invalid x-user-id header' });
        }
        req.userId = new Types.ObjectId(raw);
        return next();
      }

      const header = req.header('authorization') || '';
      const m = /^Bearer (.+)$/i.exec(header);
      if (!m) return res.status(401).json({ error: 'Missing bearer token' });

      let decoded;
      try {
        verify = verify || defaultVerifier();
        decoded = await verify(m[1]);
      } catch (err) {
        logger.warn('Token verification failed', { reason: err.code || err.message });
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      const hit = cache.get(decoded.uid);
      if (hit && hit.expires > Date.now()) {
        req.userId = hit.id;
      } else {
        const id = await findOrCreateUser(User || require('../models').User, decoded);
        cache.set(decoded.uid, { id, expires: Date.now() + CACHE_TTL_MS });
        req.userId = id;
      }
      return next();
    } catch (err) {
      return next(err);
    }
  }
  return requireAuth;
}

let defaultAuth = null;
function requireAuth(req, res, next) {
  defaultAuth = defaultAuth || createAuth();
  return defaultAuth(req, res, next);
}

const getUserId = (req) => req.userId || null;

module.exports = { requireAuth, createAuth, getUserId };
