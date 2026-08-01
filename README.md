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

- **Claude extraction** (`claude-sonnet-4-20250514`) — top 10 useful words per content, tuned to `beginner` / `intermediate` / `advanced`. Lemma forms, no proper nouns.
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
- **Paste-in user_id editor** in the top nav (auth shim until real sessions ship).
- **Typed API client** in [`frontend/lib/api.ts`](frontend/lib/api.ts) — axios attaches `x-user-id` automatically.
- **Clean async UX** — loading states, scoped errors, transitions where they matter.

### Developer experience

- **Utilities unit-tested** — chunker, SM-2, similarity. Runs without DB or API keys.
- **Routes smoke-tested** with supertest against a stubbed app — order, validation, CORS preflight.
- **Lean deps** — no LangChain, no Vercel AI SDK. Official OpenAI + Anthropic SDKs only.
- **Strict types** — `tsc --noEmit` clean across the frontend.

## Stack

- **Frontend** — Next.js 15 (App Router) · TypeScript · Tailwind CSS · axios
- **Backend** — Node.js · Express · Mongoose / MongoDB Atlas
- **AI** — OpenAI `text-embedding-3-small` for retrieval, Anthropic `claude-sonnet-4-20250514` for vocab extraction, quiz generation, and chat

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

### 3. Create a user (one-time, dev)

There's no auth yet — the backend reads `x-user-id` from a request header, and the frontend stores it in `localStorage`. Create a user document in Mongo:

```js
db.users.insertOne({
  email: "you@example.com",
  target_language: "Spanish",
  native_language: "English",
  created_at: new Date()
});
```

Copy the returned `_id`, then in the app click the user chip in the top-right of the nav and paste it in. Every subsequent request will send `x-user-id: <that id>`.

## API

All endpoints require `x-user-id: <ObjectId>` unless noted.

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/health` | — (no auth) | `{ status, service }` |
| POST | `/api/content/ingest` | `{ url, source_type: "youtube"\|"article", target_language }` | `{ content_id, chunk_count, preview }` |
| GET | `/api/content/library` | — | `{ items: Content[] }` |
| GET | `/api/content/:id` | — | `Content` (no embeddings/chunks/raw_text) |
| POST | `/api/vocab/extract` | `{ content_id, difficulty_level: "beginner"\|"intermediate"\|"advanced" }` | `{ vocab: VocabItem[] }` (10 items) |
| GET | `/api/vocab` | `?content_id=<id>` (optional) | `{ items: VocabItem[] }` |
| GET | `/api/vocab/due` | — | `{ items: VocabItem[] }` (next_review_date ≤ now) |
| POST | `/api/vocab/quiz/generate` | `{ vocab_item_id }` | `{ vocab_item_id, word, quiz }` |
| POST | `/api/vocab/review` | `{ vocab_item_id, quality: 0..5 }` | `{ vocab_item, next_review_date }` |
| POST | `/api/chat` | `{ content_id, message, target_language }` | `{ answer }` |

## How the pieces work

**Ingestion.** `POST /api/content/ingest` pulls a transcript (YouTube via `youtube-transcript`) or scrapes article text (axios + cheerio). The text is split into ~500-token chunks with ~50-token overlap, but the chunker only slides on **whole sentence boundaries** — both Latin punctuation (`.!?…`) and CJK (`。！？`). Each chunk is embedded with `text-embedding-3-small` and persisted alongside the text.

**Vocab extraction.** `POST /api/vocab/extract` sends the raw text (capped at 60k chars) to Claude, asks for 10 useful words for the requested difficulty level, and saves each as a `VocabItem` with SM-2 defaults (`ease_factor=2.5`, `interval=1`, `repetitions=0`, `next_review_date=today`).

**Spaced repetition.** `POST /api/vocab/review` accepts a quality 0–5 and applies SM-2 via [`utils/sm2.js`](backend/utils/sm2.js):

- `quality < 3` → reset `repetitions=0`, `interval=1`
- `quality ≥ 3` → interval ladder `1 → 6 → round(interval × ef)`; `ef += 0.1 − (5−q)·0.08`, floored at 1.3
- `next_review_date = start_of_today + interval days`

**Chat (RAG).** `POST /api/chat` embeds the user's message, computes cosine similarity against every chunk embedding for the content (manual implementation in [`utils/similarity.js`](backend/utils/similarity.js) — no LangChain), picks the top 3, and sends `system: "You are a language tutor. Answer in <lang>. Use only the provided context."` plus the labelled context to Claude.

## Tests

A pair of smoke tests live in `backend/__tests__`:

```bash
cd backend
node __tests__/manual.test.js   # chunker, sm2, similarity
node __tests__/routes.test.js   # routing order, validation, CORS
```

These don't need DB or API keys — they exercise pure utilities and the express layer with a stubbed app.

