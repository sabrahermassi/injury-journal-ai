from fastapi import FastAPI
from pydantic import BaseModel

from embedding_service import EmbeddingService


app = FastAPI()

embedding_service = EmbeddingService()


class EmbeddingRequest(BaseModel):
    text: str


class BatchEmbeddingRequest(BaseModel):
    texts: list[str]


@app.post("/embed")
def embed(request: EmbeddingRequest):
    embedding = embedding_service.embed(request.text)

    return {
        "embedding": embedding,
        "model": "Qwen/Qwen3-Embedding-0.6B",
        "dimension": len(embedding),
        "version": "qwen3-embedding-0.6b-v1",
    }


@app.post("/embed-batch")
def embed_batch(request: BatchEmbeddingRequest):
    embeddings = embedding_service.embed_batch(request.texts)

    return {
        "embeddings": embeddings,
        "model": "Qwen/Qwen3-Embedding-0.6B",
        "dimension": len(embeddings[0]) if embeddings else 0,
        "version": "qwen3-embedding-0.6b-v1",
    }
