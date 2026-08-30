# Injury Journal AI

An AI assistant that answers natural-language questions about a personal injury journal, grounded in the user's own structured journal data.

## Overview

Injury Journal AI sits on top of an existing Injury Journal PostgreSQL application and turns its structured records — injuries, symptoms, treatments, medical visits, and timeline events — into searchable AI context. It uses embeddings, semantic retrieval, and retrieval-augmented generation (RAG) to answer questions like "What treatments have I tried?" or "When did my symptoms get worse?", citing the underlying records it used. A rule-based safety layer keeps the assistant within an organize/retrieve/summarize boundary — it does not diagnose conditions or make medical decisions.

## Project Status

The AI retrieval and RAG pipeline is implemented and tested: offline ingestion (reader → document builder → chunker → embedder → pgvector storage), semantic retrieval, RAG generation, citation generation, input-side safety guardrails, a hand-written AI agent with intent routing, and an evaluation harness.

A runnable ingestion entrypoint exists (`npm run ingest`, `src/ingestion/ingestion-worker.ts`)
wiring reader → document builder → chunker → embedder → pgvector storage into one pipeline. The
agent's journal-lookup path returns an LLM-generated summary of the injury record, the same as the
RAG path. `POST /ai-agent` requires a `Bearer` JWT (issue #94), and retrieval/journal lookups
filter by the authenticated `userId` (issue #95).

Security/production hardening is mostly done (see the roadmap); AI observability, AWS deployment,
and Infrastructure as Code are not yet started. See [docs/04-implementation-roadmap.md](docs/04-implementation-roadmap.md) for the full, current status of every step.

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
- [API Contract](docs/05-api-contract.md) — Request/response shapes, error codes, and endpoint behavior.
- [Flows Review](docs/07-flows-review.md) — End-to-end trace of real function calls and error paths.

## Setup

### Quick start (Docker)

The fastest way to get a working local environment — Docker runs Postgres (with
`pgvector`) and the embedding service for you.

**Prerequisites:** Docker Desktop (or Docker Engine + the Compose plugin), Node.js 22.

1. `npm install`
2. Copy `.env.example` to `.env` and fill in `GROQ_API_KEY`, `JWT_SECRET`, and
   `EMBEDDING_API_KEY`. `DATABASE_URL` can be left at its pre-filled default — it already
   matches the Postgres container started below.
3. `npm run dev:up` — starts Postgres and the embedding service in Docker, waits for both
   to report healthy, then runs `npx prisma generate` and `npx prisma migrate deploy`
   against the new database.

   The **first** run downloads the embedding model (a few hundred MB) and can take a few
   minutes; it's cached in a Docker volume afterward, so later runs are fast.
4. Optionally, instead of step 3, run `npm run dev:up:seed` to also populate sample data.
   This still requires and sets `DATABASE_ENV=development` and `SEED_DEV_CONFIRM=true`
   under the hood — it does not weaken any of `prisma/seed-dev.ts`'s existing safety
   checks (see below), it just supplies the same values you'd type by hand running
   `npm run seed:dev` directly.
5. `npm run dev` to start the backend.

Stop the containers with `npm run dev:down` (data and the cached model persist).
`npm run dev:reset` additionally wipes the Postgres volume and the cached model for a
completely clean slate.

If you already have a local Postgres listening on 5432 (e.g. a native install from the
manual steps below), `docker compose up` will fail to bind that port — stop the existing
Postgres first, or change the port mapping in `docker-compose.yml` and `DATABASE_URL`
together.

This replaces the manual Postgres + embedding-service setup described in the rest of this
section with one command. Keep reading below for what `dev:up` does under the hood, how
to run everything manually instead (e.g. against a non-Docker or remote Postgres), and
the database-role hardening recommended beyond local dev.

### Prerequisites

*(Skip this and the following manual steps if you used the Docker quick start above.)*

- Node.js 22 (matches CI)
- A PostgreSQL database with the `pgvector` extension available (CI uses the `pgvector/pgvector:pg16` image)
- `DATABASE_URL` should point at a dedicated, minimally-privileged application role — not a superuser or the role used to run migrations (see [Database roles and connection hygiene](#database-roles-and-connection-hygiene) below)
- A Python environment able to run the embedding service (`src/embeddings/embedding_api.py`) — dependencies are pinned in `src/embeddings/requirements.txt`.

### Install

```bash
npm install
```

### Configure environment

Set the following environment variables (see `.env.example` for a starting point — note it does not currently list `EMBEDDING_API_URL`, `EMBEDDING_API_TIMEOUT_MS`, `PORT`, or `CHUNK_MAX_TOKENS`, since all four are optional with defaults):

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GROQ_API_KEY` | Yes | Used by `src/llm/llm-client.ts` for answer generation |
| `JWT_SECRET` | Yes | Shared secret used to verify `Bearer` JWTs on `POST /ai-agent` (`src/auth/authenticate.ts`); tokens are expected to be issued by the separate journal application, not this backend |
| `EMBEDDING_API_KEY` | Yes | Shared secret sent as a `Bearer` token to the embedding service (`src/embeddings/embedding-client.ts`); the same value must be set in the embedding service's own process environment (see below) |
| `EMBEDDING_API_URL` | No | Defaults to `http://127.0.0.1:8000` |
| `EMBEDDING_API_TIMEOUT_MS` | No | Defaults to 30000 |
| `PORT` | No | Defaults to 3000 |
| `CHUNK_MAX_TOKENS` | No | Overrides max tokens per document chunk for every `sourceType` during ingestion, bypassing `SOURCE_TYPE_CHUNK_CONFIG`'s per-`sourceType` defaults (`src/ingestion/chunking/document-chunker.ts`). Leave unset to let each `sourceType` use its own configured default (currently 300 for all of them — see `docs/02-architecture.md` D4). |
| `ALLOWED_ORIGIN` | No | Comma-separated list of allowed CORS origins. Unset reflects the request's own origin (no restriction) — low value until a real frontend is deployed at a known origin, at which point set this to lock CORS down. |
| `INJURY_MATCH_AMBIGUITY_MARGIN` | No | Defaults to 0.03. Cosine-distance margin used by `src/retrieval/injury-router.ts` to decide which injuries an unscoped question (no `injuryId`) routes to — see `docs/02-architecture.md` D11. |
| `MAX_MATCHED_INJURIES` | No | Defaults to 3. Caps how many near-tied injuries an unscoped question can route to (`src/retrieval/injury-router.ts`, D11). |
| `INJURY_MATCH_FALLBACK_DISTANCE` | No | Defaults to 0.62. If no injury's summary chunk beats this cosine distance for an unscoped question, it's treated as not being about any one injury and routes to all of them instead of an arbitrary subset (`src/retrieval/injury-router.ts`, D11). |

### Database

```bash
npx prisma generate
npx prisma migrate deploy
```

`npm run dev:up` runs these same two commands automatically against the Docker Postgres
container (see Quick start above).

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
- `npm run seed:dev` runs `prisma/seed-dev.ts`, which additionally requires `DATABASE_ENV=development`, `SEED_DEV_CONFIRM=true`, and a database named exactly `injury-journal-ai-db`. It resets data with `TRUNCATE ... RESTART IDENTITY`, so `DATABASE_URL` must point at a role that owns the seeded tables or otherwise holds `TRUNCATE` on each of them — the schema-owner role used for `prisma migrate deploy` satisfies this because it owns the tables it creates, but database ownership alone does not grant `TRUNCATE` on tables owned by another role. The minimal `injury_journal_ai_app` role described above is not sufficient for either seed script.

### Run the embedding service

`npm run dev:up` starts this in Docker automatically (see `src/embeddings/Dockerfile` and
Quick start above); use the steps below only if you want to run it directly on the host
instead.

Install the Python dependencies, then start `src/embeddings/embedding_api.py` (a FastAPI app
exposing `/embed` and `/embed-batch`) on whatever host/port `EMBEDDING_API_URL` points at, e.g.:

```bash
pip install -r src/embeddings/requirements.txt
EMBEDDING_API_KEY=<same value as the backend's .env> uvicorn src.embeddings.embedding_api:app --port 8000
```

`EMBEDDING_API_KEY` must be set in this process's own environment — it is a separate Python
process and does not read the Node backend's `.env` file. Every request must include
`Authorization: Bearer <EMBEDDING_API_KEY>`; the service rejects requests without it.

### Run the backend

```bash
npm run dev    # tsx watch, for development
npm run build  # tsc
npm start      # runs dist/index.js
```

## Usage

The API exposes two endpoints, both requiring a bearer token. The main one answers questions:

```bash
curl -X POST http://localhost:3000/ai-agent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT signed with JWT_SECRET>" \
  -d '{"question": "What treatments have I tried?", "injuryId": 1}'
```

`injuryId` is optional. The `Authorization` header is required (a `Bearer` JWT with a numeric
`sub` claim, signed with `JWT_SECRET`) — see the Project Status section above for what
authentication does and doesn't cover yet.

The second lists the authenticated user's injuries, so a frontend can offer a picker for that
`injuryId` instead of asking for a raw database id:

```bash
curl http://localhost:3000/injuries \
  -H "Authorization: Bearer <JWT signed with JWT_SECRET>"
```

> `GET /injuries` is temporary and a deliberate deviation from `docs/02-architecture.md` D10. The
> main journal application's own endpoint supersedes it once the two applications merge, at which
> point it is deleted — tracked in `#195`. See `docs/05-api-contract.md` §3.

### Frontend

The web UI lives in `frontend/` as a separate Next.js app (App Router, Tailwind v4, shadcn/ui). It
is its own npm project with its own dependencies, so install once before first use:

```bash
cd frontend
npm install
```

Run it alongside the backend — the API stays on port 3000, the UI on 3001:

```bash
npm run dev               # in the repo root: Express API on http://localhost:3000
cd frontend && npm run dev # in a second shell: UI on http://localhost:3001
```

`frontend/next.config.ts` proxies `/ai-agent` and `/injuries` to the API so the browser stays on one
origin and no `ALLOWED_ORIGIN`/CORS setup is needed for local development. Point it elsewhere with
`API_ORIGIN`.

Using the page: paste a bearer token, and when the field loses focus the **Injury** dropdown loads
that user's injuries from `GET /injuries`. Leave it on *All injuries* to search across all of them,
or pick one to scope the question to it. Then type a question and press **Ask**.

> `GET /injuries` is temporary. It exists only to populate this dropdown and is superseded by the
> main journal application's own endpoint once the two applications merge — see `#195` and
> `docs/02-architecture.md` D10.

This repo verifies but does not issue JWTs (a separate journal application is expected to own login,
see `docs/02-architecture.md` D10), so for local testing you need to mint your own token with
`JWT_SECRET`:

```bash
JWT_SECRET=<same value as .env> npx tsx -e "
import jwt from 'jsonwebtoken';
console.log(jwt.sign({ sub: '1' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' }));
"
```

Paste the printed token into the page's token field.

The `sub` claim **is** the user id — `authenticate` reads it as `Number(payload.sub)` and requires a
positive integer, so `sub: '1'` means "act as user 1". Two things to watch for locally:

- `JWT_SECRET` must be non-empty in `.env`. If it is blank, every request returns
  `500 internal_error` rather than a 401, because `authenticate` cannot verify anything.
- `npm run seed:dev` deletes and recreates its users, so Postgres autoincrement keeps climbing —
  after a few reseeds the seeded users may be `4, 5, 6` rather than `1, 2, 3`. If the injury
  dropdown loads but is empty, the token is valid for a user id that has no data.

UI conventions (component library, design tokens, spacing, component patterns) are documented in
`UI_GUIDE.md` — read it before changing anything under `frontend/`.

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

### Chunk-size evaluation sweep

```bash
DATABASE_ENV=development npm run eval:chunk-size
```

Re-ingests the seeded dev dataset and re-runs the AI-system evaluation harness
(`evaluation/ai-system/`) at several `CHUNK_MAX_TOKENS` candidates, printing a comparison table of
retrieval/citation/faithfulness pass rates per size. Needs the same setup as `npm run ingest` (a
seeded `injury-journal-ai-db`, the embedding service running, `GROQ_API_KEY` set) plus
`DATABASE_ENV=development` as a guard against running it against the wrong database — it re-runs
ingestion multiple times in a loop, so it's more destructive than a single `npm run ingest`. See
`docs/02-architecture.md` D4 for the last recorded result.
