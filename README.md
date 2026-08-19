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
- Citations
- Safety guardrails

### In Progress

- AI agents

### Planned

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

### Semantic Retrieval

#### Current Implementation:

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

#### Future Retrieval Improvements

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

### Citation Generation

The current implementation performs citation generation from retrieved chunks.
(answers the question: Which journal records support this answer?)

It currently provides:

- Citation generation from retrieved chunks
- Citation mapper
- Citation formatting
- Source mapping
- Citation metadata preservation

Implemented helper:

- Source-level citation verification utility (tested independently)

#### Future Citation Improvements

- Integrate citation verification into the RAG response pipeline
- Advanced claim-level citation verification can be added later.

Goal:

Verify that individual generated claims are supported by the retrieved evidence.

Future flow:

Generated Answer
→ Claim Extraction
→ Evidence Matching
→ Claim Support Verification
→ Verified Answer

Example:

Generated claim:

"The patient improved after physiotherapy."

Evidence:

Treatment #42:
"Physiotherapy completed. Outcome: improved."

Verification:

✓ Claim supported by source

### Safety Guardrails

#### Current Implementation:

The first safety layer uses deterministic rules to enforce healthcare boundaries. This is intentional because safety boundaries should be:

- Predictable
- Testable
- Easy to audit

The goal is not to diagnose medical conditions. The assistant organizes and summarizes the user's journal information.

Current safety flow:

User Question
→ Safety Check
→ Allowed Request → RAG Pipeline
→ Unsafe Request → Safe Response

Implemented:

- Detect direct diagnosis requests
- Block unsafe medical diagnosis questions
- Provide safe redirect responses
- Allow journal summarization and history-based questions

#### Future Safety Improvements

- AI-based intent classification
- More comprehensive medical safety categories
- Context-aware risk assessment
- Prompt injection detection
- Output safety checks
- Safety evaluation dataset

Future safety architecture:

User Question
→ Rule-Based Checks
→ AI Safety Classifier
→ Policy Decision
→ RAG / Safe Response

Do not introduce AI-based classification prematurely. The current safety layer provides explicit healthcare boundaries before adding more complex agent behavior.
