from fastapi import FastAPI
from fastapi import HTTPException
from pydantic import BaseModel

from .embedding_service import EmbeddingService


app = FastAPI()

embedding_service = EmbeddingService()


class EmbeddingRequest(BaseModel):
    text: str


class BatchEmbeddingRequest(BaseModel):
    texts: list[str]


@app.post("/embed")
def embed(request: EmbeddingRequest):
    embedding = embedding_service.embed_document(request.text)

    return {
        "embedding": embedding,
        "model": "Qwen/Qwen3-Embedding-0.6B",
        "modelVersion": "97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3",
        "dimension": len(embedding),
        "version": "qwen3-embedding-0.6b-v1",
    }


@app.post("/embed-batch")
def embed_batch(request: BatchEmbeddingRequest):
    if not request.texts:
        raise HTTPException(
            status_code=400,
            detail="texts must contain at least one item",
        )

    embeddings = embedding_service.embed_batch(request.texts)

    return {
        "embeddings": embeddings,
        "model": "Qwen/Qwen3-Embedding-0.6B",
        "modelVersion": "97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3",
        "dimension": len(embeddings[0]),
        "version": "qwen3-embedding-0.6b-v1",
    }