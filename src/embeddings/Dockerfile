# Build context is the repository root (see docker-compose.yml), so paths
# below are relative to the repo root -- mirroring how the service is run
# outside Docker (README.md, "Run the embedding service").
FROM python:3.12-slim

WORKDIR /app

COPY src/embeddings/requirements.txt src/embeddings/requirements.txt

# Install CPU-only torch first: this service only runs CPU inference, and
# plain `pip install torch` on Linux otherwise pulls the CUDA-enabled build
# (several GB of bundled NVIDIA libraries). Installing the CPU wheel first
# satisfies sentence-transformers' `torch>=2.2` requirement below without
# pip replacing it with the GPU build.
RUN pip install --no-cache-dir --timeout 120 torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir --timeout 120 -r src/embeddings/requirements.txt

COPY src/embeddings/embedding_api.py src/embeddings/embedding_api.py
COPY src/embeddings/embedding_service.py src/embeddings/embedding_service.py
COPY src/embeddings/docker-healthcheck.py src/embeddings/docker-healthcheck.py

EXPOSE 8000

# The service has no unauthenticated /health route -- every route requires
# Authorization: Bearer <EMBEDDING_API_KEY>. This healthcheck authenticates
# the same way a real client would; see docker-healthcheck.py.
#
# Generous timings: start-period covers the first-run model download (can take
# several minutes on a slow connection, since requests to the HF Hub are
# unauthenticated and rate-limited); the per-check timeout matches
# EMBEDDING_API_TIMEOUT_MS's default (30s), since CPU inference on a
# constrained/shared machine can be this slow even once the model is loaded.
HEALTHCHECK --interval=30s --timeout=30s --start-period=15m --retries=5 \
  CMD ["python", "src/embeddings/docker-healthcheck.py"]

CMD ["uvicorn", "src.embeddings.embedding_api:app", "--host", "0.0.0.0", "--port", "8000"]
