from embedding_service import (
    EmbeddingService,
    MODEL_NAME,
    VECTOR_DIMENSION,
    EMBEDDING_VERSION,
)

print("Model:", MODEL_NAME)
print("Vector dimension:", VECTOR_DIMENSION)
print("Embedding version:", EMBEDDING_VERSION)


service = EmbeddingService()

texts = [
    "The patient reported lower back pain.",
    "Physiotherapy provided limited improvement.",
    "The pain worsened after prolonged sitting.",
]

embeddings = service.embed_batch(texts)

print("Number of embeddings:", len(embeddings))
print("Embedding dimensions:", len(embeddings[0]))

for index, embedding in enumerate(embeddings, start=1):
    print(f"Chunk {index}: {len(embedding)} dimensions")
