# Injury Journal AI — Implementation Roadmap

A step-by-step plan for building a production-oriented AI assistant on top of the existing
Injury Journal PostgreSQL application.

Tracking has moved to GitHub Issues. This file is a human-readable index into that tracker plus
the cross-cutting findings from the `docs/handoff/` review series — it is not the source of
truth for status; the issues are. Re-sync this file whenever a linked issue's state changes.

---

## Status Index

### Done (verified against code, not just issue state)

- [x] Step 0 — Project Foundation (#19)
- [x] Step 1 — Offline Ingestion Pipeline *(components only — see "Known incomplete" below)* (#20, #22)
- [x] Step 2 — Online Architecture (#21)
  - [x] 2.1 Embeddings (#23)
  - [x] 2.2 Vector Storage with pgvector (#24)
  - [x] 2.3 Semantic Retrieval (#25)
  - [x] 2.4 Basic RAG (#26)
  - [x] 2.5 Citations *(generation only — verification not wired in, see below)* (#27)
  - [x] 2.6 Safety Guardrails *(input-side only — no output-side check)* (#28)
  - [x] 2.7 AI Agent *(keyword routing, not per-tool authorization; journal path incomplete)* (#29)
- [x] Step 3 — Evaluation *(harness exists; two of four dimensions are shallow, one is unimplemented)* (#30)
- [x] Step 4 — Integration Tests (#17)

### Open / Not Started

- [ ] Step 5 — Security and Production Hardening (#31)
- [ ] Step 6 — AI Observability + AI-Assisted Observability (#32)
- [ ] Step 7 — Production Workflow with AWS (#33)
- [ ] Step 8 — Infrastructure as Code (#34)
- [ ] Step 9 — Future Improvements backlog (#35) — design-notes issue, not a single deliverable;
  see "Backlog items pulled forward" below for which parts of it are more urgent than its
  position in this list implies
- Reference only, not a work item: #36 (architecture diagram)

### New items surfaced by the review series (not yet tracked as issues)

These didn't exist as roadmap items before because they were only found by actually reading the
code end-to-end (see `docs/handoff/` for the full review series: `step3-architecture-diff.md`,
`architecture-review.md`, `contracts-review.md`, `flows-review.md`). Recommend filing each as its
own issue rather than leaving them here as prose.

**Do now (cheap today, expensive later):**

- [ ] Wire `embed_query()` into the actual query-embedding path. The embedding service already
  implements Qwen3's asymmetric query/document prompting; the query path just never calls it.
  Highest value-to-effort fix in the whole review.
- [ ] Build the actual ingestion worker/entrypoint. Every stage (read → build → chunk → embed →
  store) works and is tested in isolation; nothing calls them in sequence outside test files, so
  `DocumentChunk` is never populated in a running system today.
- [ ] Fix the journal-intent response in `/ai-agent` — it currently returns
  `JSON.stringify(injury)` inside a prose `answer` field. This will render as raw JSON in any
  real frontend and needs to change before frontend work starts, not alongside it.
- [ ] Add a real, indexed `userId` column on `DocumentChunk` (denormalized from `Injury.userId`
  at write time). This is a schema migration, and #31's authorization work depends on it existing
  first — today `userId` only lives inside an unindexed JSON blob and cannot be filtered on.
- [ ] Start threading a request ID through the pipeline now, even as a no-op passed-through
  parameter, rather than retrofitting it into every function signature once #32 starts.
- [ ] Add a test for the empty-retrieval path in `answerQuestion` (zero chunks found → what does
  the LLM actually do with an empty context block?). Likely the common case until the ingestion
  worker above exists.

**Fold into Step 5 / #31 (security), more concretely scoped than the current issue text:**

- [ ] Authentication + session/identity on every request (currently: zero — every request is
  anonymous server-side).
- [ ] Per-tool authorization step in the agent orchestrator — does not exist today, not even
  partially.
- [ ] Decide the fate of `POST /rag/ask` vs `POST /ai-agent` before scoping authorization work —
  they're two public, unauthenticated, differently-validated entrypoints to overlapping
  functionality today.
- [ ] Regression tests for data isolation boundaries specifically (requested explicitly in #31's
  own text) — currently zero tests exist proving cross-user chunk leakage can't happen when
  `injuryId` is omitted.
- [ ] Output-side safety check — the current safety layer is entirely pre-generation; nothing
  checks whether the LLM's answer echoes diagnosis-adjacent language from a chunk's raw content.

**Fold into Step 9 backlog cleanup / general hygiene (not urgent, but shouldn't be lost):**

- [ ] Delete or finish `src/ai-agent/ai-agent-service.ts` — a second, unused, partially-dead
  duplicate of `ai-agent-orchestrator.ts`.
- [ ] Resolve the three unwired citation modules (`citation-verifier.ts`,
  `citation-formatter.ts`, `citation-source-mapper.ts`) — either wire them into the response path
  as #35 already plans, or remove them; two of the three only handle 2 of 5 valid `sourceType`
  values (`treatment`, `medical_visit` — missing `symptom`, `timeline_event`, `injury`).
- [ ] Consolidate `PrismaClient` instantiation behind `src/lib/prisma.ts` — four files construct
  their own client independently today.
- [ ] Add `journal-tool.ts` test coverage — zero tests exist for it despite it being one of three
  response branches in the agent.
- [ ] Surface `AgentState.intent` in the actual HTTP response — it's computed, tracked, and then
  discarded; a frontend needs exactly this field to know which response shape it received.
- [ ] Clean up the stray Python test functions embedded at module level in `embedding_api.py`.

**Frontend-readiness gaps — new "Step 10" candidate, sequenced after Step 5 (security), since
building frontend-facing endpoints without auth would just mean redoing them:**

This backend currently only exposes the AI-assistant surface — no CRUD, no auth, no
conversation state, no enum/lookup endpoints. Whether this becomes real roadmap work depends on a
product decision that should be made explicitly rather than discovered by omission:

- [ ] **Decide:** does this backend own journal CRUD + auth going forward, or does a separate
  "existing Injury Journal application" (per `docs/02-architecture.md`'s framing) own that, with
  this repo staying read-only/AI-only? This changes the entire scope of what comes next and isn't
  written down anywhere today.
- [ ] If this backend owns it: `POST/GET/PATCH/DELETE` for `Injury` and its child records,
  `GET /injuries` (list), login/session endpoints, a `GET /me` identity endpoint.
- [ ] Either way: a conversation/thread concept for the assistant (currently fully stateless,
  one question in, one answer out — no way to thread multi-turn context server-side).
- [ ] Either way: decide on streaming vs. full-response for the LLM call before frontend work
  commits to one UX pattern.

---

## Sequencing note

The order above (do-now items → Step 5/#31 → Step 9 hygiene → frontend-readiness) is a proposed
re-sequencing, not a reordering of the official Step 5→8 sequence itself — Steps 5 through 8
remain in their documented order (security → observability → AWS → Terraform). The "do now" items
are things that make Step 5 itself easier/cheaper (the `userId` column, the `/rag/ask` vs.
`/ai-agent` decision) or that are simply cheap-now-expensive-later regardless of step ordering
(the embedding fix, the request-ID threading).

---

## Implementation Principles

- Build the system incrementally, completing each foundation before building on top of it.
- Establish the data, embeddings, vector storage, retrieval, and RAG foundations before building
  the AI agent. *(Done — this held.)*
- Keep the architecture aligned with the capabilities implemented at each step. *(This is the
  principle the `docs/handoff/` review series exists to check — see the "Known incomplete"
  callouts above for where drift has already been found.)*
