# Injury Journal AI — API Contract

This document replaces the earlier `docs/handoff/contracts-review.md` working file (removed as
part of the handoff-file cleanup). It is a committed, permanent reference — keep it in sync with
the code, not the other way around. Where this document and the code disagree, the code is
correct.

## 1. Scope

Two HTTP endpoints exist today, both under a single unauthenticated Express app
(`src/app.ts`): `POST /rag/ask` and `POST /ai-agent`. Nothing else is exposed — no CRUD, no
identity/session endpoints, no health check.

## 2. Authentication

**None.** There is no auth middleware anywhere in `app.ts`/`index.ts`, no session, and no
`userId` derived from request context at any layer. Every request is anonymous. Concretely:

- `searchSimilarChunks` (`vector-storage.ts`) filters only by the optional `injuryId` — never by
  owner.
- `journalTool` (`journal-tool.ts`) does a bare `prisma.injury.findUnique({ where: { id } })` —
  no owner check.

Any caller who knows or guesses an `injuryId` can read that injury's chunks and full journal
record. This is a known, unaddressed gap (see CLAUDE.md §9 on user-level data isolation).

## 3. Endpoints

### `POST /rag/ask`

**Request body**

| Field       | Type     | Required | Validation |
|-------------|----------|----------|------------|
| `question`  | `string` | yes      | non-empty after trim |
| `injuryId`  | `number` | no       | `Number.isInteger` and `> 0` — **no upper bound** |

**Response — 200**

```jsonc
{
  "answer": "string",
  "citations": [
    { "sourceType": "string", "sourceId": 1, "label": "string", "date": "string?" }
  ],
  "chunks": [
    {
      "id": 1,
      "injuryId": 1,
      "sourceType": "string",
      "sourceId": 1,
      "chunkIndex": 0,
      "content": "string",
      "metadata": {},
      "distance": 0.0
    }
  ]
}
```

`chunks` is the **raw** `DocumentChunk` row set returned by the vector search, not a
citation-shaped subset — full `content` (raw journal text) and `metadata` are returned to the
client, not just what citations need.

If the safety check (`checkSafety`) rejects the question, the response is still **200**, not an
error:

```jsonc
{ "answer": "<refusal message>", "chunks": [], "citations": [] }
```

**Errors**

| Status | Body | Trigger |
|--------|------|---------|
| 400 | `{ "error": "Question must be a non-empty string" }` | missing/blank `question` |
| 400 | `{ "error": "injuryId must be a positive integer" }` | `injuryId` present but not a positive integer |
| 500 | `{ "error": "Failed to generate answer" }` | anything else — embedding service down, DB error, LLM call failure/invalid key. All collapse to this one message; no error code/type distinguishes the cause. |

**Pagination / filtering:** none exposed. `injuryId` is the only filter. Result size is capped
by an internal `limit` parameter (default `5`, not client-settable).

### `POST /ai-agent`

**Request body**

| Field       | Type     | Required | Validation |
|-------------|----------|----------|------------|
| `question`  | `string` | yes      | non-empty after trim |
| `injuryId`  | `number` | no       | `Number.isSafeInteger`, `> 0`, **and** `<= 2147483647` |

Note the validation is **not the same** as `/rag/ask`'s — different integer check, different
upper bound (`/rag/ask` has none), different error message text and shape. If a frontend shares
one validation function between the two endpoints today, it will be wrong for one of them.

**Response — 200, shape depends on which internal path ran, with no field indicating which:**

| Path | Body |
|------|------|
| Safety-blocked | `{ "answer": "<refusal>", "citations": [], "metadata": { "retrievedChunks": [] } }` |
| `journal` intent, no `injuryId` given | `{ "answer": "An injury must be selected for journal questions.", "citations": [] }` — **no `metadata` key at all** |
| `journal` intent, `injuryId` not found | `{ "answer": "No injury record was found.", "citations": [] }` — **no `metadata` key** |
| `journal` intent, found | `{ "answer": "<JSON.stringify of the raw Injury row, including nested Treatment/Symptom/TimelineEvent/MedicalVisit arrays>", "citations": [] }` — **`answer` is not prose**, and there's still no `metadata` key |
| `rag` intent | `{ "answer": "string", "citations": [...], "metadata": { "retrievedChunks": [{ "sourceType": "string", "sourceId": 1 }] } }` |
| Unrecognized intent (and see note below) | `{ "answer": "Unable to determine how to handle this request.", "citations": [], "metadata": { "retrievedChunks": [] } }` |

**Important internal inconsistency, not just a documentation gap:** `routeIntent()` can return
`'safety'` as an `AgentIntent` (it's a defined member of the type and is returned when the
question matches a small keyword list — `diagnose`, `do i have`, `cancer`, `condition`). But
`runAgent`'s `switch` has no `case 'safety':` — it only handles `'journal'` and `'rag'`
explicitly. A `'safety'`-routed question therefore falls into the generic default branch
("Unable to determine how to handle this request.") instead of a safety refusal. This is separate
from — and less thorough than — the actual safety gate that already runs earlier in the same
function (`checkSafety`/`safetyTool`, a much larger regex set in `safety-service.ts`). The two
mechanisms overlap but are not identical, and only one of them is actually wired to produce a
refusal response.

**Errors**

| Status | Body | Trigger |
|--------|------|---------|
| 400 | `{ "error": "Question is required" }` | body present but `question` missing/blank |
| 400 | `{ "error": "Invalid injuryId" }` | `injuryId` present but fails the check above |
| 500 | `{ "error": "Failed to process request" }` | same catch-all collapse as `/rag/ask`, **and also a body-less request entirely** — `askAgent` destructures `req.body` with no fallback for `undefined`, so a `POST /ai-agent` sent with no body at all (Express 5 leaves `req.body` undefined in that case) throws before validation runs and is caught by the generic 500 handler instead of returning the 400 above. `/rag/ask`'s controller has an `req.body ?? {}` fallback that avoids this; `/ai-agent`'s does not. Tracked as issue #61. |

**Pagination / filtering:** none, same constraints as `/rag/ask` (fixed internal limit of `5` for
the `rag` intent path).

## 4. Domain objects returned to the frontend

- **Citation** — `{ sourceType: string, sourceId: number, label: string, date?: string }`. Built
  by `citation-builder.ts`, the only citation module actually wired into a response path.
- **RetrievedChunk** (`/rag/ask` only) — the raw `DocumentChunk` row: `id`, `injuryId`,
  `sourceType`, `sourceId`, `chunkIndex`, `content`, `metadata`, `distance`.
- **Raw Injury record** (`/ai-agent` journal path only, stringified) — `Injury` plus nested
  `Treatment[]`, `Symptom[]`, `TimelineEvent[]`, `MedicalVisit[]`, exactly as Prisma returns it.
- **`metadata.retrievedChunks`** (`/ai-agent`, `rag`/safety/default paths only) —
  `{ sourceType, sourceId }[]`, a smaller projection than `/rag/ask`'s `chunks`.

There is no single shared "chunk" or "source" shape across the two endpoints — `/rag/ask` returns
full rows, `/ai-agent` returns a 2-field projection of the same underlying data.

## 5. Contract inconsistencies and instability

- **Duplicate, divergent `injuryId` validation** across the two endpoints (see §3 tables above).
- **`/ai-agent`'s response is not self-describing.** A frontend must infer which branch ran from
  the shape of the response (presence/absence of `metadata`, whether `answer` looks like JSON)
  rather than from an explicit field. Tracked as a roadmap item (surface `AgentState.intent` in
  the response).
- **The `journal` intent's placeholder behavior** (`JSON.stringify(injury)` as `answer`) is
  explicitly known and tracked (`docs/04-implementation-roadmap.md`), not a stable contract to
  build a frontend against yet.
- **The dead `'safety'` intent branch** described in §3 — a real inconsistency between the type
  system (`AgentIntent`) and the orchestrator's actual handling, not just a documentation gap.
- **Two unused, unwired duplicate entrypoints exist in the codebase**:
  `src/ai-agent/ai-agent-service.ts` (a dead duplicate of `ai-agent-orchestrator.ts`, already
  flagged in CLAUDE.md §8) and `src/ai-assistant/ai-assistant-api.ts` (a thin, otherwise-unused
  wrapper around `runAgent`). Neither is reachable from any route. A frontend engineer grepping
  the codebase for "the agent entrypoint" could easily land on the wrong one.
- **Citation enrichment is unwired and incomplete even if wired.** `citation-verifier.ts` and
  `citation-formatter.ts` are not called from any response path. `citation-source-mapper.ts` is
  also unwired, and even if it were, it only maps 2 of the 5 valid `sourceType` values
  (`treatment`, `medical_visit` — missing `symptom`, `timeline_event`, `injury`).
- **`/rag/ask` returns more raw data than a UI is likely to need** — full chunk `content` (raw
  journal text) and `metadata`, with no redaction or minimization, versus `/ai-agent`'s much
  smaller `retrievedChunks` projection for conceptually the same retrieval step.
- **All failure modes collapse into one generic 500 message** on both endpoints — a client cannot
  distinguish "embedding service unreachable" from "database error" from "LLM call failed" from
  an unexpected exception.

## 6. What the frontend will need that the backend doesn't provide yet

This is the most important section — these are gaps, not just documentation debt:

- **Authentication and session/identity, entirely.** There is no login, no token, no way to
  establish "whose data is this" on any request. This blocks essentially all real frontend work
  before it starts (see CLAUDE.md §9, and roadmap #31).
- **Any identity/listing endpoint** — no `GET /me`, no `GET /injuries`. A frontend has no way to
  discover which injuries belong to the current user even once auth exists.
- **CRUD for `Injury` and its child records** (`Treatment`, `Symptom`, `TimelineEvent`,
  `MedicalVisit`). Today the only read path is `journalTool`'s single `findUnique`, and there is
  no create/update/delete for any of these at all.
- **A self-describing `/ai-agent` response envelope.** At minimum, an explicit `intent` or
  `responseType` field so the frontend can pick a rendering branch without inferring from shape.
- **Prose answers for the `journal` intent**, not a raw stringified DB record.
- **Pagination or a client-settable retrieval limit.** Both endpoints hardcode `5` internally
  with no way for the frontend to request more, or to page through additional chunks.
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
- **Consistent citation/chunk shapes across endpoints**, if both `/rag/ask` and `/ai-agent` are
  meant to power the same kind of UI — today they return different projections of the same
  underlying retrieval result.

## 7. Change discipline

Treat this file as load-bearing once a frontend exists against it. A change to either endpoint's
request/response shape, validation, or error format is a **frontend contract change** — update
this document in the same PR as the code change, not after.
