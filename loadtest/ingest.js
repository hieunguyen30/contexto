// k6 load test for POST /api/content/ingest (enqueue latency), then polls status until ready.
//   k6 run -e BASE_URL=http://localhost:4000 -e USER_ID=<oid> -e ARTICLE_URL=http://host.docker.internal:4010/article loadtest/ingest.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const timeToReady = new Trend('time_to_ready_ms', true);

export const options = {
  stages: [
    { duration: '10s', target: 3 },
    { duration: '20s', target: 10 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:ingest}': ['p(95)<500'], // enqueue must stay fast: it only writes a doc and publishes
    time_to_ready_ms: ['p(95)<30000'],               // the ingestion SLO
  },
};

const headers = { 'Content-Type': 'application/json' };
if (__ENV.TOKEN) headers.Authorization = `Bearer ${__ENV.TOKEN}`;
else headers['x-user-id'] = __ENV.USER_ID;

export default function () {
  const start = Date.now();
  const res = http.post(
    `${__ENV.BASE_URL}/api/content/ingest`,
    JSON.stringify({ url: __ENV.ARTICLE_URL, source_type: 'article', target_language: 'Spanish' }),
    { headers, tags: { name: 'ingest' } }
  );
  if (!check(res, { 'status 202': (r) => r.status === 202 })) return;
  const id = res.json('content_id');

  for (let i = 0; i < 60; i++) {
    sleep(0.5);
    const st = http.get(`${__ENV.BASE_URL}/api/content/${id}/status`, { headers, tags: { name: 'status' } });
    const status = st.json('status');
    if (status === 'ready') { timeToReady.add(Date.now() - start); return; }
    if (status === 'failed') { check(st, { 'ingest did not fail': () => false }); return; }
  }
}
