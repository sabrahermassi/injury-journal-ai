# Injury Journal AI — Flows Review

This document replaces the earlier `docs/handoff/flows-review.md` working file (removed as part
of the handoff-file cleanup). It is a committed, permanent reference, regenerated from the actual
code as of this writing — where it and the code disagree later, trust the code and update this
doc.

Unlike `docs/02-architecture.md` (is the design sensible?), this asks: does the system actually
work end-to-end, tracing real function calls and real error paths, not the documented intent.

## Flow 1 — Create injury

**What actually happens:** nothing — there is no create/update/delete endpoint for `Injury` or any
child record anywhere in the codebase. `app.ts` registers exactly one router (`/ai-agent`); it
does not expose a write path. The only way an `Injury` row comes to exist is direct DB
manipulation (seed scripts, `prisma db seed` / `seed-dev`) — there's no application-level flow to
trace.

**What should happen (per docs intent):** `docs/02-architecture.md`'s framing describes this
backend as sitting "on top of an existing Injury Journal PostgreSQL application" — implying CRUD
is owned elsewhere. `docs/04-implementation-roadmap.md`'s frontend-readiness section frames this
explicitly as an open product decision, not an oversight.

**Divergence / missing error handling / tests:** not applicable — there's no flow here to have
gaps in. The gap is at the decision level (§11 Decision D7 context, and the open "does this
backend own CRUD" question), not an implementation defect.

## Flow 2 — Medical document ingestion

**What actually happens, step by step:**

1. `readJournalData()` (`postgres-reader.ts::readJournalData()`) — a single
   `prisma.injury.findMany()` with all four child relations included. See that function for
   current filtering behavior; at this writing it performs a full read of every injury for every
   user, with no pagination or "since last run" cursor.
2. `buildJournalDocuments()` (`document-builder.ts`) — deterministic string templates, one
   `JournalDocument` per `Injury` and per child record (symptom, treatment, visit, timeline
   event). **This is not LLM-based extraction** — there's no model call, no structured-output
   schema, no retries, and therefore no hallucination risk at this stage; it's plain
   interpolation of already-structured DB fields into sentences.
3. `chunkDocument()` (`document-chunker.ts`) — recursive paragraph → sentence → word splitting
   under a 300-token limit (see `docs/02-architecture.md` §11 Decision D4).
4. `embedAndStoreDocument()` (`embed-and-store.ts`), per document, wrapped in
   `withIngestionLock(sourceType, sourceId, ...)`:
   - for each chunk (in order): `embedText()` → `storeDocumentChunk()` (an upsert:
     `INSERT ... ON CONFLICT (sourceType, sourceId, chunkIndex) DO UPDATE`)
   - after all chunks: `deleteDocumentChunksExcept()` prunes any stale chunk indexes left over
     from a previous run that produced more chunks for the same source record.

**What should happen (per docs intent):** `docs/02-architecture.md` §4.1 describes an "Ingestion
Worker" node that calls these stages in sequence on some trigger. That worker does not exist —
confirmed, not new information (tracked as issue #40). The stages above are exactly what's
implemented and tested; nothing in the actual pipeline diverges from its own documented design at
the stage level. The divergence is entirely "the orchestrating entrypoint is missing," not
"the stages behave differently than documented."

**Missing error handling:**
- `embedAndStoreDocument`'s per-chunk loop has no try/catch around `embedText()`. If the
  embedding service fails partway through a multi-chunk document (e.g. chunk 3 of 5), chunks 1–2
  are already durably stored (upserted), the function throws, and `deleteDocumentChunksExcept`
  never runs — leaving that source record's chunks in a partial, inconsistent state until a later
  run completes successfully (that later run doesn't need matching chunk boundaries — it supplies
  its own current chunk-index list and prunes anything not in it, so any successful full run
  reconciles the stale state, not just one that happens to produce the same chunk count).
- No retry/backoff on the embedding call at all — a single transient failure aborts the whole
  document.
- `withIngestionLock` (`src/ingestion/ingestion-lock.ts`) is an in-memory `Map`-based lock. See
  that file for current implementation; at this writing it correctly serializes concurrent calls
  within one Node process but provides zero protection across processes/instances (e.g.
  horizontally scaled workers, concurrent Lambda invocations) — tracked as issue #132.

**Missing tests:** no test exercises "embedding service fails partway through a multi-chunk
document" (the partial-write scenario above). No test exercises true cross-process concurrent
ingestion of the same source record (only intra-process, via the same test runner).

**Questionable boundary — confirmed doc/code mismatch, not just an untested path:**
`docs/03-chunker-architecture.md`'s test checklist states "Empty content doesn't create chunks."
`chunkDocument()`'s empty-content guard only exists inside `addChunk()`, which is used on the
multi-chunk splitting path. But the function's fast-path early return —
`if (countTokens(document.content) <= maxTokens) return [document];` — applies to short content
too, including empty strings (`countTokens('') <= 300` is true), and returns the document
**unchanged, with no empty-content check at all**. So a `JournalDocument` with empty `content`
passed through `chunkDocument()` produces one chunk with empty content, not zero chunks. Confirmed
by reading `tests/chunker.test.ts` directly: no test named or shaped like an empty-content case
exists — the documented invariant was never actually verified, and doesn't hold on the fast path.

## Flow 3 — Search

**What actually happens:** `semanticSearch()` (`retrieval/semantic-search.ts`) calls `embedQuery()`
— the **query-side** embedding endpoint — on the user's question, then passes the resulting
vector to `searchSimilarChunks()` (`vector-storage.ts`), which runs a plain
`ORDER BY embedding <=> query LIMIT k` query, filtered by `injuryId` only when provided, by the
authenticated caller's `userId` (always passed by `semanticSearch`, see §11 Decision D9 — resolved),
plus a cosine-distance cutoff (`maxDistance`, default `0.7` — see §11 Decision D5, updated for
issue #122). No other metadata filter.

**What should happen:** the question should be embedded via the query-side prompt
(`embed_query()` in the Python service), not the document-side one — Qwen3-Embedding-0.6B is
designed for asymmetric retrieval. This is what the code now does.

**Divergence:** none — resolved (issue #37, landed via PR #55).

**Missing error handling:** `semanticSearch` propagates any `embedText`/DB error unchanged to its
caller — by design, the collapse into a generic message happens one layer up, in the HTTP
controllers (see Flow 5).

**Missing tests:** none identified beyond what Flow 5 covers (the embedding-failure and
DB-failure propagation paths are tested at the unit level via mocks, per `tests/semantic-search.test.ts`).

**Questionable boundary:** none beyond what's already tracked (D9's `userId` gap, and the
query/document embedding-mode gap above).

## Flow 4 — RAG

**What actually happens, step by step (`rag-service.ts`):**

1. `checkSafety(question)` — regex-based pre-generation check. If blocked, returns immediately
   with a refusal message, `chunks: []`, `citations: []` — **no retrieval or LLM call happens at
   all** for a blocked question.
2. `semanticSearch(question, injuryId, limit)` — see Flow 3. If this returns zero chunks (nothing
   exists, or everything found was beyond the distance cutoff — see D5, issue #122),
   `answerQuestion` returns immediately with a fixed no-relevant-context message, `chunks: []`,
   `citations: []` — **no LLM call happens at all** for this case; steps 3-8 below are skipped.
3. Injury-name resolution — reached only when step 2 didn't already return. If `injuryId` was
   given, the already-fetched ownership-check record supplies its name; otherwise the distinct
   `injuryId`s across the retrieved `chunks` are looked up (`prisma.injury.findMany`, scoped to
   `userId`) into an `injuryNames: Map<number, string>`. This lookup runs with no attempt to skip it
   when the chunks turn out to share a single injury (#225) — unlike an injury-scoped query, an
   unscoped query's chunk set isn't known to span one injury ahead of time.
4. `buildContext(chunks, injuryNames)` — labels every source with the injury it belongs to, e.g.
   `Source 1 (Injury: Lower back pain (#1)):`, then joins with `---` separators (#225 — the id is
   always included since `Injury.name` has no uniqueness constraint). **No token-budget check** —
   if retrieval ever returns many/large chunks, nothing caps the resulting prompt size before it's
   sent to the LLM.
5. `checkContentSafety(context)` — regex-based pre-generation check over the assembled retrieval
   context (not just the question), added to close a prompt-injection gap where journal-derived
   content had no safety inspection of its own (issue #66). If blocked, returns immediately with a
   refusal message, `chunks: []`, `citations: []` — no LLM call happens.
6. `buildUserPrompt(question, context)` (`prompt-builder.ts`) — wraps `context` in `<journal_data>`
   delimiters (any literal `<journal_data>`/`</journal_data>` occurring inside `context` itself is
   neutralized first — including whitespace-tolerant variants like `< /journal_data>`, not just the
   exact tag spelling — so stored content can't forge a fake boundary) plus the question. The fixed
   grounding/safety instructions live separately in `SYSTEM_PROMPT`, which explicitly tells the
   model to treat `<journal_data>` content as untrusted data, never as instructions — and (#225,
   #210) never to attribute or generalize a fact from one injury's labeled sources onto a different
   injury, and never to state a single "overall" verdict across injuries unless it genuinely holds
   for every one of them.
7. `generateAnswer(systemPrompt, userPrompt)` (`llm-client.ts`) — one Groq chat-completion call
   sending `SYSTEM_PROMPT` as the `system` role message and the built user prompt as the `user`
   role message (previously a single combined `user` message); no streaming, no
   timeout configured explicitly (relies on the SDK's default), no retry.
8. `buildCitations(chunks, injuryNames)` — dedupes by `sourceType:sourceId`, builds a label +
   optional date from chunk metadata, plus `injuryId`/`injuryName` (#225) so callers can tell which
   injury a cited source belongs to. **Does not consult the generated answer at all** — citations
   are a provenance list of what was retrieved, not a check of what the LLM actually used or said.

**What should happen (per docs intent):** `docs/02-architecture.md` §5.3 already documents this
citation gap accurately (citations aren't fact-checked against the answer). No divergence beyond
what's already known and documented.

**Missing error handling:** if `generateAnswer` throws (LLM down, invalid key, rate limit), the
error propagates unchanged through `answerQuestion` to the controller, which converts it to a
generic `500 { error: "Failed to generate answer" }` — no distinction between "provider down,"
"invalid credentials," or "rate limited," and no retry at any layer.

**Tests:** `context-builder.ts`'s empty-input behavior (an empty `chunks` array still produces a
valid, if minimal, context string — no crash) is tested, but is now unreachable from
`answerQuestion` for the zero-chunks case specifically, since that returns before `buildContext` is
called (issue #122). `answerQuestion`'s empty-retrieval path is tested directly instead
(`tests/rag-service.test.ts`, "returns an explicit no-relevant-context answer when retrieval finds
zero chunks (#122)") — it asserts the fixed message and that `buildContext`/`buildUserPrompt`/
`generateAnswer`/`buildCitations` are never called. Resolved (issue #39).

**Questionable boundary:** none new beyond what §5.3/§5.4 of the architecture doc already state.

## Flow 5 — Failure paths

Traced directly against the controllers and services, not assumed:

| Failure | What actually happens |
|---|---|
| **LLM call fails** (`/ai-agent`) | `generateAnswer` throws → uncaught through `runAgent`/`answerQuestion` → caught in the `askAgent` controller's `try/catch` → `500 { error: "Failed to process request" }`. Same shape regardless of cause (invalid key, timeout, rate limit, network error) — verified directly in an earlier session: an invalid `GROQ_API_KEY` produces exactly this generic message with no distinguishing detail. |
| **Embedding call fails** | `embedText`/`embedQuery` throws (network error, non-200 response) → propagates through `semanticSearch` → `answerQuestion`/`runAgent` → same generic 500 as above. No distinction from an LLM failure at the HTTP response level. |
| **DB fails** | Any Prisma/raw-SQL error (`vector-storage.ts`, `journal-tool.ts`) propagates uncaught up to the same controller-level `catch` → same generic 500. |
| **Bad/malformed document (ingestion)** | Not directly applicable — `buildJournalDocuments` operates on already-typed Prisma results, not external/untrusted input. The closest analogue, a chunk whose content becomes empty after processing, is covered under Flow 2's chunker finding above. |
| **Duplicate ingestion** | Handled correctly and idempotently — `storeDocumentChunk`'s `ON CONFLICT (sourceType, sourceId, chunkIndex) DO UPDATE` means re-ingesting the same source record updates existing rows rather than duplicating them, and `deleteDocumentChunksExcept` prunes chunks left over from a run that previously produced more chunks for that record. Verified via `vector-storage.ts` directly, not assumed. |
| **Empty retrieval result** | `searchSimilarChunks` returns `[]` (nothing exists, or nothing passed the distance cutoff — see D5, issue #122) → `answerQuestion` returns a fixed no-relevant-context message directly, `chunks: []`, `citations: []` — `buildContext`, `checkContentSafety`, and `generateAnswer` are never called for this case (see Flow 4). This is now a structural check, not just the prompt-level "say you lack enough information" instruction, which still remains as a second layer for the case where chunks *are* retrieved but don't actually answer the question. |

**Cross-cutting observation:** every failure class above collapses into the same generic
`{ error: "Failed to process request" }` 500 response, with no error code/type. A frontend cannot
distinguish "try again" from "service misconfigured" from "no results" — already noted in
`docs/05-api-contract.md` §5, and confirmed here as a real, traced code path rather than an
inferred risk. (`POST /rag/ask`, which previously used a different generic message
(`"Failed to generate answer"`) for the same failure class, was retired — see #43.)
