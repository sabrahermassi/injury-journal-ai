# Injury Journal AI — Architecture

## 1. Overview

Injury Journal AI is an AI assistant built on top of an existing Injury Journal PostgreSQL application.

The system is designed to transform structured journal data into searchable AI context and use that context to generate grounded answers about the user's injury history.

The architecture is divided into two main flows:

- **Offline flow** — prepares journal data for AI retrieval by transforming records into documents, chunking them, generating embeddings, and storing the resulting vectors.
- **Online flow** — processes user questions through safety checks, authorization, retrieval, RAG, LLM generation, and citation verification.

The architecture also includes supporting systems for:

- **Evaluation** — measuring retrieval and answer quality.
- **Observability** — monitoring AI workflows and operational behavior.
- **Production infrastructure** — AWS services and infrastructure as code.
- **Security** — authentication, authorization, data isolation, and protection of journal data.

The system is intentionally built incrementally. The offline data and retrieval foundations are implemented before introducing the AI agent and production workflow.

## 2. Technology Stack

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

## 3. High-Level Architecture

```mermaid
flowchart TB
    DB["Injury Journal PostgreSQL"]

    subgraph OFFLINE["OFFLINE — DATA PREPARATION"]
        IW["Ingestion Worker"]
        CH["Clean & Chunk"]
        EM["Embedding Model"]
        VS["PostgreSQL + pgvector"]

        IW --> CH
        CH --> EM
        EM --> VS
    end

    DB --> IW

    subgraph ONLINE["ONLINE — USER REQUEST"]
        U["User"]
        API["AI Assistant API"]
        AG["AI Agent"]
        SAFE["Initial Safety Check"]
        AUTH["Per-Tool Authorization"]

        U --> API
        API --> AG
        AG --> SAFE

        SAFE -->|Outside boundary| REFUSE["Refuse / Redirect"]
        SAFE -->|Allowed| AUTH

        AUTH --> RAG["RAG Tool"]
        AUTH --> JOURNAL["Journal Tool"]

        RAG --> VS
        RAG --> LLM["LLM"]

        JOURNAL --> DB
        JOURNAL --> LLM

        LLM --> CIT["Citation Verification"]
        CIT --> ANSWER["Answer + Sources"]
        ANSWER --> U
        REFUSE --> U
    end

```

## 4. Offline Architecture

```mermaid
flowchart LR
    DB["Injury Journal PostgreSQL"]
    W["Ingestion Worker"]
    C["Clean & Chunk"]
    E["Embedding Model"]
    V["PostgreSQL + pgvector"]

    DB --> W
    W --> C
    C --> E
    E --> V
```

### 4.1. Offline Ingestion Pipeline

```mermaid
flowchart TD
    DB["Injury Journal PostgreSQL"]
    W["Ingestion Worker"]

    DB --> W
    W --> R["Read Records"]
    R --> T["Transform Records"]
    T --> D["Create Documents"]
    D --> C["Chunk Documents"]
    C --> OUT["Document Chunks"]
```

### 4.2. Embedding Architecture

```mermaid
flowchart TD
    C["Document Chunk"] --> S["Embedding Service"]
    S --> M["Qwen3-Embedding-0.6B"]
    M --> V["1024-Dimensional Vector"]
    V --> E["Embedded Document"]
```

### 4.3. Vector Storage with pgvector Architecture

```mermaid
flowchart TD
    V["Embedding Vector"]
    PG["PostgreSQL + pgvector"]

    V --> PG
```

## 5. Online Architecture

```mermaid
flowchart TD
    U["User"] --> API["AI Assistant API"]
    API --> A["AI Agent"]

    A --> S["Initial Safety Check"]

    S -->|Outside boundary| REF["Refuse / Redirect"]
    S -->|Allowed| AUTH["Per-Tool Authorization"]

    AUTH --> R["RAG Tool"]
    AUTH --> J["Journal Tool"]

    R --> V["PostgreSQL + pgvector"]
    J --> DB["Injury Journal PostgreSQL"]

    V --> DATA["Relevant Journal Data"]
    DB --> DATA

    DATA --> G["LLM"]
    G --> CV["Citation Verification"]
    CV --> OUT["Answer + Sources"]

    OUT --> U
```

### 5.1. Semantic Retrieval Architecture

```mermaid
flowchart TD
    Q["User Question"] --> E["Question Embedding"]
    E --> F["Metadata Filtering"]
    F --> V["pgvector Similarity Search"]
    V --> R["Rank by Similarity"]
    R --> K["Top-k Relevant Chunks"]
```

### 5.2. Basic RAG Architecture

```mermaid
flowchart TD
    Q["User Question"] --> R["Semantic Retrieval"]
    R --> C["Relevant Journal Chunks"]
    C --> B["Context Builder"]
    B --> L["LLM"]
    L --> A["Grounded Answer"]
```

### 5.3. Citation Architecture

```mermaid
flowchart TD
    C["Retrieved Chunk"] --> L["LLM"]
    L --> G["Generated Claims"]
    G --> V["Citation Verification"]
    V --> A["Answer + Sources"]
```

### 5.3. Safety Guardrails Architecture

```mermaid
flowchart TD
    Q["Question"] --> S["Safety Check"]

    S -->|Allowed| C["Continue"]
    S -->|Boundary Violation| R["Refuse / Redirect"]
```

### 5.3. AI Agent Architecture

The agent decides which tools are necessary.

```mermaid
flowchart TD
    U["User Question"] --> A["AI Agent"]
    A --> S["Initial Safety Check"]

    S -->|Boundary Violation| REF["Refuse / Redirect"]
    S -->|Allowed| AUTH["Per-tool Authorization"]

    AUTH --> R["RAG Tool"]
    AUTH --> J["Journal Tool"]

    R --> V["PostgreSQL + pgvector"]
    J --> DB["Injury Journal PostgreSQL"]

    V --> D["Relevant Journal Data"]
    DB --> D

    D --> L["LLM"]
    L --> C["Citation Check"]
    C --> OUT["Answer + Sources"]

    OUT --> U
```

## 6. Evaluation Architecture

```mermaid
flowchart TD
    Q["Evaluation Questions"] --> H["Evaluation Harness"]
    H --> AI["AI System"]
    AI --> R["Generated Results"]
    R --> E["Evaluation"]

    E --> RET["Retrieval Quality"]
    E --> F["Answer Faithfulness"]
    E --> C["Citation Accuracy"]
    E --> S["Safety Adherence"]
```

## 7. Observability Architecture

### 7.1 AI Observability

```mermaid
flowchart TD
    W["AI Workflow"]

    W --> R["Retrieval"]
    W --> A["Agent"]
    W --> L["LLM"]

    R --> T["Traces / Logs"]
    A --> T
    L --> T

    T --> C["CloudWatch"]
    T --> D["DynamoDB"]
```

### 7.2 AI-Assisted Observability

```mermaid
flowchart TD
    W["AI Workflow"] --> T["Logs / Metrics / Traces"]
    T --> A["AI Observability Analyzer"]
    A --> F["Findings / Recommendations"]
```

## 8. Production / AWS Architecture

### 8.1. Production Workflow

```mermaid
flowchart TD
    API["API Gateway"] --> L["Lambda"]
    L --> SF["Step Functions"]

    SF --> R["Retrieve"]
    SF --> S["Safety"]
    SF --> G["Generate"]

    R --> V["PostgreSQL + pgvector"]
    S --> RULES["Safety Rules"]
    G --> LLM["LLM"]

    S --> VER["Verification"]
    G --> VER

    VER --> RESULT["Result"]
```

### 8.2. Workflow Reliability

Step Functions provides:

- State management
- Retries
- Timeouts
- Failure handling
- Multi-step orchestration

Side-effecting operations must be designed to be idempotent so retries do not create duplicate data or unintended effects.

## 9. Infrastructure as Code: Terraform Architecture

```mermaid
flowchart TD
    T["Terraform"]

    T --> API["API Gateway"]
    T --> L["Lambda"]
    T --> SF["Step Functions"]
    T --> DB["PostgreSQL + pgvector"]
    T --> CW["CloudWatch"]
    T --> D["DynamoDB"]
    T --> IAM["IAM"]
    T --> SM["Secrets Manager"]

    T --> ENV["Environments"]
    ENV --> DEV["dev"]
    ENV --> PROD["prod"]
```

## 10. Security Architecture: Partial authorization

```mermaid
flowchart TD
    U["Authenticated User"] --> API["AI Assistant API"]
    API --> AUTH["Authorization"]

    AUTH -->|Authorized| R["Retrieval"]
    AUTH -->|Unauthorized| REF["Reject Request"]

    R --> F["User / Injury Filters"]
    F --> V["PostgreSQL + pgvector"]

    V --> D["User's Journal Data"]
```
