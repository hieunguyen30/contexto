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

// Single-pass top-k (min-heap-free insertion into a k-sized list). Avoids allocating and sorting N objects.
// Query magnitude is computed once. Returns the same shape as topKByCosine.
function topKByCosineFast(query, vectors, k) {
  const qm = magnitude(query);
  const top = [];
  if (qm === 0 || k <= 0) return top;
  const qn = query.length;
  for (let i = 0; i < vectors.length; i++) {
    const v = vectors[i];
    const n = v.length < qn ? v.length : qn;
    let dot = 0;
    let vm = 0;
    for (let j = 0; j < n; j++) {
      const x = v[j];
      dot += query[j] * x;
      vm += x * x;
    }
    for (let j = n; j < v.length; j++) vm += v[j] * v[j];
    const score = vm === 0 ? 0 : dot / (qm * Math.sqrt(vm));
    if (top.length < k || score > top[top.length - 1].score) {
      let pos = top.length;
      while (pos > 0 && top[pos - 1].score < score) pos--;
      top.splice(pos, 0, { index: i, score });
      if (top.length > k) top.pop();
    }
  }
  return top;
}

module.exports.topKByCosineFast = topKByCosineFast;
