// Per-request context so LLM/embedding usage can be attributed to the request that caused it.
const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

const als = new AsyncLocalStorage();

// USD per 1M tokens. Estimates for cost dashboards, not invoices; override with LLM_PRICING_JSON.
const DEFAULT_PRICING = {
  'text-embedding-3-small': { input: 0.02, output: 0 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
};
function pricing() {
  try {
    return process.env.LLM_PRICING_JSON ? JSON.parse(process.env.LLM_PRICING_JSON) : DEFAULT_PRICING;
  } catch {
    return DEFAULT_PRICING;
  }
}

function costUsd(model, inputTokens, outputTokens) {
  const p = pricing()[model];
  if (!p) return 0;
  return (inputTokens * p.input + outputTokens * p.output) / 1e6;
}

function runWithContext(fields, fn) {
  return als.run({ request_id: crypto.randomUUID(), tokens_in: 0, tokens_out: 0, cost_usd: 0, ...fields }, fn);
}

const getContext = () => als.getStore();

// Records usage on the current request (if any) and returns the numbers for the caller to log.
function recordUsage({ kind, model, inputTokens = 0, outputTokens = 0 }) {
  const cost = costUsd(model, inputTokens, outputTokens);
  const ctx = als.getStore();
  if (ctx) {
    ctx.tokens_in += inputTokens;
    ctx.tokens_out += outputTokens;
    ctx.cost_usd += cost;
  }
  return { kind, model, tokens_in: inputTokens, tokens_out: outputTokens, cost_usd: cost, request_id: ctx && ctx.request_id };
}

module.exports = { runWithContext, getContext, recordUsage, costUsd };
