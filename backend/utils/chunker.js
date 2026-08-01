const DEFAULT_MAX_TOKENS = 500;
const DEFAULT_OVERLAP_TOKENS = 50;

function estimateTokens(text) {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

function splitSentences(text) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  // Latin punctuation requires intervening whitespace to avoid splitting acronyms like "U.S.A.".
  // CJK punctuation typically has no following whitespace, so whitespace is optional there.
  const parts = normalized.split(
    /(?<=[.!?…]["'")\]]*)\s+(?=\S)|(?<=[。！？])\s*(?=\S)/u
  );
  return parts.map((s) => s.trim()).filter(Boolean);
}

function splitLongSentence(sentence, maxTokens) {
  const words = sentence.split(/\s+/);
  const pieces = [];
  let buf = [];
  let bufTokens = 0;

  for (const word of words) {
    const wTokens = estimateTokens(word + ' ');
    if (bufTokens + wTokens > maxTokens && buf.length > 0) {
      pieces.push(buf.join(' '));
      buf = [];
      bufTokens = 0;
    }
    buf.push(word);
    bufTokens += wTokens;
  }
  if (buf.length > 0) pieces.push(buf.join(' '));
  return pieces;
}

function chunkText(text, maxTokens = DEFAULT_MAX_TOKENS, overlapTokens = DEFAULT_OVERLAP_TOKENS) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return [];

  const chunks = [];
  let current = [];
  let currentTokens = 0;

  const flushWithOverlap = () => {
    chunks.push(current.join(' '));
    const overlap = [];
    let overlapTok = 0;
    for (let i = current.length - 1; i >= 0; i--) {
      const tk = estimateTokens(current[i]);
      if (overlapTok + tk > overlapTokens && overlap.length > 0) break;
      overlap.unshift(current[i]);
      overlapTok += tk;
      if (overlapTok >= overlapTokens) break;
    }
    current = overlap.slice();
    currentTokens = overlapTok;
  };

  for (const sentence of sentences) {
    const sTokens = estimateTokens(sentence);

    if (sTokens > maxTokens) {
      if (current.length > 0) {
        chunks.push(current.join(' '));
        current = [];
        currentTokens = 0;
      }
      for (const piece of splitLongSentence(sentence, maxTokens)) {
        chunks.push(piece);
      }
      continue;
    }

    if (currentTokens + sTokens > maxTokens && current.length > 0) {
      flushWithOverlap();
    }
    current.push(sentence);
    currentTokens += sTokens;
  }

  if (current.length > 0) chunks.push(current.join(' '));
  return chunks;
}

module.exports = { chunkText, splitSentences, estimateTokens };
