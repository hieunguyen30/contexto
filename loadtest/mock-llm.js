// Stand-in for OpenAI + Anthropic + a scrape target, so load tests exercise OUR code (Express, Mongo,
// retrieval, ingestion) rather than third-party latency or spend.
//   node loadtest/mock-llm.js            (port 4010)
//   backend env: OPENAI_BASE_URL=http://localhost:4010/v1 ANTHROPIC_BASE_URL=http://localhost:4010
const http = require('http');

const EMBED_DELAY_MS = Number(process.env.EMBED_DELAY_MS || 60);
const CLAUDE_DELAY_MS = Number(process.env.CLAUDE_DELAY_MS || 400);
const DIM = 1536;

const vec = () => {
  const v = Array.from({ length: DIM }, () => Math.random() - 0.5);
  const m = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / m);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const article = () =>
  '<html><head><title>Load test article</title></head><body><article>' +
  Array.from({ length: 120 }, (_, i) => `<p>Esta es la frase número ${i} del artículo de prueba para medir la ingesta. ` +
    'El gato duerme en la casa mientras la lluvia cae sobre el tejado antiguo de la ciudad.</p>').join('') +
  '</article></body></html>';

http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', async () => {
    const send = (obj) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); };
    try {
      if (req.url.startsWith('/v1/embeddings')) {
        const parsed = JSON.parse(body);
        const input = [].concat(parsed.input);
        // The OpenAI SDK asks for base64-packed float32 and decodes it client-side.
        const encode = (v) => (parsed.encoding_format === 'base64' ? Buffer.from(new Float32Array(v).buffer).toString('base64') : v);
        await sleep(EMBED_DELAY_MS);
        const tokens = input.reduce((s, t) => s + Math.ceil(String(t).length / 4), 0);
        return send({ object: 'list', model: 'text-embedding-3-small',
          data: input.map((_, index) => ({ object: 'embedding', index, embedding: encode(vec()) })),
          usage: { prompt_tokens: tokens, total_tokens: tokens } });
      }
      if (req.url.startsWith('/v1/messages')) {
        await sleep(CLAUDE_DELAY_MS);
        return send({ id: 'msg_mock', type: 'message', role: 'assistant', model: 'mock', stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Respuesta de prueba.' }], usage: { input_tokens: 800, output_tokens: 60 } });
      }
      if (req.url.startsWith('/article')) { res.setHeader('content-type', 'text/html'); return res.end(article()); }
      res.statusCode = 404; res.end('not found');
    } catch (e) { res.statusCode = 500; res.end(String(e)); }
  });
}).listen(4010, () => console.log('mock LLM/scrape server on :4010'));
