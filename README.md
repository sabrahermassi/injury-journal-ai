# Injury Journal AI

AI-powered injury journal assistant exploring RAG, LLMs, agent orchestration, embeddings, vector search, safety guardrails, evaluation, and AI observability.

## Architecture

### Offline — Ingestion & Indexing (WIP: Generate embeddings)

```mermaid
flowchart TD
    DB["Injury Journal<br/>PostgreSQL"] --> W["Ingestion Worker"]
    W --> C["Clean & Chunk"]
    C --> E["Generate Embeddings"]
    E --> V["PostgreSQL + pgvector"]
```

The offline pipeline prepares journal data for retrieval.

### Online — RAG & Agent Workflow (Future)

```mermaid
flowchart TD
    U["User"] --> API["AI Assistant API"]
    API --> A["AI Agent"]

    A --> S["Safety Check"]

    S -->|Allowed| AUTH["Tool Authorization"]
    S -->|Boundary Violation| REF["Refuse / Redirect"]

    AUTH --> R["RAG Tool"]
    R --> V["PostgreSQL + pgvector"]
    V --> R

    R --> G["LLM"]
    G --> CV["Citation Verification"]
    CV --> OUT["Answer + Sources"]

    REF --> OUT
    OUT --> U
```

### Observability & Evaluation (Future)

```mermaid
flowchart TD
    A["AI Workflow"] --> O["Observability"]
    O --> C["CloudWatch / DynamoDB"]
    C --> AI["AI Observability Analyzer"]

    E["Evaluation Harness"] --> M["Retrieval<br/>Faithfulness<br/>Citations<br/>Safety"]
```

## Tech Stack

### Implemented

- TypeScript / Node.js
- PostgreSQL
- Prisma
- Terraform

### Planned

- pgvector
- Embedding model
- LLM API
- RAG
- AI agents
- AWS Lambda
- AWS Step Functions
- CloudWatch / DynamoDB
