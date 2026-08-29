# Injury Journal AI — API Contract

This document replaces the earlier `docs/handoff/contracts-review.md` working file (removed as
part of the handoff-file cleanup). It is a committed, permanent reference — keep it in sync with
the code, not the other way around. Where this document and the code disagree, the code is
correct.

## 1. Scope

One HTTP endpoint exists today, under a single Express app (`src/app.ts`): `POST /ai-agent`,
which requires a bearer token (see §2). Nothing else is exposed — no CRUD, no identity/session
endpoints, no health check.

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

Every error body now includes a machine-readable `code` field alongside `error` (issue #123):

| Status | Body | Trigger |
|--------|------|---------|
| 401 | `{ "error": "Authentication required", "code": "authentication_required" }` | `Authorization: Bearer <token>` header missing or malformed |
| 401 | `{ "error": "Invalid or expired token", "code": "invalid_token" }` | token present but fails signature/expiry/claim verification |
| 400 | `{ "error": "Question is required", "code": "question_required" }` | body present but `question` missing/blank |
| 400 | `{ "error": "Question exceeds maximum length of 10000 characters", "code": "question_too_long" }` | `question` longer than the 10,000-character limit |
| 400 | `{ "error": "Invalid injuryId", "code": "invalid_injury_id" }` | `injuryId` present but fails the check above |
| 429 | `{ "error": "Too many requests, please try again later.", "code": "rate_limited" }` | two-tier limiting (issue #89, refined by #145): a lenient per-IP limiter (40 req/60s) runs before `authenticate` to bound anonymous/invalid-token request volume, and a stricter per-user limiter (20 req/60s, keyed by `req.userId`) runs after — so one client's failed-auth traffic can no longer exhaust another authenticated user's budget on a shared IP. The IP limiter is kept at only 2x the per-user limit, not looser, so it still bounds worst-case LLM/embedding cost-abuse from a multi-account attacker sharing one IP. |
| 500 | `{ "error": "Failed to process request", "code": "internal_error" }` | catch-all — embedding service down, DB error, LLM call failure/invalid key, missing `JWT_SECRET`. All still collapse to the single `internal_error` code; it distinguishes 500s from other failure classes but not from each other. |

`askAgent` destructures `req.body ?? {}`, so a body-less `POST /ai-agent` returns the 400 above
rather than a 500 (fixed as issue #61).

**Pagination / filtering:** none exposed. `injuryId` is the only filter, with a fixed internal
limit of `5` for the `rag` intent path.

## 4. Domain objects returned to the frontend

- **Citation** — `{ sourceType: string, sourceId: number, label: string, date?: string }`. Built
  by `citation-builder.ts`, the only citation module actually wired into a response path.
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
- **Citation enrichment is unwired and incomplete even if wired.** `citation-verifier.ts` and
  `citation-formatter.ts` are not called from any response path. `citation-source-mapper.ts` is
  also unwired, and even if it were, it only maps 2 of the 5 valid `sourceType` values
  (`treatment`, `medical_visit` — missing `symptom`, `timeline_event`, `injury`).
- **All 4xx/429 failure modes have a distinct `code` (issue #123), but 500s do not.** A client can
  now tell "authentication required" from "rate limited" from "question too long" apart, but every
  500 still reports `code: "internal_error"` regardless of whether the cause was the embedding
  service being unreachable, a database error, or an LLM call failure — 500 causes are not
  distinguishable from the response alone.

## 6. What the frontend will need that the backend doesn't provide yet

This is the most important section — these are gaps, not just documentation debt:

- **A token issuer.** This repo verifies a `Bearer` JWT (issue #94) but does not issue one — by
  design (D10, `docs/02-architecture.md`), the separate journal application is expected to own
  login/session issuance. A frontend needs that other application's login flow before it can call
  this API at all.
- **Any identity/listing endpoint** — no `GET /me`, no `GET /injuries`. Per-user data isolation
  is enforced (issue #95, done), but a frontend still has no way to *discover* which injuries
  belong to the current user from this API — out of scope here under D10 (`docs/02-architecture.md`);
  expected to come from the separate journal application.
- **CRUD for `Injury` and its child records** (`Treatment`, `Symptom`, `TimelineEvent`,
  `MedicalVisit`). Today the only read path is `journalTool`'s single `findFirst` (scoped to the
  authenticated `userId`), and there is no create/update/delete for any of these at all —
  deliberately, per D10: this repo stays read-only/AI-only, and CRUD is expected to live in the
  separate journal application (#50, closed as out-of-scope).
- **Pagination or a client-settable retrieval limit.** The `rag` intent path hardcodes `5`
  internally with no way for the frontend to request more, or to page through additional chunks.
- **Structured error information for 500s specifically.** Issue #123 added a `code` field
  distinguishing every 4xx/429 case (see §3), but all 500s still share one `internal_error` code —
  a UI still can't tell "service temporarily unavailable" apart from other internal failures.
- **Conversation/thread state.** Every call is fully stateless — no way to support a multi-turn
  conversation UI without the frontend re-sending full context itself (and there's currently no
  mechanism to do even that).
- **Streaming.** Evaluated and deliberately deferred (#52): the LLM call stays fully buffered
  (`generateAnswer` awaits the entire completion), and the endpoint returns one completed answer
  together with its chunk-derived citations in a single JSON object. No frontend consumer exists
  yet to justify the added complexity of streaming. Revisit if/when a frontend is built and latency
  proves to be a real UX problem.
- **An explicit groundedness/confidence signal.** CLAUDE.md's stated priority — prefer an
  explicit lack-of-information response over an unsupported plausible answer — is enforced only
  as a soft instruction inside the LLM prompt (`prompt-builder.ts`), not as a structural check or
  a field the frontend could branch on (e.g., "zero chunks retrieved" or "low similarity" is not
  surfaced anywhere in the response).

## 7. Change discipline

Treat this file as load-bearing once a frontend exists against it. A change to the endpoint's
request/response shape, validation, or error format is a **frontend contract change** — update
this document in the same PR as the code change, not after.
