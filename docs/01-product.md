# Injury Journal AI — Product Definition

## Product Vision

The long-term goal is to build a production-oriented AI Injury Journal Assistant that can:

- Answer questions about a user's journal
- Retrieve relevant historical information
- Generate grounded summaries
- Cite the underlying journal records
- Orchestrate multiple tools through an AI agent
- Apply healthcare safety boundaries
- Evaluate retrieval and answer quality
- Trace and monitor AI workflows
- Use AI to analyze operational telemetry
- Run reliably on AWS
- Be deployed reproducibly using Infrastructure as Code

The product should be implemented incrementally. Each stage builds on the previous foundation, with the architecture growing as new capabilities are introduced.

The AI agent should not be built first. The system should first establish reliable data ingestion, embeddings, vector storage, retrieval, and RAG foundations.

## 1. Product Overview

Injury Journal AI is an AI-powered assistant that helps users search, understand, and summarize their personal injury journal using natural language.

It works on top of an existing Injury Journal application and uses structured journal data — including injuries, symptoms, treatments, medical visits, and timeline events — as its source of truth.

> **Scope decision (resolved via issue #49):** this backend does not implement journal record
> creation/editing or user authentication/session issuance — a separate, existing Injury Journal
> application owns both. This repo remains read-only/AI-only against journal data it ingests from
> that application. Today, this repo exposes only one AI endpoint (`POST /ai-agent`); there is no
> `GET /injuries`, no way to create or edit a record, and no login, and none of those are planned
> for this repo. The practical implication for authentication (issue #94): this backend will
> eventually verify tokens/sessions issued by that other application, not issue its own. See
> `docs/05-api-contract.md` §6 and `docs/02-architecture.md` §11 (Decision D10).

The system uses embeddings, semantic retrieval, RAG, and eventually AI agents to produce grounded answers and summaries.

The product is designed to **organize, retrieve, and summarize information**. It does not diagnose medical conditions or replace healthcare professionals.

---

## 2. Problem

Long-term or complex injuries can generate large amounts of fragmented information:

- Symptoms
- Treatments and outcomes
- Medical visits
- Timeline events
- Injury history

As this information grows, it becomes difficult to quickly answer questions such as:

> What treatments have I tried?
> Which treatments did not help?
> When did my symptoms become worse?
> What happened after a particular treatment?
> Can I summarize my injury history for my doctor?

The product makes this information easier to explore through natural-language questions while keeping answers grounded in the user's existing journal.

---

## 3. Target User

The primary user is a person who maintains a personal injury journal and wants to:

- Search their history using natural language
- Understand their historical information
- Compare treatments, symptoms, and outcomes
- Find relevant medical events
- Prepare summaries for healthcare appointments

The product is designed around **one user's private journal data**.

---

## 4. Product Goals

- **Natural-language access:** Users can ask questions without knowing the underlying database structure. *(Implemented.)*
- **Grounded answers:** Responses are based on information retrieved from the user's journal.
  > **Status:** the current implementation prompts the LLM to answer only from retrieved context,
  > but nothing verifies this actually happens — there is no answer-faithfulness check, and the
  > empty-retrieval case (no chunks found) is untested. See `docs/02-architecture.md`
  > §6 and `docs/07-flows-review.md` Flow 4.
- **Traceability:** Important claims can be traced to their underlying journal records.
  > **Status:** not yet enforced. Today's citations list what was *retrieved*, not what the
  > answer actually *used* — there is no claim-level verification. See
  > `docs/02-architecture.md` §5.3.
- **Useful summaries:** Users can generate concise summaries of their injury history. *(Implemented for both the RAG path and the journal-lookup path, both via LLM-generated prose — see §6 below.)*
- **Healthcare safety:** The assistant operates within explicit healthcare boundaries. *(Implemented on the input side; see §7.)*
- **Privacy:** Users can only access their own journal data.
  > **Status: implemented.** `POST /ai-agent` requires a Bearer JWT (`src/auth/authenticate.ts`,
  > issue #94), and retrieval/journal lookups filter by the authenticated `userId` (issue #95).
  > See `docs/05-api-contract.md` §2.

---

## 5. Core Use Cases

### Search Journal History

> What treatments have I tried?

Retrieve relevant treatment records and summarize them. *(Implemented via the RAG path.)*

### Compare Treatment Outcomes

> Which treatments did not improve my symptoms?

Retrieve relevant treatment and outcome information and summarize it. *(Implemented via the RAG path. `Treatment.outcome` is a structured column, retrieved and summarized by the LLM from context rather than queried directly.)*

### Search Symptoms and Events

> When did my lower back symptoms become worse?

Retrieve relevant symptom and timeline records. *(Implemented, but keyword-routed to the journal tool — see §6 caveat below.)*

### Prepare a Doctor Summary

> Generate a summary of my injury history for my doctor.

Retrieve relevant timeline events, treatments, symptoms, and medical visits, then generate a source-backed summary. *(Implemented only as a generic RAG question — there is no dedicated summary feature or template.)*

### Retrieve Specific History

> What happened after my physiotherapy treatment?

Retrieve relevant journal records and summarize the available information. *(Implemented via the RAG path.)*

---

## 6. Core Features

### Natural-Language Search

Users ask questions in normal language rather than writing database queries. *(Implemented.)*

### Semantic Retrieval

Embeddings and vector search find relevant information based on meaning rather than exact keyword matches. *(Implemented — filtered by `injuryId` only; no similarity threshold, so an unrelated question against a sparsely-populated journal can still return "top-k" results that aren't actually relevant.)*

### Retrieval-Augmented Generation

Relevant journal information is provided to the LLM as context before an answer is generated. *(Implemented.)*

### Source Citations

Generated answers identify the journal records used to support their claims.

> **Status:** citations identify records that were *retrieved*, not records the answer
> demonstrably *used*. See the Traceability caveat in §4.

### AI Agent

> **Status update:** the AI agent exists today, not just "eventually." Tool routing is
> deterministic keyword matching (not model-driven decision-making), and covers:

- RAG retrieval *(implemented, full pipeline)*
- Journal/database access *(implemented — returns an LLM-generated prose summary of the injury record via `formatInjuryRecord()` → `generateAnswer()`, no citations)*
- Safety checks *(implemented, input- and output-side)*
- Citation verification *(not implemented — the verification module exists in code but is not wired into any response path)*

Per-tool authorization (retrieval and journal lookups scoped to the authenticated `userId`) is implemented — see `docs/05-api-contract.md` §2.

### Evaluation

The system measures:

- Retrieval quality *(implemented — exact source match against an expected-sources list)*
- Answer faithfulness *(not implemented — no metric exists for this today, despite being a stated goal)*
- Citation accuracy *(implemented, but shallow — only checks that at least one citation exists when one is expected, not that the citations are the correct ones)*
- Safety adherence *(implemented, but shallow — checks for the literal substrings "cannot"/"unable" in a refusal, nothing more)*

See `evaluation/ai-system/dataset.json` for the current dataset size and coverage, and `docs/02-architecture.md` §6 for the evaluation dimensions.

### AI Observability

*(Not yet implemented — Step 6 of the roadmap.)* The system tracks operational information such as:

- Request IDs
- Agent steps
- Retrieval performance
- LLM calls
- Token usage
- Errors
- Cost

Raw journal content is not logged by default.

---

## 7. Healthcare Safety

The assistant can **organize, retrieve, and summarize the user's information**.

It does not diagnose conditions or make medical decisions.

### Allowed

> Summarize my treatments.

> What symptoms did I report in January?

> What treatments did I try?

> Create a summary of my injury history for my doctor.

### Outside the product boundary

> Do I have cancer?

> Diagnose the cause of my pain.

> Tell me which disease I have.

Requests outside these boundaries should be refused or redirected. *(Implemented via a regex-based pre-generation filter — well-tested for the phrasings it covers, but it is a pre-generation filter only: nothing checks whether the LLM's generated answer echoes diagnosis-adjacent language it might read verbatim from raw journal content, e.g. a doctor's visit notes. See `docs/02-architecture.md` §5.4.)*

The initial safety decision must occur **before retrieving journal data or invoking RAG/journal tools**. *(Implemented and verified by an integration test.)* Per-tool authorization is a separate control before each tool accesses user data.

> **Status:** implemented. `rag-tool.ts` and `journal-tool.ts` scope every lookup to the
> authenticated `userId` (issue #95). See `docs/05-api-contract.md` §2.

---

## 8. Privacy and Security Requirements

> **Status:** authentication, authorization, and user-level data isolation are implemented (issues
> #94, #95). Secure database access and least-privilege roles are documented in `README.md`
> ("Database roles and connection hygiene"). Secret management, telemetry protection, log access,
> and retention/deletion policies remain open — see `docs/04-implementation-roadmap.md` for
> current per-item status.

The journal may contain sensitive personal and health information.

The system therefore requires:

- Authentication
- Authorization
- User-level data isolation
- Secure database access
- Least-privilege permissions
- Secure secret management
- Protected telemetry
- Restricted log access
- Defined retention and deletion policies

The fundamental security boundary is:

```text
User A
   ↓
Can only retrieve
   ↓
User A's journal data
```

Ownership must be enforced explicitly rather than relying solely on opaque metadata.

> **Status:** resolved. `DocumentChunk.userId` is a real, indexed column, denormalized from
> `Injury.userId` at write time, and retrieval/journal lookups filter by it. See
> `docs/02-architecture.md` §11 (D9, resolved).

Telemetry should prefer identifiers and metadata over raw journal content. Sensitive content must be redacted when logging is necessary, and telemetry must have appropriate encryption, access controls, and retention policies.

---

## 9. Non-Goals

The product is not intended to:

- Diagnose medical conditions
- Replace healthcare professionals
- Prescribe medication or treatment
- Make medical decisions
- Provide emergency medical advice
- Automatically modify the user's original journal records
- Expose one user's journal data to another user

> **Status note:** the last item is now enforced — see §8 above.

---

## 10. Product Principles

### Grounded

Prefer information retrieved from the user's journal over unsupported model assumptions. *(Encouraged via prompt instruction; not verified. See §4.)*

### Traceable

Important claims should be connected to their underlying journal records. *(Not yet enforced at claim level. See §4.)*

### Private by Default

Only access the user's data when necessary, and avoid exposing personal health information through telemetry or other users' requests. *(Data isolation implemented — see §8. Telemetry protection remains open.)*

### Safe by Default

Perform safety checks before accessing healthcare data. *(Implemented on the input side. See §7.)*

### Incremental

Build the system progressively:

```text
Journal Data
     ↓
Ingestion
     ↓
Embeddings
     ↓
Vector Storage
     ↓
Safety
     ↓
Semantic Retrieval
     ↓
RAG
     ↓
Citations
     ↓
Agent
     ↓
Evaluation & Observability
```

This sequencing was followed faithfully — see `docs/04-implementation-roadmap.md` for current
status per step.

---

## 11. Future Direction

The initial product focuses on reliable retrieval and grounded summarization.

Future capabilities may include:

- More advanced agentic workflows
- Timeline-based reasoning
- Improved treatment and symptom comparisons
- Personalized journal summaries
- AI-assisted observability
- Production AWS orchestration
- Reproducible infrastructure

> Also see `docs/04-implementation-roadmap.md`'s "New items surfaced by the review series"
> section for a more granular, code-verified list of near-term work, including several
> higher-priority fixes (query-embedding correctness, the ingestion worker, the journal-tool
> placeholder) not previously captured anywhere in this document.
