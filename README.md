# Injury Journal AI

An AI assistant that answers natural-language questions about a personal injury journal, grounded in the user's own structured journal data.

## Overview

Injury Journal AI sits on top of an existing Injury Journal PostgreSQL application and turns its structured records — injuries, symptoms, treatments, medical visits, and timeline events — into searchable AI context. It uses embeddings, semantic retrieval, and retrieval-augmented generation (RAG) to answer questions like "What treatments have I tried?" or "When did my symptoms get worse?", citing the underlying records it used. A rule-based safety layer keeps the assistant within an organize/retrieve/summarize boundary — it does not diagnose conditions or make medical decisions.

## Project Status

The AI retrieval and RAG pipeline is implemented and tested: offline ingestion (reader → document builder → chunker → embedder → pgvector storage), semantic retrieval, RAG generation, citation generation, input-side safety guardrails, a hand-written AI agent with intent routing, and an evaluation harness.

Known gaps in what's implemented so far:
- There is no runnable ingestion entrypoint yet — the pipeline stages exist and are tested individually, but nothing wires them together outside of test files.
- The agent's journal-lookup path returns raw database records rather than an LLM-generated summary.
- There is no authentication or per-user data isolation yet — every request is currently unauthenticated.

Security/production hardening, AI observability, AWS deployment, and Infrastructure as Code are not yet started. See [docs/04-implementation-roadmap.md](docs/04-implementation-roadmap.md) for the full, current status of every step.

## Tech Stack

- **Language / Runtime:** TypeScript, Node.js (ESM), Express 5
- **Database:** PostgreSQL with the `pgvector` extension
- **ORM:** Prisma 6
- **LLM:** Groq SDK (`openai/gpt-oss-20b`)
- **Embeddings:** A separate Python FastAPI service (`src/embeddings/embedding_api.py`) running Qwen3-Embedding-0.6B via `sentence-transformers`, producing 1024-dimensional vectors
- **Tokenization (chunking):** `js-tiktoken`
- **Testing:** Jest (unit and integration, including tests against a real pgvector database), Supertest
- **Linting/formatting:** ESLint, Prettier

## Documentation

- [Product](docs/01-product.md) — Product goals, scope, features, and intended use.
- [Architecture](docs/02-architecture.md) — Overall system architecture and technical design.
- [Chunker Architecture](docs/03-chunker-architecture.md) — Detailed design of the document chunking component.
- [Implementation Roadmap](docs/04-implementation-roadmap.md) — Current status per step, linked to GitHub issues.

## Setup

### Prerequisites

- Node.js 22 (matches CI)
- A PostgreSQL database with the `pgvector` extension available (CI uses the `pgvector/pgvector:pg16` image)
- A Python environment able to run the embedding service (`src/embeddings/embedding_api.py`) — FastAPI, `sentence-transformers`, and an ASGI server such as `uvicorn`. No dependency manifest for this service is currently committed to the repo.

### Install

```bash
npm install
```

### Configure environment

Set the following environment variables (see `.env.example` for a starting point — note it does not currently list every variable the code reads):

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GROQ_API_KEY` | Yes | Used by `src/llm/llm-client.ts` for answer generation |
| `EMBEDDING_API_URL` | No | Defaults to `http://127.0.0.1:8000` |
| `EMBEDDING_API_TIMEOUT_MS` | No | Defaults to 30000 |
| `PORT` | No | Defaults to 3000 |

### Database

```bash
npx prisma generate
npx prisma migrate deploy
```

Seeding uses two separate scripts, both with hard safety checks against running against the wrong database:

- `npx prisma db seed` runs `prisma/seed.ts`, which refuses to run unless `DATABASE_URL` contains `test`.
- `npm run seed:dev` runs `prisma/seed-dev.ts`, which additionally requires `DATABASE_ENV=development`, `SEED_DEV_CONFIRM=true`, and a database named exactly `injury-journal-ai-db`.

### Run the embedding service

Start `src/embeddings/embedding_api.py` (a FastAPI app exposing `/embed` and `/embed-batch`) on whatever host/port `EMBEDDING_API_URL` points at, e.g.:

```bash
uvicorn src.embeddings.embedding_api:app --port 8000
```

### Run the backend

```bash
npm run dev    # tsx watch, for development
npm run build  # tsc
npm start      # runs dist/index.js
```

## Usage

The API exposes two endpoints:

```bash
curl -X POST http://localhost:3000/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What treatments have I tried?", "injuryId": 1}'

curl -X POST http://localhost:3000/ai-agent \
  -H "Content-Type: application/json" \
  -d '{"question": "What treatments have I tried?", "injuryId": 1}'
```

`injuryId` is optional on both endpoints. Neither endpoint requires authentication today — see
the Project Status section above.

## Tests

```bash
npm test                 # unit tests
npm run test:integration # integration tests — require a real PostgreSQL + pgvector database, run serially
```

`npm run lint`, `npx tsc --noEmit`, unit tests, and a full build are also run in CI
(`.github/workflows/ci.yml`). `npm run test:integration` is not run in CI — it requires a real
PostgreSQL + pgvector database and must be run separately.
