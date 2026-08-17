# Embedding Model Benchmark

This directory evaluates candidate embedding models for the semantic retrieval component of Injury Journal AI.

The goal is to compare embedding models using the same dataset, queries, and retrieval procedure before selecting a model for the RAG pipeline.

## Models Evaluated

- Qwen3-Embedding-0.6B
- BGE-M3
- Nomic Embed v1.5

## Evaluation Method

For each model:

1. Generate embeddings for all documents.
2. Generate an embedding for each query.
3. Calculate cosine similarity between the query and document embeddings.
4. Rank documents by similarity.
5. Measure Recall@1, Recall@3, and Recall@5.

### Recall@k

Recall@k measures how many of the expected relevant documents were retrieved within the top `k` results.

```text
Recall@k =
relevant documents retrieved in top-k
-------------------------------------
total relevant documents
```

This is particularly important for RAG because multiple relevant chunks may need to be retrieved before constructing the context supplied to the LLM.

## Preliminary Smoke Test

Before building the larger evaluation dataset, the three candidate embedding models were tested on a small dataset containing 6 documents and 4 queries.

| Model                | Recall@1 | Recall@3 |
| -------------------- | -------: | -------: |
| Qwen3-Embedding-0.6B |      75% |     100% |
| BGE-M3               |      75% |     100% |
| Nomic Embed v1.5     |      75% |     100% |

### Observations

- All three models successfully produced embeddings.
- All three retrieved the expected documents within the top 3 results.
- Qwen and BGE-M3 ranked the correct document third for the query `"What treatment only helped temporarily?"`.
- Nomic ranked the correct document first for that query.
- The dataset was too small to make a final model selection.

These results were used only as a technical smoke test and should not be considered representative of production retrieval performance.

## Main Benchmark

The main benchmark uses a larger dataset with multiple relevant documents per query. The same dataset, queries, and evaluation procedure are used for every embedding model.

| Model                | Dimensions |  Recall@1 |  Recall@3 |  Recall@5 |
| -------------------- | ---------: | --------: | --------: | --------: |
| Qwen3-Embedding-0.6B |       1024 |     39.2% |     67.2% | **83.1%** |
| BGE-M3               |       1024 | **42.9%** |     71.2% |     81.6% |
| Nomic Embed v1.5     |        768 |     40.6% | **72.8%** |     80.3% |

### Results

The benchmark produced different strengths across the models:

- **BGE-M3** achieved the highest Recall@1 at **42.9%**.
- **Nomic Embed v1.5** achieved the highest Recall@3 at **72.8%**.
- **Qwen3-Embedding-0.6B** achieved the highest Recall@5 at **83.1%**.

### Model Selection

**Qwen3-Embedding-0.6B is the current selected model.**

It achieved the highest Recall@5 (**83.1%**) on the current evaluation dataset.

Recall@5 was prioritized because the RAG pipeline is expected to retrieve multiple relevant chunks before constructing the context passed to the LLM. Therefore, retrieving relevant information within the top 5 results is currently more important than having the single highest-ranked result.

The selection is not considered permanent. The benchmark can be repeated as the dataset, chunking strategy, metadata filtering, and retrieval pipeline evolve.

## Next Step

Use **Qwen3-Embedding-0.6B** in Step 2 — Embeddings to:

- Generate embeddings for journal chunks.
- Store embeddings and embedding metadata.
- Integrate PostgreSQL with pgvector.
- Prepare the data for semantic retrieval.

## Files

```text
evaluation/embeddings/
├── dataset.json
├── test_qwen.py
├── test_bge.py
├── test_nomic.py
└── README.md
```
