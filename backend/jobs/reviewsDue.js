// Daily "reviews due" email. Runs as a Cloud Run job triggered by Cloud Scheduler.
//   SMTP_URL (e.g. smtps://user:pass@smtp.example.com) and MAIL_FROM configure delivery;
//   without SMTP_URL the job logs what it would send (dry run).
require('dotenv').config();
const logger = require('../utils/logger');

async function findUsersWithDueReviews({ VocabItem, User }, now = new Date()) {
  const groups = await VocabItem.aggregate([
    { $match: { next_review_date: { $lte: now } } },
    { $group: { _id: '$user_id', due: { $sum: 1 } } },
  ]);
  if (groups.length === 0) return [];
  const users = await User.find({ _id: { $in: groups.map((g) => g._id) } }, { email: 1 }).lean();
  const emails = new Map(users.map((u) => [String(u._id), u.email]));
  return groups
    .filter((g) => emails.has(String(g._id)) && !emails.get(String(g._id)).endsWith('@no-email.invalid'))
    .map((g) => ({ user_id: String(g._id), email: emails.get(String(g._id)), due: g.due }));
}

function buildEmail({ email, due }, appUrl) {
  const noun = due === 1 ? 'word' : 'words';
  return {
    to: email,
    subject: `${due} ${noun} due for review today`,
    text: `You have ${due} vocabulary ${noun} ready to review.\n\nKeep your streak going: ${appUrl}/dashboard\n`,
  };
}

async function run({ VocabItem, User, send, now = new Date(), appUrl = process.env.APP_URL || '' }) {
  const targets = await findUsersWithDueReviews({ VocabItem, User }, now);
  let sent = 0, failed = 0;
  for (const target of targets) {
    try {
      await send(buildEmail(target, appUrl));
      sent++;
    } catch (err) {
      failed++;
      logger.error('reviews_due_send_failed', { err, user_id: target.user_id });
    }
  }
  logger.info('reviews_due_complete', { candidates: targets.length, sent, failed });
  return { candidates: targets.length, sent, failed };
}

function makeSender() {
  if (!process.env.SMTP_URL || process.env.SMTP_URL === 'dry-run') {
    return async (mail) => logger.info('reviews_due_dry_run', { to: mail.to, subject: mail.subject });
  }
  const transport = require('nodemailer').createTransport(process.env.SMTP_URL);
  return (mail) => transport.sendMail({ from: process.env.MAIL_FROM || 'Contexto <no-reply@localhost>', ...mail });
}

module.exports = { run, findUsersWithDueReviews, buildEmail };

if (require.main === module) {
  const { connectDB, mongoose } = require('../db');
  const { VocabItem, User } = require('../models');
  connectDB()
    .then(() => run({ VocabItem, User, send: makeSender() }))
    .then(async ({ failed }) => {
      await mongoose.disconnect();
      process.exit(failed > 0 ? 1 : 0); // non-zero lets Cloud Run Jobs retry the task
    })
    .catch((err) => {
      logger.error('reviews_due_job_failed', { err });
      process.exit(1);
    });
}
