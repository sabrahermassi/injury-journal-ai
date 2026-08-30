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
  - [x] 2.6 Safety Guardrails *(input- and output-side)* (#28, #96)
  - [x] 2.7 AI Agent *(keyword routing, not per-tool authorization)* (#29)
- [x] Step 3 — Evaluation *(harness implemented with six evaluation dimensions; see `evaluation/ai-system/` for current coverage)* (#30)
- [x] Step 4 — Integration Tests (#17)

### Open / Not Started

- [ ] Step 5 — Security and Production Hardening (#31, closed — decomposed into #89-#99; see
  "Step 5 security" below)
- [ ] Step 6 — AI Observability + AI-Assisted Observability (#32)
- [ ] Step 7 — Production Workflow with AWS (#33)
- [ ] Step 8 — Infrastructure as Code (#34)
- [ ] Step 9 — Future Improvements backlog (#35) — design-notes issue, not a single deliverable;
  see "Backlog items pulled forward" below for which parts of it are more urgent than its
  position in this list implies
- Reference only, not a work item: #36 (architecture diagram)

### New items surfaced by the review series

These were originally found by actually reading the code end-to-end during a review series whose
working files lived under `docs/handoff/` and have since been cleaned up. Three of the four now
have permanent replacements: `docs/02-architecture.md` §11 (Architectural Decision Log),
`docs/05-api-contract.md`, and `docs/07-flows-review.md`. `step3-architecture-diff.md` has no
permanent replacement yet — tracked in issue #58. Every item below is annotated with its tracking
issue number, or marked "not yet filed" where none exists yet.

**Do now (cheap today, expensive later):**

- [x] Wire `embed_query()` into the actual query-embedding path. The embedding service already
  implements Qwen3's asymmetric query/document prompting; the query path just never calls it.
  Highest value-to-effort fix in the whole review. (#37)
- [x] Build the actual ingestion worker/entrypoint. Every stage (read → build → chunk → embed →
  store) works and is tested in isolation; the worker now calls them in sequence, so
  `DocumentChunk` is populated in a running system. (#40)
- [x] Fix the journal-intent response in `/ai-agent` — previously returned
  `JSON.stringify(injury)` inside a prose `answer` field; now returns an LLM-generated prose
  summary of the injury record. (#38)
- [x] Add a real, indexed `userId` column on `DocumentChunk` (denormalized from `Injury.userId`
  at write time). This is a schema migration, and #95's authorization work depended on it existing
  first — `userId` is now an indexed column, no longer only in an unindexed JSON blob. (#41)
- [x] Start threading a request ID through the pipeline now, even as a no-op passed-through
  parameter, rather than retrofitting it into every function signature once #32 starts. (#42)
- [x] Add a test for the empty-retrieval path in `answerQuestion` (zero chunks found → what does
  the LLM actually do with an empty context block?). (#39)

**Step 5 security (formerly the single epic #31, now closed and decomposed into 11 scoped
issues — a security gap-analysis pass also surfaced items #31's own text never named):**

*Urgent (no dependencies, do first):*
- [x] Add rate limiting to prevent LLM/embedding cost-abuse and resource exhaustion — confirmed
  exploitable at the time this was filed (no auth, no rate limit, every request triggered a paid
  Groq + embedding call). The original single per-IP limiter ran *before* `authenticate`, sharing
  its bucket with failed-auth traffic; fixed as #145 with a two-tier limiter (a per-IP bound ahead
  of `authenticate`, raised from the original 20 to 40 req/60s so legitimate traffic from a shared
  IP isn't starved by one user's budget — a deliberately weaker per-IP cap, not a stronger one; and
  a stricter per-user bound keyed by `req.userId`, at the original 20 req/60s, after it). (#89, #145)
- [x] Add schema-based request input validation (Zod) incl. a max question length —
  `ai-agent-controller.ts` now validates `question`/`injuryId` via a Zod schema instead of ad hoc
  inline checks, and `question` has a real 10,000-character upper bound (matching the embedding
  service's own `EmbeddingRequest.text` limit). (#90)
- [x] Regression tests for data isolation boundaries — cross-user chunk leakage when `injuryId` is
  omitted is now covered (requested explicitly in #31's own text). (#91)
- [x] Redact/minimize sensitive data in error logging (`console.error` catch blocks) — a present-day
  leak risk, distinct from and not gated on #32's larger future AWS observability project. (#92)

*Normal priority:*
- [x] Ensure the app's Postgres role follows least privilege + document DB connection hygiene. (#93)
- [x] Authentication + session/identity on every request — `POST /ai-agent` now requires a Bearer
  JWT (`src/auth/authenticate.ts`), resolving #49 in favor of verifying externally-issued tokens
  rather than this backend owning login/session issuance. (#94)
- [x] Per-tool + retrieval/vector-level authorization enforcing user-level data isolation — depends
  on #94. `docs/05-api-contract.md` §2 has the current detail. (#95)
- [x] Output-side safety check — `checkAnswerSafety` (`src/safety/safety-service.ts`) withholds
  an LLM answer that hedges toward its own diagnostic judgment ("you may have...", "this could
  be..."). Wired into both `rag-service.ts` and the journal-intent path in
  `ai-agent-orchestrator.ts`. (#96)
- [x] Ground definite diagnostic assertions ("you have X", "diagnosis: X") against the
  retrieved chunks / journal record passed into `checkAnswerSafety` as evidence, rather than
  allowing them through unconditionally. Still keyword-based (`CONDITION_KEYWORDS`), so a
  specific medical term outside that list is still invisible to the check — tracked separately
  as a pre-existing coverage gap. (#142)
- [x] Expand `CONDITION_KEYWORDS` with specific terms (meniscus, ACL/MCL/PCL/LCL, sciatica,
  pneumonia, diabetes) identified as bypassing every pattern in `safety-service.ts`. The list
  remains finite and hand-maintained — arbitrary open-vocabulary terms still bypass every
  check; closing that structurally is tracked under #140. (#143)

*Optional (safe to defer indefinitely):*
- [x] Add helmet + CORS security headers. (#97)
- [x] Add `npm audit`/Dependabot/SCA scanning to CI. (#98)
- [x] Document third-party LLM data exposure (Groq) and the embedding service's missing auth
  boundary as accepted risks — see `docs/02-architecture.md` §10.1. Follow-up action items
  filed as #117 (Groq data-retention decision) and #118 (embedding-service auth before
  non-localhost deployment). (#99)

*Deliberately not duplicated:* safe logging → already tracked under #32 ([P19] AI Observability);
least-privilege IAM (AWS roles/policies) and secret rotation → already tracked under #34 ([P21]
Infrastructure as Code) — both are cloud-infra concepts with no local-codebase equivalent today.

- [x] `POST /rag/ask` retired; `POST /ai-agent` is the sole public entrypoint. `answerQuestion()`
  stays as an internal function (`ragTool` already called it directly). Resolves the divergent
  `injuryId` validation by elimination rather than reconciliation. (#43)

**Fold into Step 9 backlog cleanup / general hygiene (not urgent, but shouldn't be lost):**

- [x] Delete `src/ai-agent/ai-agent-service.ts` — a second, unused, partially-dead
  duplicate of `ai-agent-orchestrator.ts`. (#46)
- [x] Consolidate `PrismaClient` instantiation behind `src/lib/prisma.ts` — `vector-storage.ts`,
  `journal-tool.ts`, `citation-source-mapper.ts`, and `citation-verifier.ts` now import the shared
  singleton instead of each constructing their own client. (#47)
- [ ] Resolve the three unwired citation modules (`citation-verifier.ts`,
  `citation-formatter.ts`, `citation-source-mapper.ts`) — either wire them into the response path
  as #35 already plans, or remove them; two of the three only handle 2 of 5 valid `sourceType`
  values (`treatment`, `medical_visit` — missing `symptom`, `timeline_event`, `injury`). (#124)
- [x] Add `journal-tool.ts` test coverage — both `journalTool()` and `formatInjuryRecord()` are now
  covered in `tests/journal-tool.test.ts`. (#44)
- [x] Surface `AgentState.intent` in the actual HTTP response — every `/ai-agent` response now
  includes an `intent` field so the frontend can discriminate the branch without inferring it from
  shape. (#45)
- [x] Clean up the stray Python test functions embedded at module level in `embedding_api.py` —
  moved into `test_embedding_api_unit.py`'s existing `TestEmbedEndpoint`/`TestEmbedBatchEndpoint`
  classes. (#48)

**Frontend-readiness gaps — new "Step 10" candidate, sequenced after Step 5 (security), since
building frontend-facing endpoints without auth would just mean redoing them:**

This backend exposes only the AI-assistant surface — no CRUD, no conversation state, no
enum/lookup endpoints. That is now a settled decision, not an open question:

- [x] **Decide:** does this backend own journal CRUD + auth going forward, or does a separate
  "existing Injury Journal application" (per `docs/02-architecture.md`'s framing) own that, with
  this repo staying read-only/AI-only? **Decided (D10, `docs/02-architecture.md`): this repo does
  not own CRUD or login/session issuance** — a separate journal app owns both; this repo verifies
  externally-issued Bearer JWTs (#94) and stays AI/RAG/agent-only. (#49)
- [x] If this backend owned it: `POST/GET/PATCH/DELETE` for `Injury` and its child records,
  `GET /injuries` (list), login/session endpoints, a `GET /me` identity endpoint. **Closed as
  out-of-scope under the #49 decision above — deliberately not built, not a gap.** (#50)
- [ ] Either way: a conversation/thread concept for the assistant (currently fully stateless,
  one question in, one answer out — no way to thread multi-turn context server-side). Deferred
  until frontend work actually starts, not a precondition for starting it. (#51)
- [x] Either way: decide on streaming vs. full-response for the LLM call before frontend work
  commits to one UX pattern. Decided: stay full-response/buffered — no frontend consumer exists
  yet to justify the added complexity of streaming. Revisit once a frontend is built if latency
  becomes a real UX problem. (#52)

With #49/#50/#52 resolved and auth/authorization (#94/#95) shipped, every gate this section
originally named for starting frontend work against `/ai-agent` is closed — see #176 for the
tracking issue on what's actually still needed for that work.

**Surfaced during the docs-accuracy review (PR #53), tracked but not yet in this list:**

- [x] #56 — Add a Python dependency manifest for the embedding service.
- [x] #57 — `vector-storage.integration.test.ts` has no isolation from shared `DocumentChunk`
  data: fixed by adding an optional `sourceType` filter to `searchSimilarChunks` and scoping the
  test to it. Not used by any production caller.
- [x] #58 — Remaining dangling `docs/handoff/*` references in `docs/01-product.md` and this file.
- [x] #59 — `chunkDocument`'s empty-content behavior contradicted
  `docs/03-chunker-architecture.md`'s documented invariant; the fast path now guards empty
  content.
- [x] Source-type-aware chunking budgets (`SOURCE_TYPE_CHUNK_CONFIG`) and labeled-field
  boundary splitting in `document-chunker.ts` — see `docs/03-chunker-architecture.md` §"Source-
  type-aware budgets and labeled-field splitting". Originally flagged speculative/optional (no
  evidence uniform chunking was hurting retrieval); scoped down to reuse the `Label:` structure
  `document-builder.ts` already emits rather than inventing new document structure. No GitHub
  issue — raised and implemented in-session; per-sourceType tuning of the (currently
  default-matching) config entries should be driven by `evaluation/ai-system/`, not guessed.
- [x] #60 — Ingestion error handling: investigated, confirmed the existing partial-failure
  behavior (no pruning on a failed run) is already safe; locked in via a regression test, no
  code change needed. Cross-process locking (the other half of #60) remains unaddressed now that
  the ingestion worker itself is built (#40) — tracked as #132 (distributed ingestion locking).
- [x] #61 — `/ai-agent` now returns 400 instead of 500 for a body-less request.
- [x] #43 — `POST /rag/ask` retired; `POST /ai-agent` is the sole public entrypoint.
- [x] #86 — `routeIntent()` can return `'safety'`; the orchestrator's `switch` now has a
  `case 'safety'` that returns the same diagnosis-refusal message as the earlier `checkSafety`
  gate, instead of falling into the generic default response. Surfaced while resolving #43.

---

## Sequencing note

The order above (do-now items → Step 5/#31 → Step 9 hygiene → frontend-readiness) is a proposed
re-sequencing, not a reordering of the official Step 5→8 sequence itself — Steps 5 through 8
remain in their documented order (security → observability → AWS → Terraform). The "do now" items
are things that make Step 5 itself easier/cheaper (the `userId` column, retiring `/rag/ask` in
favor of `/ai-agent`) or that are simply cheap-now-expensive-later regardless of step ordering
(the embedding fix, the request-ID threading).

---

## Implementation Principles

- Build the system incrementally, completing each foundation before building on top of it.
- Establish the data, embeddings, vector storage, retrieval, and RAG foundations before building
  the AI agent. *(Done — this held.)*
- Keep the architecture aligned with the capabilities implemented at each step. *(This is the
  principle the `docs/handoff/` review series exists to check — see the "Known incomplete"
  callouts above for where drift has already been found.)*
