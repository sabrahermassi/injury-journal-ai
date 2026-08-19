# Embedding Model Benchmark

This directory evaluates candidate embedding models for the semantic retrieval component of Injury Journal AI.

The goal is to compare embedding models using the same dataset, queries, and retrieval procedure before selecting a model for the RAG pipeline.

## Run the benchmarks

From this directory:

````bash
python -m pip install -r requirements.txt

python test_qwen.py
python test_bge.py
python test_nomic.py

## Models Evaluated

- Qwen3-Embedding-0.6B
- BGE-M3
- Nomic Embed v1.5

### Model Revisions

The benchmark uses pinned Hugging Face model revisions to ensure that results are reproducible.

| Model                | Hugging Face Revision                      |
| -------------------- | ------------------------------------------ |
| Qwen3-Embedding-0.6B | `97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3` |
| BGE-M3               | `5617a9f61b028005a4858fdac845db406aefb181` |
| Nomic Embed v1.5     | `e9b6763023c676ca8431644204f50c2b100d9aab` |

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

## Benchmark Methodology Update

The initial main benchmark was rerun after applying model-specific query/document encoding recommended by the embedding models.

- **Qwen3-Embedding-0.6B:** query embeddings use `prompt_name="query"`; document embeddings are unprompted.
- **Nomic Embed v1.5:** documents use the `search_document:` prefix and queries use the `search_query:` prefix.
- **BGE-M3:** uses the standard encoding without additional prefixes.

The results below supersede the previous main benchmark results and are now used for model selection.

## Main Benchmark

The main benchmark uses a larger dataset with multiple relevant documents per query.

Each model is evaluated using its recommended retrieval encoding:

- **Qwen3-Embedding-0.6B**
  - Documents are embedded without a prompt.
  - Queries use `prompt_name="query"`.

- **BGE-M3**
  - Documents and queries are embedded using the model's standard encoding.

- **Nomic Embed v1.5**
  - Documents use the `search_document:` prefix.
  - Queries use the `search_query:` prefix.

The same dataset, expected results, cosine-similarity calculation, and Recall@k evaluation are used for every model.

| Model                | Dimensions |  Recall@1 |  Recall@3 |  Recall@5 |
| -------------------- | ---------: | --------: | --------: | --------: |
| Qwen3-Embedding-0.6B |       1024 | **45.0%** |     63.6% | **89.9%** |
| BGE-M3               |       1024 |     42.1% | **71.2%** |     82.4% |
| Nomic Embed v1.5     |        768 |     39.3% |     69.5% |     78.2% |

### Results

The benchmark shows different strengths across the models:

- **Qwen3-Embedding-0.6B** achieved the highest Recall@1 at **46.7%**.
- **BGE-M3** achieved the highest Recall@3 at **71.2%**.
- **Qwen3-Embedding-0.6B** achieved the highest Recall@5 at **93.2%**.

### Model Selection

**Qwen3-Embedding-0.6B remains the current selected model.**

It achieved the highest Recall@1 (**46.7%**) and, more importantly for the current RAG design, the highest Recall@5 (**93.2%**).

Recall@5 is currently prioritized because the RAG pipeline is expected to retrieve multiple relevant chunks before constructing the context passed to the LLM. A model that retrieves more relevant information within the top-k candidates is therefore preferable to one that only performs better at the first result.

BGE-M3 achieved the highest Recall@3 (**71.2%**), so it remains a strong alternative. However, Qwen's substantially higher Recall@5 (**93.2% vs. 81.6%**) makes it the better fit for the current retrieval strategy.

Nomic Embed v1.5 performed competitively at Recall@3 (**67.8%**) but had the lowest Recall@1 (**37.7%**) and Recall@5 (**77.4%**) among the three models in the corrected benchmark.

The selection is not considered permanent. The benchmark can be repeated as the dataset, chunking strategy, metadata filtering, retrieval strategy, and evaluation set evolve.

## Next Step

Use **Qwen3-Embedding-0.6B** for Step 2 — Embeddings to:

- Generate embeddings for journal chunks.
- Store embedding metadata and version information.
- Batch-embed document chunks.
- Prepare embeddings for storage in PostgreSQL with pgvector.

The next major implementation step is **Step 3 — Vector Storage with pgvector**.

### Benchmark Methodology Update

The initial benchmark results were generated before model-specific query/document encoding conventions were applied.

The benchmark was subsequently rerun using the recommended retrieval encoding for each model. The results below supersede the original main benchmark results and are the results used for model selection.

The original smoke-test results are retained above as a historical technical validation only.

```

```
````
