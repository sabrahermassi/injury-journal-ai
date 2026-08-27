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
- `DATABASE_URL` should point at a dedicated, minimally-privileged application role — not a superuser or the role used to run migrations (see [Database roles and connection hygiene](#database-roles-and-connection-hygiene) below)
- A Python environment able to run the embedding service (`src/embeddings/embedding_api.py`) — dependencies are pinned in `src/embeddings/requirements.txt`.

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

### Database roles and connection hygiene

`npx prisma migrate deploy` needs a schema-owner role (DDL privileges). The role the running app
connects as via `DATABASE_URL` should be a **different, minimally-privileged role** — the app
never runs DDL and only needs:

- `SELECT` on `Injury`, `Symptom`, `Treatment`, `MedicalVisit`, `TimelineEvent`, `User` (this
  backend only reads journal records; see `docs/02-architecture.md` D-series decisions on CRUD
  ownership)
- `SELECT`, `INSERT`, `DELETE` on `DocumentChunk` (retrieval, and insert/prune during ingestion —
  no `UPDATE`)

```sql
CREATE ROLE injury_journal_ai_app WITH LOGIN PASSWORD '...';

GRANT SELECT ON "Injury", "Symptom", "Treatment", "MedicalVisit", "TimelineEvent", "User"
  TO injury_journal_ai_app;
GRANT SELECT, INSERT, DELETE ON "DocumentChunk" TO injury_journal_ai_app;
```

Point `DATABASE_URL` at `injury_journal_ai_app`, and keep the schema-owner credentials used for
`prisma migrate deploy` separate (e.g. a different connection string used only in CI/deploy, not
committed anywhere).

For any hosted/non-local Postgres instance, append SSL parameters to `DATABASE_URL`, e.g.
`?sslmode=require` (or stricter, depending on the provider). Local development against a
Docker/local Postgres instance can omit `sslmode`.

Seeding uses two separate scripts, both with hard safety checks against running against the wrong database:

- `npx prisma db seed` runs `prisma/seed.ts`, which refuses to run unless `DATABASE_URL` contains `test`.
- `npm run seed:dev` runs `prisma/seed-dev.ts`, which additionally requires `DATABASE_ENV=development`, `SEED_DEV_CONFIRM=true`, and a database named exactly `injury-journal-ai-db`.

### Run the embedding service

Install the Python dependencies, then start `src/embeddings/embedding_api.py` (a FastAPI app
exposing `/embed` and `/embed-batch`) on whatever host/port `EMBEDDING_API_URL` points at, e.g.:

```bash
pip install -r src/embeddings/requirements.txt
uvicorn src.embeddings.embedding_api:app --port 8000
```

### Run the backend

```bash
npm run dev    # tsx watch, for development
npm run build  # tsc
npm start      # runs dist/index.js
```

## Usage

The API exposes a single endpoint:

```bash
curl -X POST http://localhost:3000/ai-agent \
  -H "Content-Type: application/json" \
  -d '{"question": "What treatments have I tried?", "injuryId": 1}'
```

`injuryId` is optional. The endpoint requires no authentication today — see the Project Status
section above.

## Tests

```bash
npm test                 # runs every test under tests/, including the integration suite below —
                          # requires a real PostgreSQL + pgvector database (see DATABASE_URL)
npm run test:integration # runs just the integration suite explicitly/serially
```

`npm run lint`, `npx tsc --noEmit`, `npm test`, and a full build are also run in CI
(`.github/workflows/ci.yml`). Because Jest matches every test under `tests/`, `npm test` already
includes the PostgreSQL + pgvector integration suite — CI provisions a pgvector database
specifically for this. `npm run test:integration` just runs that same subset explicitly/serially,
useful for running it in isolation locally.
