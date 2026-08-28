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
- [x] Step 3 — Evaluation *(harness exists; two of four dimensions are shallow, one is unimplemented)* (#30)
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
- [ ] Build the actual ingestion worker/entrypoint. Every stage (read → build → chunk → embed →
  store) works and is tested in isolation; nothing calls them in sequence outside test files, so
  `DocumentChunk` is never populated in a running system today. (#40)
- [x] Fix the journal-intent response in `/ai-agent` — previously returned
  `JSON.stringify(injury)` inside a prose `answer` field; now returns an LLM-generated prose
  summary of the injury record. (#38)
- [ ] Add a real, indexed `userId` column on `DocumentChunk` (denormalized from `Injury.userId`
  at write time). This is a schema migration, and #95's authorization work depends on it existing
  first — today `userId` only lives inside an unindexed JSON blob and cannot be filtered on. (#41)
- [ ] Start threading a request ID through the pipeline now, even as a no-op passed-through
  parameter, rather than retrofitting it into every function signature once #32 starts. (#42)
- [ ] Add a test for the empty-retrieval path in `answerQuestion` (zero chunks found → what does
  the LLM actually do with an empty context block?). Likely the common case until the ingestion
  worker above exists. (#39)

**Step 5 security (formerly the single epic #31, now closed and decomposed into 11 scoped
issues — a security gap-analysis pass also surfaced items #31's own text never named):**

*Urgent (no dependencies, do first):*
- [ ] Add rate limiting to prevent LLM/embedding cost-abuse and resource exhaustion — confirmed
  exploitable today (no auth, no rate limit, every request triggers a paid Groq + embedding call). (#89)
- [x] Add schema-based request input validation (Zod) incl. a max question length —
  `ai-agent-controller.ts` now validates `question`/`injuryId` via a Zod schema instead of ad hoc
  inline checks, and `question` has a real 10,000-character upper bound (matching the embedding
  service's own `EmbeddingRequest.text` limit). (#90)
- [ ] Regression tests for data isolation boundaries — currently zero tests exist proving
  cross-user chunk leakage can't happen when `injuryId` is omitted (requested explicitly in #31's
  own text). (#91)
- [ ] Redact/minimize sensitive data in error logging (`console.error` catch blocks) — a present-day
  leak risk, distinct from and not gated on #32's larger future AWS observability project. (#92)

*Normal priority:*
- [ ] Ensure the app's Postgres role follows least privilege + document DB connection hygiene. (#93)
- [ ] Authentication + session/identity on every request (currently: zero) — blocked on #49
  (does this backend own auth, or verify tokens from a separate app?). (#94)
- [ ] Per-tool + retrieval/vector-level authorization enforcing user-level data isolation — depends
  on #94. (#95)
- [x] Output-side safety check — `checkAnswerSafety` (`src/safety/safety-service.ts`) withholds
  an LLM answer that hedges toward its own diagnostic judgment ("you may have...", "this could
  be..."). It's pattern-based text filtering only — it has no access to the journal record, so it
  allows all definite diagnostic statements through unconditionally, grounded or not. Verifying
  definite assertions against source evidence is separate follow-up work (#142). Wired into both
  `rag-service.ts` and the journal-intent path in `ai-agent-orchestrator.ts`. (#96)

*Optional (safe to defer indefinitely):*
- [ ] Add helmet + CORS security headers — low value until a real deployed origin/frontend exists. (#97)
- [ ] Add `npm audit`/Dependabot/SCA scanning to CI. (#98)
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
  values (`treatment`, `medical_visit` — missing `symptom`, `timeline_event`, `injury`). (not yet filed)
- [x] Add `journal-tool.ts` test coverage — both `journalTool()` and `formatInjuryRecord()` are now
  covered in `tests/journal-tool.test.ts`. (#44)
- [ ] Surface `AgentState.intent` in the actual HTTP response — it's computed, tracked, and then
  discarded; a frontend needs exactly this field to know which response shape it received. (#45)
- [x] Clean up the stray Python test functions embedded at module level in `embedding_api.py` —
  moved into `test_embedding_api_unit.py`'s existing `TestEmbedEndpoint`/`TestEmbedBatchEndpoint`
  classes. (#48)

**Frontend-readiness gaps — new "Step 10" candidate, sequenced after Step 5 (security), since
building frontend-facing endpoints without auth would just mean redoing them:**

This backend currently only exposes the AI-assistant surface — no CRUD, no auth, no
conversation state, no enum/lookup endpoints. Whether this becomes real roadmap work depends on a
product decision that should be made explicitly rather than discovered by omission:

- [ ] **Decide:** does this backend own journal CRUD + auth going forward, or does a separate
  "existing Injury Journal application" (per `docs/02-architecture.md`'s framing) own that, with
  this repo staying read-only/AI-only? This changes the entire scope of what comes next and isn't
  written down anywhere today. (#49)
- [ ] If this backend owns it: `POST/GET/PATCH/DELETE` for `Injury` and its child records,
  `GET /injuries` (list), login/session endpoints, a `GET /me` identity endpoint. (#50)
- [ ] Either way: a conversation/thread concept for the assistant (currently fully stateless,
  one question in, one answer out — no way to thread multi-turn context server-side). (#51)
- [ ] Either way: decide on streaming vs. full-response for the LLM call before frontend work
  commits to one UX pattern. (#52)

**Surfaced during the docs-accuracy review (PR #53), tracked but not yet in this list:**

- [ ] #56 — Add a Python dependency manifest for the embedding service.
- [x] #57 — `vector-storage.integration.test.ts` has no isolation from shared `DocumentChunk`
  data: fixed by adding an optional `sourceType` filter to `searchSimilarChunks` and scoping the
  test to it. Not used by any production caller.
- [ ] #58 — Remaining dangling `docs/handoff/*` references in `docs/01-product.md` and this file.
- [ ] #59 — `chunkDocument`'s empty-content behavior contradicts
  `docs/03-chunker-architecture.md`'s documented invariant (code-vs-doc call needed).
- [x] #60 — Ingestion error handling: investigated, confirmed the existing partial-failure
  behavior (no pruning on a failed run) is already safe; locked in via a regression test, no
  code change needed. Cross-process locking (the other half of #60) remains unaddressed — tied
  to the not-yet-built ingestion worker (#40).
- [x] #61 — `/ai-agent` now returns 400 instead of 500 for a body-less request.
- [x] #43 — `POST /rag/ask` retired; `POST /ai-agent` is the sole public entrypoint.
- [ ] #86 — `routeIntent()` can return `'safety'`, but the orchestrator's `switch` has no case for
  it (falls into the generic default response instead of a refusal). Surfaced while resolving #43.

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
