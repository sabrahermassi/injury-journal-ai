import os
import secrets

from fastapi import Depends, FastAPI, Header
from fastapi import HTTPException
from pydantic import BaseModel, Field

from .embedding_service import EmbeddingService


def verify_api_key(authorization: str | None = Header(default=None)) -> None:
    expected_key = os.environ.get("EMBEDDING_API_KEY")

    if not expected_key:
        raise HTTPException(
            status_code=500,
            detail="EMBEDDING_API_KEY is not configured",
        )

    scheme, _, token = (authorization or "").partition(" ")

    if scheme != "Bearer" or not token or not secrets.compare_digest(token, expected_key):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


app = FastAPI(
    dependencies=[Depends(verify_api_key)],
    openapi_url=None,
    docs_url=None,
    redoc_url=None,
)

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
    """
    Embed a search query using query-optimized encoding.

    Uses the embedding model's query-specific transformation for retrieval tasks,
    which may differ from document encoding to optimize query-document similarity.

    Args:
        request: EmbeddingRequest containing the query text (max 10,000 chars)

    Returns:
        dict: Response containing the embedding vector, model metadata, and dimensions
    """
    embedding = embedding_service.embed_query(request.text)

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