from fastapi import FastAPI
from fastapi import HTTPException
from pydantic import BaseModel, Field

from .embedding_service import EmbeddingService


app = FastAPI()

embedding_service = EmbeddingService()


class EmbeddingRequest(BaseModel):
    text: str = Field(max_length=10_000)


class BatchEmbeddingRequest(BaseModel):
    texts: list[str] = Field(max_length=32)


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


@app.post("/embed-query")
def embed_query(request: EmbeddingRequest):
    embedding = embedding_service.embed_query(request.text)

    return {
        "embedding": embedding,
        "model": "Qwen/Qwen3-Embedding-0.6B",
        "modelVersion": "97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3",
        "dimension": len(embedding),
        "version": "qwen3-embedding-0.6b-v1",
    }

def test_rejects_text_over_max_length(self, client, fake_service):
    response = client.post(
        "/embed",
        json={"text": "x" * 10_001},
    )

    assert response.status_code == 422
    assert fake_service.embed_document_calls == []

def test_accepts_maximum_text_length(self, client, fake_service):
    response = client.post(
        "/embed",
        json={"text": "x" * 10_000},
    )

    assert response.status_code == 200


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

def test_rejects_batch_over_max_size(self, client, fake_service):
    response = client.post(
        "/embed-batch",
        json={"texts": ["x"] * 33},
    )

    assert response.status_code == 422
    assert fake_service.embed_batch_calls == []

def test_accepts_maximum_batch_size(self, client, fake_service):
    response = client.post(
        "/embed-batch",
        json={"texts": ["x"] * 32},
    )

    assert response.status_code == 200