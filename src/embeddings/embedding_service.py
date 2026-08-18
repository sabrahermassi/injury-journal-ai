from sentence_transformers import SentenceTransformer


MODEL_NAME = "Qwen/Qwen3-Embedding-0.6B"
VECTOR_DIMENSION = 1024
EMBEDDING_VERSION = "qwen3-embedding-0.6b-v1"


class EmbeddingService:
    def __init__(self):
        self.model = SentenceTransformer(
            MODEL_NAME,
            revision="97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3",
        )

    def embed_document(self, text: str) -> list[float]:
        embedding = self.model.encode(
            text,
            normalize_embeddings=True,
        )

        return embedding.tolist()

    def embed_query(self, text: str) -> list[float]:
        embedding = self.model.encode(
            text,
            prompt_name="query",
            normalize_embeddings=True,
        )

        return embedding.tolist()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        embeddings = self.model.encode(
            texts,
            normalize_embeddings=True,
        )

        return embeddings.tolist()