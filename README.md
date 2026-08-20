# Injury Journal AI

AI-powered injury journal assistant exploring RAG, LLMs, agent orchestration, embeddings, vector search, safety guardrails, evaluation, and AI observability.

## Project Status

The AI assistant MVP has been implemented.

The project was built incrementally, starting with the data ingestion and embedding foundations, then adding semantic retrieval, RAG, safety guardrails, agent orchestration, and AI system evaluation.

## Documentation

- [Product](docs/01-product.md) — Product goals, scope, features, and intended use.
- [Architecture](docs/02-architecture.md) — Overall system architecture and technical design.
- [Chunker Architecture](docs/03-chunker-architecture.md) — Detailed design of the document chunking component.
- [Implementation Roadmap](docs/04-implementation-roadmap.md) — Step-by-step implementation plan and progress.

## Tech Stack

### MVP Implemented

#### AI Retrieval Pipeline

- TypeScript / Node.js
- PostgreSQL
- Prisma
- Embedding model integration
- pgvector vector storage
- Document chunking
- Semantic retrieval
- Retrieval-Augmented Generation (RAG)
- Citation generation

#### AI Safety and Agent Layer

- Safety guardrails for healthcare boundaries
- Hand-written AI agent orchestration
- Agent state management
- Intent routing
- Tool-based architecture:
  - RAG tool
  - Journal tool
  - Safety tool
  - Citation handling

#### AI System Evaluation

- Evaluation dataset
- Evaluation harness
- Retrieval evaluation
- Intent evaluation
- Citation evaluation
- Safety evaluation
- Evaluation reporting

## Production Improvements

Future work focuses on making the system production-ready, scalable, and operationally robust.

### Security and Privacy

- Authentication
- Authorization
- User-level data isolation
- Vector-level authorization
- Secure API endpoints
- Safe logging

### Retrieval and AI Quality Improvements

- Hybrid keyword + vector search
- Retrieval reranking
- Similarity thresholds
- Query-specific retrieval tuning
- Advanced evaluation metrics:
  - Recall@k
  - Mean Reciprocal Rank (MRR)
  - RAGAS
  - LLM-as-a-judge

### AI Agent Improvements

- More complex multi-step workflows
- Persistent agent state
- Dynamic tool selection
- LangGraph integration when workflows require it

### Cloud and Infrastructure

- AI observability and tracing
- Terraform infrastructure management
- AWS Lambda workloads
- AWS Step Functions workflows
- CloudWatch monitoring
- DynamoDB-based distributed state patterns

## Project Goal

Build a production-oriented AI assistant that can:

- Answer questions about a user's injury journal
- Retrieve relevant historical information
- Generate grounded summaries
- Cite underlying journal records
- Apply healthcare safety boundaries
- Evaluate AI system quality

The system is designed to be built one layer at a time, with the data and retrieval foundations established before introducing agentic workflows.
