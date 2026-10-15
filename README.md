# Contexto

Learn a language from the things you actually want to read and watch. Paste in a YouTube video or an article, Contexto extracts the text, picks the most useful vocabulary, and drills it back to you with a spaced-repetition quiz. There's also a RAG-style chat that answers questions about the source material in your target language.

## Features

### Ingest real content

- **YouTube transcripts** via `youtube-transcript`, with the page title scraped for a readable name.
- **Web articles** via axios + cheerio — script/nav/footer stripped, main body pulled from `<article>` / `<main>` / common containers.
- **Sentence-aware chunking** — ~500-token chunks, ~50-token overlap, never cuts mid-sentence. Handles Latin (`.!?…`) and CJK (`。！？`) punctuation.
- **OpenAI embeddings** (`text-embedding-3-small`) per chunk at ingest time.
- **Per-document library** — every piece is a card on the dashboard with its own detail page.

### AI-curated vocabulary

- **Claude extraction** (`claude-sonnet-5-5`) — top 10 useful words per content, tuned to `beginner` / `intermediate` / `advanced`. Lemma forms, no proper nouns.
- **Native-language aware** — translations land in your stored `native_language`.
- **Source-grounded examples** — example sentences pulled from the original text where possible.
- **Re-extractable per difficulty** — same content can yield a beginner *and* an advanced set.

### Three-format quizzes

Generated on-demand per word, returned as one JSON payload:

1. **Fill-in-the-blank** from the actual source sentence (case/whitespace-insensitive check).
2. **Multiple choice** — 4 plausible options, shuffled by Claude with `answer_index`.
3. **Translation** — target-language prompt, free-form answer, reveal reference.

Progress bar across the top tracks your position in the card.

### Spaced repetition (SM-2)

- **Pure `updateSM2(item, quality)`** in [`backend/utils/sm2.js`](backend/utils/sm2.js) — fully unit-tested.
- **Anki-style ratings** — Again / Hard / Good / Easy → quality 0 / 3 / 4 / 5. One review per card.
- **Interval ladder** — `0→1d`, `1→6d`, then `round(interval × ef)`; `ef ∈ [1.3, ∞)`; lapses reset to 1d.
- **Due-today queue** — `GET /api/vocab/due` powers a one-click "Start reviewing" list on the dashboard.
- **Next-review preview** shown immediately after each review.

### Chat with your content (RAG, no LangChain)

- **Manual cosine similarity** in [`backend/utils/similarity.js`](backend/utils/similarity.js), zero-vector safe.
- **Top-3 retrieval** over stored chunk embeddings, passed to Claude as labelled context.
- **Tutor framing** — Claude answers **in your target language**, using only the provided context.
- **Per-content threads** at `/chat/[content_id]` — context scoped to that source.

### Frontend

- **Five Tailwind pages** — Dashboard, Upload, Content, Quiz, Chat. No component library.
- **Google sign-in** (Firebase Auth); the backend verifies the ID token on every request.
- **Typed API client** in [`frontend/lib/api.ts`](frontend/lib/api.ts) — axios attaches the Firebase ID token automatically.
- **Clean async UX** — loading states, scoped errors, transitions where they matter.

### Developer experience

- **Utilities unit-tested** — chunker, SM-2, similarity. Runs without DB or API keys.
- **Routes smoke-tested** with supertest against a stubbed app — order, validation, CORS preflight.
- **Lean deps** — no LangChain, no Vercel AI SDK. Official OpenAI + Anthropic SDKs only.
- **Strict types** — `tsc --noEmit` clean across the frontend.

## Design system

A feed-style layout: left sidebar (nav, streak, daily goal, language switcher), a central stream of "post" cards, and a right rail with today's practice prompt. On mobile the sidebar becomes a top bar plus a bottom tab bar.

| Token | Light | Dark | Use |
|---|---|---|---|
| `canvas` | `#F8FAFC` | `#0F172A` | page background |
| `surface` | `#FFFFFF` | `#1E293B` | cards |
| `ink` / `muted` | `#0F172A` / `#64748B` | `#F1F5F9` / `#94A3B8` | text |
| `primary` | Electric Cobalt `#2563EB` | `#60A5FA` | actions, active nav, progress |
| `accent` | Indigo `#4F46E5` | `#818CF8` | prompt box, translations |
| `flame` | Amber `#F59E0B` | `#FBBF24` | streak, "due" counters |
| `mint` | Teal `#10B981` | `#34D399` | success, goal complete |

- Colours are CSS variables (`app/globals.css`) wired into Tailwind (`tailwind.config.ts`), so every utility works in both themes and supports opacity (`bg-primary/10`). `flame-ink`/`mint-ink` are darker text-safe variants for light mode (contrast).
- Dark mode: `class` strategy, saved in `localStorage`, defaults to the OS setting, applied by an inline script before paint (no flash). Cards get a glowing primary border on hover in dark mode instead of a shadow.
- Fonts: **Plus Jakarta Sans** for UI, **Source Serif 4** for target-language text (words, example sentences, quiz prompts). Both load the Vietnamese subset.
- Cards are `rounded-2xl`, 1px border, soft shadow; hover lifts 2px; buttons press down on `:active`; progress bars animate; `prefers-reduced-motion` is respected.
- What the "community" parts map to, since content is private per user and there are no other learners: the vote column is **words / due counters**, the comment thread is **Chat**, vocabulary entries use a **thread-style rail**, and "peer feedback" is **AI tutor feedback** on a sentence you write in the daily prompt.

## Stack

- **Frontend** — Next.js 15 (App Router) · TypeScript · Tailwind CSS · axios
- **Backend** — Node.js · Express · Mongoose / MongoDB Atlas
- **AI** — OpenAI `text-embedding-3-small` for retrieval, Anthropic `claude-sonnet-5-5` for vocab extraction, quiz generation, and chat

```
contexto/
├── backend/
│   ├── server.js              Express bootstrap + DB connect
│   ├── db.js                  Mongoose Atlas connection
│   ├── models/                User, Content, VocabItem, QuizAttempt
│   ├── routes/                content, vocab, chat
│   ├── services/              openai + anthropic clients
│   └── utils/                 chunker, sm2, similarity, extractors
└── frontend/
    ├── app/
    │   ├── dashboard/         library grid + due-for-review
    │   ├── upload/            paste URL → ingest
    │   ├── content/[id]/      vocab list, start-quiz, chat link
    │   ├── quiz/[vocab_id]/   3-question card + SM-2 rating
    │   └── chat/[content_id]/ RAG chat
    ├── components/TopNav.tsx
    └── lib/api.ts             typed axios wrappers
```

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `.env`:

```
MONGODB_URI=mongodb+srv://...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
PORT=4000
```

```bash
npm run dev   # node --watch server.js
```

Server listens on `PORT` (default 4000). `GET /health` is a free liveness check.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # optional; defaults to http://localhost:4000
npm run dev
```

Open <http://localhost:3000>.

### 3. Sign in

The frontend needs a Firebase web app (Firebase console → add a web app, enable **Google** under Authentication → Sign-in method) and the four `NEXT_PUBLIC_FIREBASE_*` values in `frontend/.env.local`. Set `FIREBASE_PROJECT_ID` and `AUTH_MODE=firebase` in `backend/.env`. The first sign-in creates your `User` document automatically (defaults: Spanish learner, English native — editable in Mongo).

For API-only local work without Firebase, leave `AUTH_MODE=dev`: the backend then accepts an `x-user-id: <ObjectId>` header (e.g. with curl or k6). Dev mode refuses to start when `NODE_ENV=production`.

## API

All endpoints require `Authorization: Bearer <Firebase ID token>` unless noted (or `x-user-id` when `AUTH_MODE=dev`).

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/health` | — (no auth) | `{ status, service }` |
| POST | `/api/content/ingest` | `{ url, source_type: "youtube"\|"article", target_language }` | **202** `{ content_id, status: "queued" }` — processing is async |
| GET | `/api/content/:id/status` | — | `{ content_id, status: "queued"\|"processing"\|"ready"\|"failed", error, chunk_count, title }` |
| GET | `/api/stats` | — | `{ streak_days, reviewed_today, daily_goal, due_count }` |
| POST | `/api/practice/feedback` | `{ vocab_item_id, sentence }` (≤ 300 chars) | `{ feedback }` (tutor reply) |
| GET | `/api/vocab/:id/pronunciation` | — | `audio/mpeg` (Cloud Text-to-Speech) |
| GET | `/api/content/library` | — | `{ items: Content[] }` (each with `status`) |
| GET | `/api/content/:id` | — | `Content` (no embeddings/chunks/raw_text) |
| POST | `/api/vocab/extract` | `{ content_id, difficulty_level: "beginner"\|"intermediate"\|"advanced" }` | `{ vocab: VocabItem[] }` (10 items) |
| GET | `/api/vocab` | `?content_id=<id>` (optional) | `{ items: VocabItem[] }` |
| GET | `/api/vocab/due` | — | `{ items: VocabItem[] }` (next_review_date ≤ now) |
| POST | `/api/vocab/quiz/generate` | `{ vocab_item_id }` | `{ vocab_item_id, word, quiz }` |
| POST | `/api/vocab/review` | `{ vocab_item_id, quality: 0..5 }` | `{ vocab_item, next_review_date }` |
| POST | `/api/chat` | `{ content_id, message, target_language }` | `{ answer }` |

## How the pieces work

**Ingestion.** `POST /api/content/ingest` only creates a `Content` doc (`status="queued"`) and publishes a message; the worker (see [Architecture](#architecture)) does the following. It pulls a transcript (YouTube via `youtube-transcript`) or scrapes article text (axios + cheerio). The text is split into ~500-token chunks with ~50-token overlap, but the chunker only slides on **whole sentence boundaries** — both Latin punctuation (`.!?…`) and CJK (`。！？`). Each chunk is embedded with `text-embedding-3-small` and persisted alongside the text.

**Vocab extraction.** `POST /api/vocab/extract` sends the raw text (capped at 60k chars) to Claude, asks for 10 useful words for the requested difficulty level, and saves each as a `VocabItem` with SM-2 defaults (`ease_factor=2.5`, `interval=1`, `repetitions=0`, `next_review_date=today`).

**Spaced repetition.** `POST /api/vocab/review` accepts a quality 0–5 and applies SM-2 via [`utils/sm2.js`](backend/utils/sm2.js):

- `quality < 3` → reset `repetitions=0`, `interval=1`
- `quality ≥ 3` → interval ladder `1 → 6 → round(interval × ef)`; `ef += 0.1 − (5−q)·0.08`, floored at 1.3
- `next_review_date = start_of_today + interval days`

**Chat (RAG).** `POST /api/chat` embeds the user's message, computes cosine similarity against every chunk embedding for the content (manual implementation in [`utils/similarity.js`](backend/utils/similarity.js) — no LangChain), picks the top 3, and sends `system: "You are a language tutor. Answer in <lang>. Use only the provided context."` plus the labelled context to Claude.

## Tests

```bash
cd backend
npm test                        # everything below
node __tests__/manual.test.js   # chunker, sm2, similarity
node __tests__/routes.test.js   # routing order, validation, CORS
node __tests__/worker.test.js   # worker idempotency, redelivery, Pub/Sub push handling
node __tests__/retrieval.test.js        # top-k, Vertex request shape
node __tests__/retrieval-cache.test.js  # cache hits, ownership, LRU eviction
node __tests__/auth.test.js     # Firebase token verification, uid → user mapping
node __tests__/ops.test.js      # reviews-due job, LLM cost accounting
```

None of these need a database, API keys or GCP — they use fakes and stubbed apps.

## Architecture

```mermaid
flowchart LR
  U[Browser] -->|Google sign-in| FA[Firebase Auth]
  U --> FE[Cloud Run: frontend<br/>Next.js standalone]
  U -->|Bearer ID token| BE[Cloud Run: backend<br/>Express API]
  BE -->|verify token| FA
  BE -->|publish ingest-requests| PS[(Pub/Sub topic)]
  PS -->|push + OIDC, backoff retry| WK[Cloud Run: worker<br/>scrape → chunk → embed]
  PS -. 5 failed attempts .-> DLQ[(ingest-dlq)]
  WK --> GCS[(Cloud Storage<br/>raw text)]
  WK --> MDB[(MongoDB Atlas)]
  BE --> MDB
  BE -->|retrieval| RET{{utils/retrieval.js}}
  RET --> MEM[in-process cache]
  RET -.-> VX[Vertex AI Vector Search]
  BE & WK --> LLM[OpenAI embeddings<br/>Anthropic Claude]
  SCH[Cloud Scheduler] --> JOB[Cloud Run job:<br/>reviews-due email]
  JOB --> MDB
  BE & WK -->|JSON logs| CL[Cloud Logging]
  CL --> MON[Monitoring: dashboard, SLO, alerts]
  CL -->|sink| BQ[(BigQuery)]
```

Secrets (`MONGODB_URI`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `SMTP_URL`) live in Secret Manager and reach Cloud Run as env vars; each service has its own service account that can read only the secrets it needs.

### Ingestion state machine

`queued → processing → ready` or `failed`. The worker claims a document with one atomic `findOneAndUpdate`, so duplicate or concurrent Pub/Sub deliveries do the work once; `ready` is never reprocessed, and a `processing` claim older than 10 minutes (crashed worker) can be re-claimed. Transient errors return HTTP 500 so Pub/Sub retries with exponential backoff (10 s → 10 min) and dead-letters after 5 attempts to `ingest-dlq`; permanent errors (no extractable text, malformed message) are acked after the doc is marked `failed`.

## Deploy

Prerequisites: a GCP project with billing, `gcloud`, `terraform ≥ 1.6`, a MongoDB Atlas URI, and a Firebase web app with Google sign-in enabled.

```bash
# 1. Terraform state bucket + infrastructure (APIs, Artifact Registry, service accounts, secrets,
#    bucket, Pub/Sub + DLQ, Cloud Run services/job, scheduler, monitoring, BigQuery log export)
PROJECT_ID=my-dev BUCKET=my-dev-tfstate ./scripts/tf-bootstrap.sh
cd infra/envs/dev          # edit dev.tfvars (project_id, alert_email) and backend.hcl (bucket)
terraform init -backend-config=backend.hcl
terraform apply -var-file=dev.tfvars

# 2. Secret values (Terraform creates the containers, never the values)
printf '%s' "$MONGODB_URI"       | gcloud secrets versions add MONGODB_URI --data-file=-
printf '%s' "$OPENAI_API_KEY"    | gcloud secrets versions add OPENAI_API_KEY --data-file=-
printf '%s' "$ANTHROPIC_API_KEY" | gcloud secrets versions add ANTHROPIC_API_KEY --data-file=-
printf '%s' "$SMTP_URL"          | gcloud secrets versions add SMTP_URL --data-file=-   # smtps://user:pass@host

# 3. Build and deploy the images (the services start as a placeholder image until this runs)
gcloud builds submit --config cloudbuild.yaml --substitutions=\
_PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)'),\
_RAW_TEXT_BUCKET=$PROJECT_ID-contexto-raw-text,SHORT_SHA=$(git rev-parse --short HEAD),\
_FIREBASE_API_KEY=...,_FIREBASE_AUTH_DOMAIN=...,_FIREBASE_APP_ID=...
```

Add the frontend's Cloud Run hostname to Firebase Auth → Settings → Authorized domains. Pull requests run `terraform plan` for both environments and merges to `main` apply (prod behind a required-reviewer environment) via [`.github/workflows/terraform.yml`](.github/workflows/terraform.yml).

`scripts/gcp-setup.sh` + `scripts/gcp-pubsub.sh` are the manual (non-Terraform) equivalent of step 1 for the core pipeline, kept for reference.

## Operations

- **SLO**: 95 % of ingestions reach `ready` within 30 s of being enqueued (28-day rolling window), measured from the worker's `ingest_complete` log via the `ingest_e2e_ms` log-based metric. A burn-rate alert fires at 10× budget consumption over 1 h.
- **Alerts**: SLO burn, dead-letter queue not empty, oldest unacked ingest message > 5 min, API 5xx rate.
- **Dashboard** "Contexto operations": API latency p50/p95/p99, API error rate, ingest queue depth, DLQ count, ingestion time, failed attempts.
- **Cost logging**: every request logs `tokens_in`, `tokens_out`, `cost_usd` (estimate from [`utils/requestContext.js`](backend/utils/requestContext.js), override prices with `LLM_PRICING_JSON`) plus per-call `llm_usage` lines. Logs are exported to BigQuery; ready-made queries (cost per endpoint/day, hardest words, retention by difficulty, SLO attainment) are in [`docs/analytics.sql`](docs/analytics.sql).
- **Daily email**: Cloud Scheduler (08:00 UTC) runs the `contexto-reviews-due` Cloud Run job, which emails users who have words due. Without `SMTP_URL` it logs a dry run.
- **Load tests**: [`loadtest/`](loadtest) (k6) — results and the bottleneck found in [`docs/benchmarks.md`](docs/benchmarks.md).

## Design trade-offs

**Why Pub/Sub for ingestion.** Scraping + embedding takes seconds to minutes and fails in ways the user cannot fix mid-request (site down, OpenAI 429). A queue gives the API a constant-time 202, absorbs bursts (the worker scales on queue pressure, the API is unaffected), and turns failure handling into configuration: backoff retries, a dead-letter topic you can inspect and replay, and at-least-once delivery that the idempotent worker makes safe. The alternatives were worse here: Cloud Tasks gives per-task rate limiting but we have no need to throttle a downstream, and a Mongo-polled job table would mean writing our own retry/backoff/DLQ.

**Why Cloud Run, not GKE.** Three small stateless HTTP services with spiky, low traffic. Cloud Run scales to zero, needs no node pools, upgrades or cluster RBAC, and gives per-request IAM (the worker accepts only the Pub/Sub push identity). GKE would add a cluster to operate and, for Standard, an always-on baseline, in exchange for capabilities we don't use (custom schedulers, sidecars, daemonsets, GPUs, very high steady throughput where per-node pricing wins). Revisit if sustained load makes always-on nodes cheaper than per-request billing, or if we need long-lived connections/WebSockets at scale.

**Retrieval.** The in-process backend is the right default for small corpora: zero extra infrastructure and ~4 ms warm. Its limits are real, though — about 800 chunks per content (Mongo's 16 MB document cap) and per-instance memory — see [`docs/benchmarks.md`](docs/benchmarks.md). Vertex AI Vector Search removes both limits but has a fixed always-on cost that dwarfs this app's current needs; it is implemented behind `RETRIEVAL_BACKEND=vertex` but **has not been benchmarked or run against a real index**. If vectors need to scale before then, Atlas Vector Search (already in the stack's database) is the cheaper step to evaluate first.

**Cost per month (estimates, not measurements — check the GCP pricing calculator).**

| Item | Dev / low traffic | Prod |
|---|---|---|
| Cloud Run (3 services, scale-to-zero) | within free tier | backend `min_instances=1` ≈ a few $ for the always-on instance, plus per-request |
| Pub/Sub, Cloud Storage, Secret Manager, Scheduler | ≈ $0–1 | ≈ $1–5 |
| Cloud Logging + BigQuery export | free tier / pennies | grows with traffic; partitions expire after 90 days |
| MongoDB Atlas | M0 free | M10-class ≈ tens of $ |
| Vertex Vector Search (optional) | not deployed | always-on node, tens of $ |
| OpenAI + Anthropic | **dominant cost** — see `cost_usd` logs; ≈ $0.003 per chat at 800 in / 60 out tokens with the default Sonnet price table | same |

## Not verified yet

Everything below was implemented and unit-tested but **never run against real Google Cloud** (no project was available): the Cloud Build pipeline, Terraform `apply` (modules pass `terraform validate` only), Pub/Sub push + dead-lettering, Firebase sign-in end to end, Vertex AI Vector Search and Vertex embeddings, Cloud Text-to-Speech, the email job, the monitoring dashboard/SLO/alerts and the BigQuery sink. The Docker images build and run locally, and the load tests ran against a local stack with mocked LLMs.

## Optional extras

- **Pronunciation**: `GET /api/vocab/:id/pronunciation` (Cloud Text-to-Speech MP3, "Listen" button on the quiz page).
- **Quiz analytics**: quiz attempts are stored in `QuizAttempt` and logged as `quiz_attempt`; SQL for hardest words and retention by difficulty is in [`docs/analytics.sql`](docs/analytics.sql).
- **Vertex embeddings**: `EMBED_PROVIDER=vertex` (`text-embedding-005`, 768-d). Quality and cost have **not** been compared with OpenAI; switching providers requires re-ingesting content because vectors are not interchangeable.

