const { PubSub } = require('@google-cloud/pubsub');
const logger = require('../utils/logger');

let pubsub = null;

// Publishes an ingest request. Without PUBSUB_TOPIC (local dev) the job runs in-process instead.
async function publishIngest(payload) {
  const topic = process.env.PUBSUB_TOPIC;
  if (!topic) {
    const { processIngest } = require('./ingest');
    setImmediate(() => {
      processIngest(payload).catch((err) => logger.error('Local ingest failed', { err, ...payload }));
    });
    return null;
  }
  if (!pubsub) pubsub = new PubSub();
  return pubsub.topic(topic).publishMessage({ json: payload });
}

module.exports = { publishIngest };
