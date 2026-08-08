# Injury Journal AI

AI-powered injury journal assistant exploring RAG, LLMs, agent orchestration, embeddings, vector search, safety guardrails, evaluation, and AI observability.

## Architecture

### Offline — Ingestion & Indexing

```mermaid
flowchart TD
    DB["Injury Journal<br/>PostgreSQL"] --> W["Ingestion Worker"]
    W --> C["Clean & Chunk"]
    C --> E["Generate Embeddings"]
    E --> V["PostgreSQL + pgvector"]
```

The offline pipeline prepares journal data for retrieval.

### Online — RAG & Agent Workflow

```mermaid
flowchart TD
    U["User"] --> API["AI Assistant API"]
    API --> A["AI Agent"]

    A --> R["RAG Tool"]
    R --> V["pgvector"]
    V --> R

    A --> S["Safety Check"]
    A --> G["LLM"]
    G --> CV["Citation Verification"]

    R --> G
    S --> G
    CV --> OUT["Answer + Sources"]
    OUT --> U
```

### Observability & Evaluation

```mermaid
flowchart TD
    A["AI Workflow"] --> O["Observability"]
    O --> C["CloudWatch / DynamoDB"]
    C --> AI["AI Observability Analyzer"]

    E["Evaluation Harness"] --> M["Retrieval<br/>Faithfulness<br/>Citations<br/>Safety"]
```

## Tech Stack

- TypeScript / Node.js
- PostgreSQL + pgvector
- LLM API
- Embedding models
- RAG
- AI agents
- AWS Lambda
- AWS Step Functions
- CloudWatch / DynamoDB
- Terraform
