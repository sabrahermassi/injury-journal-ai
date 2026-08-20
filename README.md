# Injury Journal AI

AI-powered injury journal assistant exploring RAG, LLMs, agent orchestration, embeddings, vector search, safety guardrails, evaluation, and AI observability.

## Project Status

The project is being built incrementally, starting with the offline ingestion pipeline and embeddings before adding semantic retrieval, RAG, agents, and production infrastructure.

## Documentation

- [Product](docs/01-product.md) — Product goals, scope, features, and intended use.
- [Architecture](docs/02-architecture.md) — Overall system architecture and technical design.
- [Chunker Architecture](docs/03-chunker-architecture.md) — Detailed design of the document chunking component.
- [Implementation Roadmap](docs/04-implementation-roadmap.md) — Step-by-step implementation plan and progress.

## Tech Stack

### Implemented

- TypeScript / Node.js
- PostgreSQL
- Prisma
- Embedding model integration
- pgvector
- Semantic retrieval
- Retrieval-Augmented Generation (RAG)

### In Progress

- Citations

### Planned

- Safety guardrails
- AI agents
- Evaluation
- AI observability
- Terraform
- AWS Lambda
- AWS Step Functions
- CloudWatch / DynamoDB

## Project Goal

Build a production-oriented AI assistant that can:

- Answer questions about a user's injury journal
- Retrieve relevant historical information
- Generate grounded summaries
- Cite the underlying journal records
- Apply healthcare safety boundaries
- Evaluate retrieval and answer quality
- Monitor AI workflows and operational behavior

The system is designed to be built one layer at a time, with the data and retrieval foundations established before introducing agentic workflows.

## Future Improvements

### Offline Ingestion Pipeline

- [x] Document chunking
- [x] Generate embeddings
- [x] Store embeddings in pgvector
- [x] Make document-chunk ingestion idempotent
- [x] Serialize ingestion per `(sourceType, sourceId)` to prevent concurrent prune races
- [ ] Add distributed ingestion locking/versioning for production deployments

#### Ingestion Concurrency

The current implementation uses an in-process lock keyed by
`(sourceType, sourceId)`. This prevents overlapping ingestions for the same
source from racing during stale-chunk cleanup.

This is sufficient for the current single-process development architecture.
For production deployments with multiple workers, containers, or Lambda
instances, replace or supplement this with distributed coordination such as
PostgreSQL advisory locks or source revision/versioning.

Database transactions should not remain open while waiting for embedding API
requests.

## Semantic Retrieval

Implemented:

- Embed the user's question using the embedding service
- Search `DocumentChunk` using pgvector cosine distance
- Rank results by vector similarity
- Retrieve configurable top-k results
- Filter retrieval by `injuryId`
- Unit tests for the semantic retrieval service
- Integration tests for pgvector similarity search

Current retrieval flow:

User Question
→ Question Embedding
→ Metadata Filtering
→ pgvector Similarity Search
→ Similarity Ranking
→ Top-k Relevant Chunks

### Future Retrieval Improvements

The current retrieval implementation is intentionally minimal. Revisit and extend it when retrieval requirements become clearer.

Potential filters:

- `userId`
- `sourceType`
- Date range

Potential retrieval improvements:

- Metadata filtering
- Similarity threshold
- Hybrid keyword + vector search
- Retrieval evaluation
- Query-specific retrieval tuning
- Reranking if needed

Do not add these prematurely. The current `semanticSearch()` service provides the initial retrieval layer for RAG.
