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

- **Natural-language access:** Users can ask questions without knowing the underlying database structure.
- **Grounded answers:** Responses are based on information retrieved from the user's journal.
- **Traceability:** Important claims can be traced to their underlying journal records.
- **Useful summaries:** Users can generate concise summaries of their injury history.
- **Healthcare safety:** The assistant operates within explicit healthcare boundaries.
- **Privacy:** Users can only access their own journal data.

---

## 5. Core Use Cases

### Search Journal History

> What treatments have I tried?

Retrieve relevant treatment records and summarize them.

### Compare Treatment Outcomes

> Which treatments did not improve my symptoms?

Retrieve relevant treatment and outcome information and summarize it.

### Search Symptoms and Events

> When did my lower back symptoms become worse?

Retrieve relevant symptom and timeline records.

### Prepare a Doctor Summary

> Generate a summary of my injury history for my doctor.

Retrieve relevant timeline events, treatments, symptoms, and medical visits, then generate a source-backed summary.

### Retrieve Specific History

> What happened after my physiotherapy treatment?

Retrieve relevant journal records and summarize the available information.

---

## 6. Core Features

### Natural-Language Search

Users ask questions in normal language rather than writing database queries.

### Semantic Retrieval

Embeddings and vector search find relevant information based on meaning rather than exact keyword matches.

### Retrieval-Augmented Generation

Relevant journal information is provided to the LLM as context before an answer is generated.

### Source Citations

Generated answers identify the journal records used to support their claims.

### AI Agent

The assistant may eventually orchestrate tools such as:

- RAG retrieval
- Journal/database access
- Safety checks
- Citation verification

The agent is built after the underlying retrieval, RAG, and safety capabilities exist.

### Evaluation

The system measures:

- Retrieval quality
- Answer faithfulness
- Citation accuracy
- Safety adherence

### AI Observability

The system tracks operational information such as:

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

Requests outside these boundaries should be refused or redirected.

The initial safety decision must occur **before retrieving journal data or invoking RAG/journal tools**. Per-tool authorization remains a separate control before each tool accesses user data.

---

## 8. Privacy and Security Requirements

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

---

## 10. Product Principles

### Grounded

Prefer information retrieved from the user's journal over unsupported model assumptions.

### Traceable

Important claims should be connected to their underlying journal records.

### Private by Default

Only access the user's data when necessary, and avoid exposing personal health information through telemetry or other users' requests.

### Safe by Default

Perform safety checks before accessing healthcare data.

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
