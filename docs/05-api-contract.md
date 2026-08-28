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

**Required, but not yet enforced past the door.** `POST /ai-agent` is protected by
`authenticate` middleware (`src/auth/authenticate.ts`): callers must send
`Authorization: Bearer <JWT>`, signed with the shared `JWT_SECRET` (HS256) and carrying a numeric
`sub` claim. A missing/malformed header, or an invalid/expired/wrong-signature token, returns
`401`. On success the middleware sets `req.userId` from the token's `sub`.

`req.userId` is **not yet used for anything downstream** — no route or tool filters by it. Every
authenticated user can still read any other user's data. Concretely:

- `searchSimilarChunks` (`vector-storage.ts`) filters only by the optional `injuryId` (it also
  accepts an optional `sourceType`, but no production caller passes one) — never by owner.
- `journalTool` (`journal-tool.ts`) does a bare `prisma.injury.findUnique({ where: { id } })` —
  no owner check.

Any authenticated caller who knows or guesses an `injuryId` can read that injury's chunks and full
journal record. This is a known, unaddressed authorization gap — issue #95 — distinct from
authentication itself (issue #94, done). See CLAUDE.md §9 on user-level data isolation.

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
| `journal` intent, found | `{ "answer": "<LLM-generated prose summary of the injury record>", "citations": [], "intent": "journal" }` — generated via `formatInjuryRecord()` → `buildPrompt()` → `generateAnswer()`; there's still no `metadata` key |
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

| Status | Body | Trigger |
|--------|------|---------|
| 401 | `{ "error": "Authentication required" }` | `Authorization: Bearer <token>` header missing or malformed |
| 401 | `{ "error": "Invalid or expired token" }` | token present but fails signature/expiry/claim verification |
| 400 | `{ "error": "Question is required" }` | body present but `question` missing/blank |
| 400 | `{ "error": "Invalid injuryId" }` | `injuryId` present but fails the check above |
| 429 | `{ "error": "Too many requests, please try again later." }` | more than 20 requests from the same IP within a 60s window (issue #89) |
| 500 | `{ "error": "Failed to process request" }` | catch-all — embedding service down, DB error, LLM call failure/invalid key. All collapse to this one message; no error code/type distinguishes the cause. |

`askAgent` destructures `req.body ?? {}`, so a body-less `POST /ai-agent` returns the 400 above
rather than a 500 (fixed as issue #61).

**Pagination / filtering:** none exposed. `injuryId` is the only filter, with a fixed internal
limit of `5` for the `rag` intent path.

## 4. Domain objects returned to the frontend

- **Citation** — `{ sourceType: string, sourceId: number, label: string, date?: string }`. Built
  by `citation-builder.ts`, the only citation module actually wired into a response path.
- **Journal answer** (journal path only) — an LLM-generated prose summary of the `Injury` record
  and its nested `Treatment[]`, `Symptom[]`, `TimelineEvent[]`, `MedicalVisit[]`, built via
  `formatInjuryRecord()` → `buildPrompt()` → `generateAnswer()`, not the raw Prisma row.
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
- **All failure modes collapse into one generic 500 message** — a client cannot distinguish
  "embedding service unreachable" from "database error" from "LLM call failed" from an unexpected
  exception.

## 6. What the frontend will need that the backend doesn't provide yet

This is the most important section — these are gaps, not just documentation debt:

- **A token issuer.** This repo verifies a `Bearer` JWT (issue #94) but does not issue one — by
  design (D10, `docs/02-architecture.md`), the separate journal application is expected to own
  login/session issuance. A frontend needs that other application's login flow before it can call
  this API at all.
- **Per-user data isolation.** The verified `userId` isn't used to filter retrieval or journal
  results yet (issue #95, open) — any authenticated caller can still read any other user's data
  (see CLAUDE.md §9, and roadmap #31).
- **Any identity/listing endpoint** — no `GET /me`, no `GET /injuries`. A frontend has no way to
  discover which injuries belong to the current user even once #95 lands.
- **CRUD for `Injury` and its child records** (`Treatment`, `Symptom`, `TimelineEvent`,
  `MedicalVisit`). Today the only read path is `journalTool`'s single `findUnique`, and there is
  no create/update/delete for any of these at all.
- **Pagination or a client-settable retrieval limit.** The `rag` intent path hardcodes `5`
  internally with no way for the frontend to request more, or to page through additional chunks.
- **Structured error information.** A `code`/`type` field distinct from the current single
  generic error string, so the UI can differentiate "no results found," "service temporarily
  unavailable," and "invalid input" instead of showing the same failure state for all three.
- **Conversation/thread state.** Every call is fully stateless — no way to support a multi-turn
  conversation UI without the frontend re-sending full context itself (and there's currently no
  mechanism to do even that).
- **Streaming.** The LLM call is fully buffered (`generateAnswer` awaits the entire completion)
  before any response is returned — no partial/streaming UX is possible today.
- **An explicit groundedness/confidence signal.** CLAUDE.md's stated priority — prefer an
  explicit lack-of-information response over an unsupported plausible answer — is enforced only
  as a soft instruction inside the LLM prompt (`prompt-builder.ts`), not as a structural check or
  a field the frontend could branch on (e.g., "zero chunks retrieved" or "low similarity" is not
  surfaced anywhere in the response).

## 7. Change discipline

Treat this file as load-bearing once a frontend exists against it. A change to the endpoint's
request/response shape, validation, or error format is a **frontend contract change** — update
this document in the same PR as the code change, not after.
