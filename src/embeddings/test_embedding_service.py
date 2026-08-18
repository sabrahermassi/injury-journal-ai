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
    "The treatment provided limited improvement.",
    "The user reported burning pain in the lower back.",
    "The pain became worse after prolonged standing.",
]

embeddings = service.embed_batch(texts)

print("Number of embeddings:", len(embeddings))
print("Embedding dimensions:", len(embeddings[0]))

for i, embedding in enumerate(embeddings):
    print(f"Chunk {i + 1}: {len(embedding)} dimensions")
