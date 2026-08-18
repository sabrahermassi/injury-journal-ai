import json
from pathlib import Path

from sentence_transformers import SentenceTransformer, util


# Load benchmark dataset
dataset_path = Path(__file__).parent / "dataset.json"

with open(dataset_path, "r", encoding="utf-8") as file:
    dataset = json.load(file)

documents = dataset["documents"]
queries = dataset["queries"]


# Load embedding model
model = SentenceTransformer(
    "nomic-ai/nomic-embed-text-v1.5",
    revision="e9b6763023c676ca8431644204f50c2b100d9aab",
)


# Embed all documents once
document_texts = [
    f"search_document: {document['content']}"
    for document in documents
]

document_embeddings = model.encode(
    document_texts,
    normalize_embeddings=True,
)


recall_at_1 = 0
recall_at_3 = 0

recall_at_1_total = 0
recall_at_3_total = 0
recall_at_5_total = 0


# Evaluate every query
for query in queries:
    query_embedding = model.encode(
        f"search_query: {query['question']}",
        normalize_embeddings=True,
    )

    similarities = util.cos_sim(
        query_embedding,
        document_embeddings,
    )[0]

    ranked_indexes = similarities.argsort(descending=True)

    expected_documents = set(query["expected_documents"])

    top_1 = [
        documents[index]["id"]
        for index in ranked_indexes[:1]
    ]

    top_3 = [
        documents[index]["id"]
        for index in ranked_indexes[:3]
    ]

    top_5 = [
        documents[index]["id"]
        for index in ranked_indexes[:5]
    ]

    retrieved_at_1 = expected_documents.intersection(top_1)
    retrieved_at_3 = expected_documents.intersection(top_3)
    retrieved_at_5 = expected_documents.intersection(top_5)

    recall_at_1_total += (
        len(retrieved_at_1) / len(expected_documents)
    )

    recall_at_3_total += (
        len(retrieved_at_3) / len(expected_documents)
    )

    recall_at_5_total += (
    len(retrieved_at_5) / len(expected_documents)
    )

    print("\nQuestion:", query["question"])
    print("Expected:", query["expected_documents"])
    print("Top 3:")

    for index in ranked_indexes[:3]:
        document = documents[index]
        score = similarities[index].item()

        print(
            f"  {document['id']}: {score:.4f}"
        )

# Calculate final metrics
total_queries = len(queries)

recall_at_1_score = recall_at_1_total / total_queries
recall_at_3_score = recall_at_3_total / total_queries
recall_at_5_score = recall_at_5_total / total_queries

print("\n==============================")
print("Benchmark Results")
print("==============================")

print(f"Recall@1: {recall_at_1_score:.1%}")
print(f"Recall@3: {recall_at_3_score:.1%}")
print(f"Recall@5: {recall_at_5_score:.1%}")


