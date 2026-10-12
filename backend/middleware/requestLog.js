const { runWithContext, getContext } = require('../utils/requestContext');
const logger = require('../utils/logger');

// Logs one structured line per request, including the LLM/embedding tokens and estimated USD cost it caused.
function requestLog(req, res, next) {
  if (req.path === '/health') return next();
  const started = process.hrtime.bigint();
  runWithContext({}, () => {
    const ctx = getContext();
    res.on('finish', () => {
      logger.info('request_complete', {
        request_id: ctx.request_id,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        duration_ms: Number(process.hrtime.bigint() - started) / 1e6,
        user_id: req.userId ? String(req.userId) : undefined,
        tokens_in: ctx.tokens_in,
        tokens_out: ctx.tokens_out,
        cost_usd: Number(ctx.cost_usd.toFixed(6)),
      });
    });
    next();
  });
}

module.exports = requestLog;
