# Contexto

Learn a language from the things you actually want to read and watch. Paste a YouTube video or an article, and Contexto turns it into vocabulary, quizzes on a spaced-repetition schedule, and a chat that answers questions about the source in your target language.

## Features

- **Ingest real content.** YouTube transcripts and web articles are scraped, split into sentence-aware chunks (Latin and CJK punctuation) and embedded. Processing runs in the background, and each feed card shows live progress.
- **AI-curated vocabulary.** Claude picks the 10 most useful words per text for your level (beginner, intermediate or advanced), with definitions, source-grounded examples and translations into your native language.
- **Three-format quizzes.** Fill in the blank, multiple choice and translation, generated per word, plus pronunciation audio.
- **Spaced repetition (SM-2).** Again / Hard / Good / Easy ratings schedule the next review. A due-today queue, a streak and a daily goal keep you coming back.
- **Chat with your content (RAG, no LangChain).** Hand-written cosine retrieval, top-3 chunks passed to Claude, answers in your target language from the text only.
- **Daily practice prompt.** Write a sentence using a due word and get short tutor feedback.
- **Feed-style UI.** Sidebar, post cards and practice rail; light and dark themes; responsive down to mobile.
- **Google sign-in.** Firebase Auth, verified on every API request.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Firebase Auth |
| Backend | Node.js, Express, Mongoose |
| Database | MongoDB Atlas |
| AI | OpenAI `text-embedding-3-small` (retrieval), Anthropic Claude (vocab, quizzes, chat, feedback) |
| Cloud | Google Cloud: Cloud Run, Pub/Sub (with dead-letter queue), Cloud Storage, Secret Manager, Cloud Scheduler, Cloud Build, Artifact Registry |
| Observability | Cloud Logging, Cloud Monitoring (dashboard, SLO, alerts), BigQuery log export |
| Infrastructure | Terraform (modules, `dev` / `prod` environments, remote state), GitHub Actions |
| Testing | Node test scripts with supertest and fakes, k6 load tests |

Flow in one line: **browser → Cloud Run API → Pub/Sub → Cloud Run worker (scrape, chunk, embed) → MongoDB**, with an idempotent worker, retries with backoff and a dead-letter queue.

## Project layout

```
contexto/
├── backend/        Express API, worker, scheduled job, services, utils, tests
├── frontend/       Next.js app (feed, upload, content, quiz, chat)
├── infra/          Terraform modules and dev/prod environments
├── loadtest/       k6 scripts + mock LLM server
└── scripts/        manual GCP bootstrap helpers
```

## Run it locally

```bash
# Backend
cd backend && npm install && cp .env.example .env     # fill in MONGODB_URI, OPENAI_API_KEY, ANTHROPIC_API_KEY
npm run dev                                            # http://localhost:4000  (GET /health)

# Frontend
cd frontend && npm install && cp .env.local.example .env.local
npm run dev                                            # http://localhost:3000
```

**Sign-in:** create a Firebase web app, enable **Google** under Authentication, and put the four `NEXT_PUBLIC_FIREBASE_*` values in `frontend/.env.local`. In `backend/.env` set `AUTH_MODE=firebase` and `FIREBASE_PROJECT_ID`. For API-only work, leave `AUTH_MODE=dev` and send an `x-user-id: <ObjectId>` header (dev mode is refused in production).

With `PUBSUB_TOPIC` empty, ingestion runs inside the API process, so no Google Cloud is needed locally.

If Atlas fails with `querySrv ECONNREFUSED`, your local DNS refuses SRV lookups: set `DNS_SERVERS=8.8.8.8,1.1.1.1` in `backend/.env`.

## Tests

```bash
cd backend && npm test
```

Eight suites covering the chunker, SM-2, retrieval and its cache, worker idempotency, auth, stats and the email job. None need a database, API keys or GCP.

## Status

The Google Cloud dev environment was deployed and tested end to end, then torn down to stop costs. It rebuilds from `infra/` with Terraform and `cloudbuild.yaml`.
