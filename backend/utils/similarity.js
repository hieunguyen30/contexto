function dotProduct(a, b) {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) sum += a[i] * b[i];
  return sum;
}

function magnitude(v) {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  return Math.sqrt(sum);
}

function cosineSimilarity(a, b) {
  const ma = magnitude(a);
  const mb = magnitude(b);
  if (ma === 0 || mb === 0) return 0;
  return dotProduct(a, b) / (ma * mb);
}

function topKByCosine(query, vectors, k) {
  const scored = vectors.map((v, i) => ({ index: i, score: cosineSimilarity(query, v) }));
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, k);
}

module.exports = { dotProduct, magnitude, cosineSimilarity, topKByCosine };
