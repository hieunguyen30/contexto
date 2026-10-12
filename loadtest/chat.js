// k6 load test for POST /api/chat.
//   k6 run -e BASE_URL=http://localhost:4000 -e USER_ID=<oid> -e CONTENT_ID=<oid> loadtest/chat.js
//   (prod: -e TOKEN=<firebase id token> instead of USER_ID)
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 5 },
    { duration: '30s', target: 20 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

const headers = { 'Content-Type': 'application/json' };
if (__ENV.TOKEN) headers.Authorization = `Bearer ${__ENV.TOKEN}`;
else headers['x-user-id'] = __ENV.USER_ID;

export default function () {
  const res = http.post(
    `${__ENV.BASE_URL}/api/chat`,
    JSON.stringify({ content_id: __ENV.CONTENT_ID, message: '¿De qué trata el texto?', target_language: 'Spanish' }),
    { headers }
  );
  check(res, { 'status 200': (r) => r.status === 200 });
}
