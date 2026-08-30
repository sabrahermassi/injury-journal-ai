# Injury Journal AI — API Contract

This document replaces the earlier `docs/handoff/contracts-review.md` working file (removed as
part of the handoff-file cleanup). It is a committed, permanent reference — keep it in sync with
the code, not the other way around. Where this document and the code disagree, the code is
correct.

## 1. Scope

Two HTTP endpoints exist today, under a single Express app (`src/app.ts`), both requiring a bearer
token (see §2): `POST /ai-agent`, and `GET /injuries`. Nothing else is exposed — no CRUD, no
identity/session endpoints, no health check.

`GET /injuries` is **temporary and deliberately out of line with D10**
(`docs/02-architecture.md`), which assigns listing endpoints to the separate journal application.
It exists only so the local frontend can offer an injury picker rather than asking the user to type
a raw database id. The main application's own `GET /injuries` supersedes it when the two
applications merge, at which point it is deleted — tracked in #195. Do not build anything further
on it.

`POST /rag/ask` previously existed as a second, narrower entrypoint to the same underlying
`answerQuestion()` function, but has been retired (issue #43, `docs/02-architecture.md` D7) —
`/ai-agent`'s `rag` intent already called that same function directly, so no capability was lost.
`answerQuestion()` (`src/rag/rag-service.ts`) remains as an internal function used by
`ragTool.ts`.

## 2. Authentication

**Required and enforced.** `POST /ai-agent` is protected by `authenticate` middleware
(`src/auth/authenticate.ts`): callers must send `Authorization: Bearer <JWT>`, signed with the
shared `JWT_SECRET` (HS256) and carrying a numeric `sub` claim. A missing/malformed header, or an
invalid/expired/wrong-signature token, returns `401`. On success the middleware sets `req.userId`
from the token's `sub`.

`req.userId` is used downstream to scope every tool and vector query (issue #95, done):

- `searchSimilarChunks` (`vector-storage.ts`) filters by `userId` (a real, indexed column on
  `DocumentChunk`, issue #41), in addition to the optional `injuryId`/`sourceType` filters.
- `journalTool` (`journal-tool.ts`) scopes its `prisma.injury.findUnique` lookup to the
  authenticated `userId`, not just the record `id`.

An authenticated caller can no longer read another user's chunks or journal record by
guessing/knowing an `injuryId`. See CLAUDE.md §9 on user-level data isolation.

## 3. Endpoints

### `POST /ai-agent`

**Request body**

| Field       | Type     | Required | Validation |
|-------------|----------|----------|------------|
| `question`  | `string` | yes      | non-empty after trim, max 10,000 characters |
| `injuryId`  | `number` | no       | `Number.isSafeInteger`, `> 0`, **and** `<= 2147483647` |

**Response — 200, shape depends on which internal path ran. An `intent` field
(`"safety" | "journal" | "rag"`) is included on every response so the frontend can discriminate
the branch without inferring it from shape (resolved as part of issue #45):**

| Path | Body |
|------|------|
| Safety-blocked | `{ "answer": "<refusal>", "citations": [], "intent": "safety", "metadata": { "retrievedChunks": [] } }` |
| `journal` intent, no `injuryId` given | `{ "answer": "An injury must be selected for journal questions.", "citations": [], "intent": "journal" }` — **no `metadata` key at all** |
| `journal` intent, `injuryId` not found | `{ "answer": "No injury record was found.", "citations": [], "intent": "journal" }` — **no `metadata` key** |
| `journal` intent, found | `{ "answer": "<LLM-generated prose summary of the injury record>", "citations": [], "intent": "journal" }` — generated via `formatInjuryRecord()` → `checkContentSafety()` → `buildUserPrompt()` → `generateAnswer()`; there's still no `metadata` key |
| `journal` intent, generation failed | `{ "answer": "Unable to generate a summary from your injury record right now.", "citations": [], "intent": "journal" }` — `generateAnswer()` returned an empty string (e.g. LLM service returned no content); **no `metadata` key** |
| `journal` intent, content-safety blocked | `{ "answer": "<refusal>", "citations": [], "intent": "journal" }` — `checkContentSafety()` flagged the formatted injury record itself (not the question) before any LLM call; **no `metadata` key**, same shape as the other journal early-return rows (issue #66) |
| `rag` intent | `{ "answer": "string", "citations": [...], "intent": "rag", "metadata": { "retrievedChunks": [{ "sourceType": "string", "sourceId": 1 }] } }` |
| `safety` intent from `routeIntent()` | `{ "answer": "<refusal>", "citations": [], "intent": "safety", "metadata": { "retrievedChunks": [] } }` — same message/shape as the "Safety-blocked" row above, produced by a second, narrower keyword check (see note below) rather than the main `checkSafety` gate |

**Note — two distinct safety-routing paths, not a documentation gap:** `routeIntent()` can return
`'safety'` as an `AgentIntent` (it's a defined member of the type and is returned when the
question matches a small keyword list — `diagnose`, `do i have`, `cancer`, `condition`).
`runAgent`'s `switch` has a `case 'safety':` that returns the same refusal shape as the main
safety gate. This is separate from — and less thorough than — the actual safety gate that already
runs earlier in the same function (`checkSafety`/`safetyTool`, a much larger regex set in
`safety-service.ts`). The two mechanisms overlap but are not identical: a question that slips past
`checkSafety` but matches `routeIntent`'s narrower list still gets a proper refusal, just via the
second path. Reconciling the two keyword sets is out of scope for issue #86, which only closed the
missing-switch-case defect.

**Errors**

Every error body includes a machine-readable `code` field alongside `error` (issue #123).
500s further distinguish the failing dependency where the thrown error type allows it (issue #172):

| Status | Body | Trigger |
|--------|------|---------|
| 401 | `{ "error": "Authentication required", "code": "authentication_required" }` | `Authorization: Bearer <token>` header missing or malformed |
| 401 | `{ "error": "Invalid or expired token", "code": "invalid_token" }` | token present but fails signature/expiry/claim verification |
| 400 | `{ "error": "Question is required", "code": "question_required" }` | body present but `question` missing/blank |
| 400 | `{ "error": "Question exceeds maximum length of 10000 characters", "code": "question_too_long" }` | `question` longer than the 10,000-character limit |
| 400 | `{ "error": "Invalid injuryId", "code": "invalid_injury_id" }` | `injuryId` present but fails the check above |
| 429 | `{ "error": "Too many requests, please try again later.", "code": "rate_limited" }` | two-tier limiting (issue #89, refined by #145): a lenient per-IP limiter (40 req/60s) runs before `authenticate` to bound anonymous/invalid-token request volume, and a stricter per-user limiter (20 req/60s, keyed by `req.userId`) runs after — so one client's failed-auth traffic can no longer exhaust another authenticated user's budget on a shared IP. The IP limiter is kept at only 2x the per-user limit, not looser, so it still bounds worst-case LLM/embedding cost-abuse from a multi-account attacker sharing one IP. |
| 500 | `{ "error": "Failed to process request", "code": "embedding_service_error" }` | the embedding service call (`src/embeddings/embedding-client.ts`) failed — missing `EMBEDDING_API_KEY`, network/connection failure, non-OK HTTP response, or an invalid/malformed response shape |
| 500 | `{ "error": "Failed to process request", "code": "database_error" }` | Prisma threw `PrismaClientKnownRequestError` or `PrismaClientInitializationError` (query failure or DB unreachable) |
| 500 | `{ "error": "Failed to process request", "code": "llm_service_error" }` | the Groq LLM call threw a `Groq.APIError` (or subclass — rate limit, auth, connection, etc.) |
| 500 | `{ "error": "Failed to process request", "code": "internal_error" }` | fallback for any other unexpected exception, including a missing `JWT_SECRET` in `authenticate.ts` |

`askAgent` destructures `req.body ?? {}`, so a body-less `POST /ai-agent` returns the 400 above
rather than a 500 (fixed as issue #61).

**Pagination / filtering:** none exposed. `injuryId` is the only filter, with a fixed internal
limit of `5` for the `rag` intent path.

### `GET /injuries`

Temporary — see §1 and #195. Lists the authenticated user's injuries so a frontend can offer a
picker for the `injuryId` field of `POST /ai-agent`.

**Request:** no body, no query parameters. `Authorization: Bearer <jwt>` required.

**200 response:**

```json
{
  "injuries": [
    { "id": 7, "name": "Knee pain", "bodyArea": "knee", "side": "left" },
    { "id": 3, "name": "Hip pain", "bodyArea": "hip", "side": null }
  ]
}
```

Ordered by `startDate` descending, then `id` ascending. Always scoped to the authenticated
`userId` — a user can never see another user's injuries. Returns `{ "injuries": [] }` rather than a
404 when the user has none. The object wrapper (rather than a bare array) leaves room to add
pagination later without a breaking change.

The four fields are exactly what a picker needs; this is deliberately not a general-purpose
`Injury` read model, since D10 assigns that to the separate journal application.

| Status | Body | When |
|---|---|---|
| 401 | `{ "error": "Authentication required", "code": "authentication_required" }` | missing or unparseable `Authorization` header |
| 401 | `{ "error": "Invalid or expired token", "code": "invalid_token" }` | token fails verification (see §2) |
| 429 | `{ "error": "Too many requests, please try again later.", "code": "rate_limited" }` | same two-tier limiting as `/ai-agent` (see §3 above): the shared per-IP limiter (40 req/60s) runs before `authenticate`, then a per-user limiter of 60 req/60s keyed by `req.userId` runs after. The per-user budget is its own instance, deliberately more generous than `/ai-agent`'s 20 — this is a cheap indexed read, and reloading the injury picker must not spend the user's question budget. |
| 500 | `{ "error": "Failed to process request", "code": "database_error" }` | Prisma threw `PrismaClientKnownRequestError` or `PrismaClientInitializationError` |
| 500 | `{ "error": "Failed to process request", "code": "internal_error" }` | fallback for any other unexpected exception, including a missing `JWT_SECRET` |

## 4. Domain objects returned to the frontend

- **Citation** — `{ sourceType: string, sourceId: number, label: string, injuryId: number,
  injuryName?: string, date?: string }`. `injuryName` is present only when the id resolves in the
  request's injury-name lookup (issue #208); it is always populated for the `injuryId`-scoped path
  and for an unscoped `rag` query as long as the injury still exists. Built by `citation-builder.ts`,
  then filtered by `citation-verifier.ts` (issue #124): a citation is only returned to the caller if
  its `sourceId`/`injuryId` still resolve to a real row of the matching type (`treatment`,
  `medical_visit`, `symptom`, `timeline_event`, or `injury`) — guarding against a chunk's metadata
  drifting from the underlying Prisma row, since the vector store keeps no FK to it.
- **Journal answer** (journal path only) — an LLM-generated prose summary of the `Injury` record
  and its nested `Treatment[]`, `Symptom[]`, `TimelineEvent[]`, `MedicalVisit[]`, built via
  `formatInjuryRecord()` → `checkContentSafety()` → `buildUserPrompt()` → `generateAnswer()`, not
  the raw Prisma row.
- **`metadata.retrievedChunks`** (`rag`/safety/default paths only) — `{ sourceType, sourceId }[]`,
  a 2-field projection of the underlying `DocumentChunk` row (not the raw row itself).

## 5. Contract inconsistencies and instability

- **The `journal` intent produces an LLM-generated prose answer**, not a structured field-by-field
  breakdown of the record — quality depends on the LLM correctly summarizing the context built by
  `formatInjuryRecord()`.
- **Two overlapping-but-not-identical safety-detection mechanisms** (the main `checkSafety` gate
  and `routeIntent()`'s narrower keyword list) both feed into the same `'safety'` intent/response
  shape — see §3. Fixed as issue #86 (the switch previously had no case for the `routeIntent()`
  path); reconciling the two keyword sets themselves remains unaddressed.
- **An unused, unwired duplicate entrypoint exists in the codebase**:
  `src/ai-assistant/ai-assistant-api.ts` (a thin, otherwise-unused wrapper around `runAgent`). It is
  not reachable from any route. (`src/ai-agent/ai-agent-service.ts`, a dead duplicate of
  `ai-agent-orchestrator.ts`, was removed — issue #46.)
- **`citation-formatter.ts` is unwired.** It reshapes a `Citation[]` into a display-friendly
  `{ title, type, date? }`, but nothing calls it — see issue #237. `citation-source-mapper.ts`, a
  second overlapping module with no ownership check, was retired as part of #124 rather than
  extended, since `citation-verifier.ts` now covers the same ground more safely.
- **500 responses distinguish the failing dependency where the thrown error type allows it (issue
  #172)**, but not further than that: `embedding_service_error` covers every embedding-client
  failure (missing key, network failure, non-OK response, invalid shape) without distinguishing
  those from each other, and any exception the controller doesn't recognize (e.g. a missing
  `JWT_SECRET`) still falls back to the generic `internal_error`.

## 6. What the frontend will need that the backend doesn't provide yet

This is the most important section — these are gaps, not just documentation debt:

- **A token issuer.** This repo verifies a `Bearer` JWT (issue #94) but does not issue one — by
  design (D10, `docs/02-architecture.md`), the separate journal application is expected to own
  login/session issuance. A frontend needs that other application's login flow before it can call
  this API at all.
- **An identity endpoint** — no `GET /me`. Out of scope here under D10
  (`docs/02-architecture.md`); expected to come from the separate journal application.
- **~~No `GET /injuries`~~ — partially closed, temporarily.** `GET /injuries` now exists (§3) so the
  local frontend can offer an injury picker instead of asking the user to type a raw database id.
  This is a deliberate deviation from D10, not a reversal of it: the endpoint is minimal
  (four fields, no pagination, no CRUD), and the main application's own `GET /injuries` supersedes
  it when the two applications merge. Removal is tracked in #195. Per-user data isolation
  (issue #95) applies to it as it does everywhere else.
- **CRUD for `Injury` and its child records** (`Treatment`, `Symptom`, `TimelineEvent`,
  `MedicalVisit`). Today the only read path is `journalTool`'s single `findFirst` (scoped to the
  authenticated `userId`), and there is no create/update/delete for any of these at all —
  deliberately, per D10: this repo stays read-only/AI-only, and CRUD is expected to live in the
  separate journal application (#50, closed as out-of-scope).
- **Pagination or a client-settable retrieval limit.** The `rag` intent path hardcodes `5`
  internally with no way for the frontend to request more, or to page through additional chunks.
- **Finer-grained 500 codes than the three dependency buckets.** Issue #172 split 500s into
  `embedding_service_error` / `database_error` / `llm_service_error` / `internal_error` (see §3),
  but a UI still can't tell e.g. "embedding service unreachable" apart from "embedding service
  returned a malformed response" — both share `embedding_service_error`.
- **Conversation/thread state.** Every call is fully stateless — no way to support a multi-turn
  conversation UI without the frontend re-sending full context itself (and there's currently no
  mechanism to do even that).
- **Streaming.** Evaluated and deliberately deferred (#52): the LLM call stays fully buffered
  (`generateAnswer` awaits the entire completion), and the endpoint returns one completed answer
  together with its chunk-derived citations in a single JSON object. No frontend consumer exists
  yet to justify the added complexity of streaming. Revisit if/when a frontend is built and latency
  proves to be a real UX problem.
- **An explicit groundedness/confidence signal (partially addressed, #122).** CLAUDE.md's stated
  priority — prefer an explicit lack-of-information response over an unsupported plausible answer —
  is now enforced structurally for the "nothing close enough was retrieved" case: `searchSimilarChunks`
  applies a cosine-distance cutoff (`maxDistance`, default `0.7`, not yet evaluation-tuned — see D5
  in `docs/02-architecture.md`), and `rag-service.ts` returns a fixed no-relevant-context answer with
  `chunks: []`/`citations: []` when nothing passes it, without calling the LLM. This is still not
  surfaced as a distinct field the frontend could branch on (e.g. no `metadata.groundedness` flag) —
  a caller can only infer it from `retrievedChunks` being empty and matching the reserved wording,
  not from a dedicated signal. The prompt-level soft instruction in `prompt-builder.ts` still remains
  as a second layer for cases where chunks *are* retrieved but don't actually answer the question.

## 7. Change discipline

Treat this file as load-bearing once a frontend exists against it. A change to the endpoint's
request/response shape, validation, or error format is a **frontend contract change** — update
this document in the same PR as the code change, not after.
