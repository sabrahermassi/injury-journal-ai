# Injury Journal AI — Implementation Roadmap

A step-by-step reference for building a production-oriented AI assistant on top of the existing Injury Journal PostgreSQL application.

The architecture grows incrementally. Each step adds one layer to the system.

---

# Injury Journal AI — Implementation Checklist

Use this checklist to track implementation progress.
Click a step to jump directly to that section.

- [x] [Step 0 — Project Foundation](#step-0--project-foundation)
- [ ] [Step 1 — Offline Ingestion Pipeline](#step-1--offline-ingestion-pipeline)
- [ ] [Step 2 — Embeddings](#step-2--embeddings)
- [ ] [Step 3 — Vector Storage with pgvector](#step-3--vector-storage-with-pgvector)
- [ ] [Step 4 — Semantic Retrieval](#step-4--semantic-retrieval)
- [ ] [Step 5 — Basic RAG](#step-5--basic-rag)
- [ ] [Step 6 — Citations](#step-6--citations)
- [ ] [Step 7 — Safety Guardrails](#step-7--safety-guardrails)
- [ ] [Step 8 — AI Agent](#step-8--ai-agent)
- [ ] [Step 9 — Evaluation](#step-9--evaluation)
- [ ] [Step 10 — AI Observability](#step-10--ai-observability)
- [ ] [Step 11 — AI-Assisted Observability](#step-11--ai-assisted-observability)
- [ ] [Step 12 — Production Workflow with AWS](#step-12--production-workflow-with-aws)
- [ ] [Step 13 — Infrastructure as Code](#step-13--infrastructure-as-code)
- [ ] [Step 14 — Security and Production Hardening](#step-14--security-and-production-hardening)
- [ ] [Step 15 — Final End-to-End Architecture](#step-15--final-end-to-end-architecture)

---

# Injury Journal AI — Roadmap

A step-by-step implementation roadmap for building the project from the initial foundation to a production-oriented AI system.

**Implementation rule:** Complete each step before moving to the next. The architecture grows incrementally with every step.

**Important:** Do not build the AI Agent first. Build the data, embeddings, vector storage, retrieval, and RAG foundations first.

---

# Step 0 — Project Foundation

**Goal:** Set up the AI project independently from the existing Injury Journal application.

## Implement

- TypeScript
- ESLint / Prettier
- Environment variables
- Project structure
- Prisma database connection
- PostgreSQL connection
- README and documentation

## Architecture

```text
Injury Journal PostgreSQL
          │
          ▼
   Injury Journal AI
      TypeScript
          │
        Prisma
          │
          ▼
      PostgreSQL
```

## Result

The AI project can safely read data from the existing Injury Journal database.

---

# Step 1 — Offline Ingestion Pipeline

**Goal:** Transform structured journal records into AI-searchable documents.

Existing data:

- Injury
- Symptom
- Treatment
- MedicalVisit
- TimelineEvent

## Implement

Build:

- PostgreSQL reader
- Document builder
- Chunker
- Ingestion worker

## Architecture

```text
PostgreSQL
    │
    ▼
Ingestion Worker
    │
    ├── Read records
    ├── Transform records
    ├── Create documents
    └── Chunk documents
            │
            ▼
       Document Chunks
```

Example:

```text
Treatment
  ↓
"On June 1, 2026, the user received
physiotherapy from Clinic A.
The reported outcome was no improvement."
```

## Result

The database data has been transformed into text suitable for AI processing.

---

# Step 2 — Embeddings

**Goal:** Convert journal chunks into vector representations.

## Implement

- Embedding service
- Embedding model integration
- Batch embedding
- Embedding storage format

## Architecture

```text
Document Chunk
      │
      ▼
Embedding Model
      │
      ▼
Vector
```

Each chunk receives an embedding representing its semantic meaning.

## Result

Journal text can now be represented mathematically for semantic search.

---

# Step 3 — Vector Storage with pgvector

**Goal:** Store embeddings and make them searchable.

Use:

**PostgreSQL + pgvector**

## Implement

Create RAG-specific storage containing:

```text
DocumentChunk

id
injuryId
sourceType
sourceId
content
embedding
metadata
createdAt
```

## Architecture

```text
Document Chunks
      │
      ▼
Embedding Model
      │
      ▼
Vectors
      │
      ▼
PostgreSQL + pgvector
```

Metadata should allow the system to trace a chunk back to its original journal record.

## Result

The project now has a vector database for semantic retrieval.

---

# Step 4 — Semantic Retrieval

**Goal:** Build the retrieval component of RAG.

Example:

> What treatments didn't work?

## Implement

- Query embedding
- pgvector similarity search
- Top-k retrieval
- Metadata filtering
- Retrieval service

## Architecture

```text
User Question
      │
      ▼
Question Embedding
      │
      ▼
pgvector Similarity Search
      │
      ▼
Top Relevant Chunks
```

Possible filters:

- User
- Injury
- Source type
- Date range

## Result

The system can find relevant journal information based on meaning rather than exact keywords.

---

# Step 5 — Basic RAG

**Goal:** Combine retrieval with an LLM.

Without RAG:

```text
Question
   │
   ▼
  LLM
   │
   ▼
Answer
```

With RAG:

```text
Question
   │
   ▼
Retrieval
   │
   ▼
Relevant Journal Chunks
   │
   ▼
Context Construction
   │
   ▼
LLM
   │
   ▼
Grounded Answer
```

## Implement

- Context builder
- Prompt
- LLM service
- RAG service
- RAG API endpoint

## Result

This is the project's **first complete AI application**.

---

# Step 6 — Citations

**Goal:** Make generated answers traceable to the original journal records.

## Implement

Store source metadata with every chunk:

```text
sourceType
sourceId
injuryId
date
```

Build:

- Citation generation
- Citation formatting
- Source mapping
- Citation verification

## Architecture

```text
Retrieved Chunk
      │
      ▼
      LLM
      │
      ▼
Generated Claims
      │
      ▼
Citation Verification
      │
      ▼
Answer + Sources
```

Example:

```text
The user tried physiotherapy in June 2026
with no reported improvement.

Sources:
- Treatment #42 — June 2026
```

## Result

The RAG system becomes source-backed and more resistant to unsupported claims.

---

# Step 7 — Safety Guardrails

**Goal:** Keep the assistant within safe boundaries.

The system organizes and summarizes the user's information. It does not diagnose medical conditions.

## Implement

- Safety rules
- Input boundary checks
- Safe refusal responses
- Optional output checks

## Architecture

```text
Question
   │
   ▼
Safety Check
   │
   ├──────────────┐
   │              │
Allowed       Boundary Violation
   │              │
   ▼              ▼
Continue      Refuse / Redirect
```

Example:

```text
"Summarize my treatments."
→ Allowed

"Do I have cancer?"
→ Boundary violation
```

## Result

The AI application has explicit healthcare safety boundaries.

---

# Step 8 — AI Agent

**Goal:** Add agentic orchestration after RAG and safety foundations work.

Do **not** build the agent before the underlying tools exist.

## Implement

Create tools such as:

- RAG tool
- Journal/database tool
- Safety tool
- Citation tool

Use either:

- LangGraph
- Hand-rolled state machine

## Architecture

```text
User Question
      │
      ▼
   AI Agent
      │
      ├──────────────┐
      ▼              ▼
   RAG Tool      Journal Tool
      │              │
      ▼              ▼
  pgvector       PostgreSQL
      │              │
      └──────┬───────┘
             ▼
        Safety Tool
             │
             ▼
            LLM
             │
             ▼
      Citation Check
             │
             ▼
       Answer + Sources
```

The agent decides which tools are necessary.

## Example

> Generate a summary of my injury history for my doctor.

Possible workflow:

```text
Agent
 ↓
Retrieve relevant timeline events
 ↓
Retrieve treatments
 ↓
Retrieve symptoms
 ↓
Check safety boundaries
 ↓
Generate summary
 ↓
Verify citations
 ↓
Return summary
```

## Result

The project now demonstrates **agentic AI**, rather than simply calling an LLM.

---

# Step 9 — Evaluation

**Goal:** Measure whether the AI system actually works.

## Implement

Create an evaluation dataset containing:

- Representative questions
- Expected behavior
- Expected sources
- Safety/adversarial questions

Evaluate:

- Retrieval quality
- Answer faithfulness
- Citation accuracy
- Safety adherence

## Architecture

```text
Test Questions
      │
      ▼
Evaluation Harness
      │
      ▼
AI System
      │
      ▼
Generated Results
      │
      ▼
Evaluation
      │
      ├── Retrieval
      ├── Faithfulness
      ├── Citations
      └── Safety
```

## Result

You can measure changes to the AI system instead of relying only on manually testing it.

---

# Step 10 — AI Observability

**Goal:** Understand what happens during every AI request.

## Implement

Track:

- Request ID
- Agent step
- Retrieval latency
- Retrieved chunks
- Similarity scores
- LLM calls
- Token usage
- Errors
- Cost
- Final result

## Architecture

```text
                  AI Workflow
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
      Retrieval      Agent         LLM
          │            │            │
          └────────────┼────────────┘
                       ▼
                  Traces / Logs
                       │
                ┌──────┴──────┐
                ▼             ▼
           CloudWatch      DynamoDB
```

## Result

You can see **how** the AI reached an answer and where failures occur.

---

# Step 11 — AI-Assisted Observability

**Goal:** Use AI to analyze the AI system's own telemetry.

This is an additional AI layer, not basic observability.

## Example questions

```text
Why are retrieval scores dropping?

Which prompts frequently fail?

Which answers have citation problems?

Which agent steps are slow?

Which requests repeatedly trigger safety boundaries?
```

## Architecture

```text
AI Workflow
     │
     ▼
Logs / Metrics / Traces
     │
     ▼
AI Observability Analyzer
     │
     ▼
Findings / Recommendations
```

## Result

The system can use AI to help analyze its own operational behavior.

---

# Step 12 — Production Workflow with AWS

**Goal:** Move the multi-step agent workflow toward a production architecture.

## Implement

Use:

- API Gateway
- Lambda
- Step Functions

## Architecture

```text
                 API Gateway
                      │
                      ▼
                   Lambda
                      │
                      ▼
              Step Functions
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
    Retrieve        Safety       Generate
        │             │             │
        ▼             ▼             ▼
    pgvector        Rules           LLM
                      │
                      ▼
                Verification
                      │
                      ▼
                   Result
```

Step Functions provides:

- State management
- Retries
- Timeouts
- Failure handling
- Multi-step orchestration

## Result

The agent workflow becomes more reliable and production-oriented.

---

# Step 13 — Infrastructure as Code

**Goal:** Make the infrastructure reproducible.

## Implement

Use Terraform for:

- API Gateway
- Lambda
- Step Functions
- PostgreSQL / pgvector
- CloudWatch
- DynamoDB
- IAM
- Secrets Manager

Create separate environments where appropriate:

```text
dev
prod
```

## Architecture

```text
Terraform
   │
   ├── API Gateway
   ├── Lambda
   ├── Step Functions
   ├── PostgreSQL
   ├── CloudWatch
   ├── DynamoDB
   ├── IAM
   └── Secrets Manager
```

## Result

The infrastructure can be recreated consistently rather than configured manually.

---

# Step 14 — Security and Production Hardening

**Goal:** Protect personal journal information.

## Implement

- Authentication
- Authorization
- User-level data isolation
- Input validation
- Secret management
- Least-privilege IAM
- Secure API endpoints
- Safe logging
- Vector-level authorization

Critical rule:

```text
User A
  ↓
Can only retrieve
  ↓
User A's journal data
```

The RAG system must never expose another user's information.

## Result

Security applies across both the normal database and AI retrieval layers.

---

# Step 15 — Final End-to-End Architecture

At the end, the system becomes:

```text
                         USER
                           │
                           ▼
                  AI Assistant API
                           │
                           ▼
                       AI AGENT
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
          RAG Tool     Safety Tool   Journal Tool
             │             │             │
             ▼             ▼             ▼
          pgvector        Rules       PostgreSQL
             │
             ▼
      Relevant Journal Data
             │
             ▼
            LLM
             │
             ▼
    Citation Verification
             │
             ▼
       Answer + Sources
             │
             ▼
           USER
```

---

# Offline vs Online Architecture

The system has two major AI flows.

## Offline — Data Preparation

This happens before the user asks a question.

```text
PostgreSQL
    │
    ▼
Ingestion Worker
    │
    ▼
Transform
    │
    ▼
Chunk
    │
    ▼
Embedding Model
    │
    ▼
pgvector
```

The offline pipeline prepares the searchable knowledge.

---

## Online — AI Request

This happens when the user asks something.

```text
User Question
     │
     ▼
AI Assistant API
     │
     ▼
AI Agent
     │
     ├── RAG Tool
     ├── Journal Tool
     └── Safety Tool
             │
             ▼
        Relevant Data
             │
             ▼
            LLM
             │
             ▼
      Citation Verification
             │
             ▼
       Answer + Sources
```

---

# AI vs Infrastructure

Not every component is AI.

## AI / AI-specific

```text
LLM
Embedding Model
Embeddings
Semantic Retrieval
RAG
AI Agent
Tool Calling
Safety Guardrails
Citation Verification
AI Evaluation
AI Observability Analyzer
```

## Infrastructure / Engineering

```text
PostgreSQL
pgvector storage
REST API
Authentication
Authorization
Lambda
Step Functions
CloudWatch
DynamoDB
Terraform
IAM
Networking
```

Some technologies, such as pgvector, are **AI infrastructure** but are not themselves AI models.

---

# Technology Stack

| Area            | Technology                |
| --------------- | ------------------------- |
| Language        | TypeScript                |
| Backend         | Node.js                   |
| API             | REST                      |
| Database        | PostgreSQL                |
| ORM             | Prisma                    |
| Vector Database | PostgreSQL + pgvector     |
| Embeddings      | Embedding model API       |
| LLM             | LLM API                   |
| RAG             | Custom RAG pipeline       |
| Agent           | LangGraph / state machine |
| Safety          | Application guardrails    |
| Evaluation      | Custom evaluation harness |
| Observability   | CloudWatch / DynamoDB     |
| Cloud           | AWS                       |
| Workflow        | Step Functions            |
| Compute         | Lambda                    |
| IaC             | Terraform                 |

---

# Overall Learning Map

| Step                   | AI? | Main Skill                     |
| ---------------------- | --- | ------------------------------ |
| Project foundation     | ⚪  | TypeScript / architecture      |
| PostgreSQL integration | ⚪  | Database engineering           |
| Offline ingestion      | ⚪  | Data preparation for AI        |
| Embeddings             | 🟢  | Embedding models               |
| pgvector               | 🟢  | Vector search infrastructure   |
| Retrieval              | 🟢  | Semantic search                |
| RAG                    | 🟢  | Retrieval-Augmented Generation |
| Citations              | 🟢  | Grounded generation            |
| Safety                 | 🟢  | AI guardrails                  |
| Agent                  | 🟢  | Agentic AI / orchestration     |
| Evaluation             | 🟢  | AI quality measurement         |
| Observability          | 🟡  | LLMOps / AI operations         |
| AI observability       | 🟢  | AI-assisted monitoring         |
| AWS workflow           | 🟡  | Production AI infrastructure   |
| Terraform              | ⚪  | Infrastructure as Code         |
| Security               | ⚪  | Production security            |

---

# Final Goal

Build a production-oriented **AI Injury Journal Assistant** that can:

- Answer questions about a user's journal
- Retrieve relevant historical information
- Generate grounded summaries
- Cite the underlying journal entries
- Use an AI agent to orchestrate multiple tools
- Apply healthcare safety boundaries
- Evaluate retrieval and answer quality
- Trace and monitor AI workflows
- Use AI to analyze operational telemetry
- Run through a reliable AWS architecture
- Be deployed reproducibly using Infrastructure as Code

The project should be implemented **one step at a time**.

The architecture should grow with each implementation step.

**Do not build the AI agent first. Build the data, embeddings, retrieval, and RAG foundations first.**
