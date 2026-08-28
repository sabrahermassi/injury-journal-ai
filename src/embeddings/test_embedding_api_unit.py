"""Unit tests for the embedding HTTP API (embedding_api.py).

`embedding_api.py` instantiates a real `EmbeddingService` (and therefore a
real `sentence_transformers.SentenceTransformer`) at import time. To keep
these tests fast and independent of the ML stack, we patch
`sentence_transformers` with a lightweight fake before importing the module,
then replace the module-level `embedding_service` object with a fully
controllable fake for each test so we can assert on the HTTP request/response
behavior in isolation.
"""

import importlib
import sys
import types
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

SRC_DIR = Path(__file__).resolve().parent.parent

TEST_API_KEY = "test-embedding-key"


class FakeEncodedVector:
    """Stand-in for the numpy array normally returned by
    SentenceTransformer.encode()."""

    def __init__(self, data):
        self._data = data

    def tolist(self):
        return self._data


class FakeSentenceTransformer:
    """Fake replacement for sentence_transformers.SentenceTransformer, used
    only so that importing embedding_service/embedding_api succeeds without
    downloading a real model."""

    def __init__(self, model_name, revision=None):
        self.model_name = model_name
        self.revision = revision

    def encode(self, texts, prompt_name=None, normalize_embeddings=True):
        if isinstance(texts, str):
            return FakeEncodedVector([0.0])

        return FakeEncodedVector([[0.0] for _ in texts])


class FakeEmbeddingService:
    """Fully controllable double for EmbeddingService, used to test the
    FastAPI request/response handling without any ML dependencies."""

    def __init__(self):
        self.embed_document_calls = []
        self.embed_query_calls = []
        self.embed_batch_calls = []
        self.document_result = [0.1, 0.2, 0.3]
        self.query_result = [0.1, 0.2, 0.3]
        self.batch_result = None

    def embed_document(self, text):
        self.embed_document_calls.append(text)
        return self.document_result

    def embed_query(self, text):
        self.embed_query_calls.append(text)
        return self.query_result

    def embed_batch(self, texts):
        self.embed_batch_calls.append(texts)

        if self.batch_result is not None:
            return self.batch_result

        return [[0.1, 0.2, 0.3] for _ in texts]


@pytest.fixture
def api_module(monkeypatch):
    """Import embedding_api with a fake sentence_transformers backend."""

    monkeypatch.syspath_prepend(str(SRC_DIR))

    fake_st_module = types.ModuleType("sentence_transformers")
    fake_st_module.SentenceTransformer = FakeSentenceTransformer
    monkeypatch.setitem(sys.modules, "sentence_transformers", fake_st_module)

    for name in ("embeddings.embedding_api", "embeddings.embedding_service"):
        monkeypatch.delitem(sys.modules, name, raising=False)

    monkeypatch.setenv("EMBEDDING_API_KEY", TEST_API_KEY)

    module = importlib.import_module("embeddings.embedding_api")

    yield module

    for name in ("embeddings.embedding_api", "embeddings.embedding_service"):
        sys.modules.pop(name, None)


@pytest.fixture
def fake_service(api_module, monkeypatch):
    service = FakeEmbeddingService()
    monkeypatch.setattr(api_module, "embedding_service", service)
    return service


@pytest.fixture
def client(api_module, fake_service):
    return TestClient(
        api_module.app, headers={"Authorization": f"Bearer {TEST_API_KEY}"}
    )


class TestEmbedEndpoint:
    def test_returns_200_with_expected_payload_shape(self, client, fake_service):
        fake_service.document_result = [0.1, 0.2, 0.3, 0.4]

        response = client.post("/embed", json={"text": "hello world"})

        assert response.status_code == 200

        body = response.json()
        assert body["embedding"] == [0.1, 0.2, 0.3, 0.4]
        assert body["model"] == "Qwen/Qwen3-Embedding-0.6B"
        assert body["modelVersion"] == "97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3"
        assert body["dimension"] == 4
        assert body["version"] == "qwen3-embedding-0.6b-v1"

    def test_calls_embed_document_with_request_text(self, client, fake_service):
        client.post("/embed", json={"text": "some journal entry"})

        assert fake_service.embed_document_calls == ["some journal entry"]

    def test_dimension_matches_embedding_length(self, client, fake_service):
        fake_service.document_result = [0.1] * 7

        response = client.post("/embed", json={"text": "x"})

        assert response.json()["dimension"] == 7

    def test_supports_empty_string_text(self, client, fake_service):
        response = client.post("/embed", json={"text": ""})

        assert response.status_code == 200
        assert fake_service.embed_document_calls == [""]

    def test_supports_unicode_text(self, client, fake_service):
        response = client.post("/embed", json={"text": "Le patient a mal au dos"})

        assert response.status_code == 200
        assert fake_service.embed_document_calls == ["Le patient a mal au dos"]

    def test_missing_text_field_returns_422(self, client):
        response = client.post("/embed", json={})

        assert response.status_code == 422

    def test_extra_unexpected_fields_are_ignored(self, client, fake_service):
        response = client.post(
            "/embed", json={"text": "hello", "unexpected": "field"}
        )

        assert response.status_code == 200
        assert fake_service.embed_document_calls == ["hello"]

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


class TestEmbedQueryEndpoint:
    def test_returns_200_with_expected_payload_shape(self, client, fake_service):
        fake_service.query_result = [0.1, 0.2, 0.3, 0.4]

        response = client.post("/embed-query", json={"text": "hello world"})

        assert response.status_code == 200

        body = response.json()
        assert body["embedding"] == [0.1, 0.2, 0.3, 0.4]
        assert body["model"] == "Qwen/Qwen3-Embedding-0.6B"
        assert body["modelVersion"] == "97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3"
        assert body["dimension"] == 4
        assert body["version"] == "qwen3-embedding-0.6b-v1"

    def test_calls_embed_query_with_request_text(self, client, fake_service):
        client.post("/embed-query", json={"text": "what treatments have I tried?"})

        assert fake_service.embed_query_calls == ["what treatments have I tried?"]
        assert fake_service.embed_document_calls == []

    def test_missing_text_field_returns_422(self, client):
        response = client.post("/embed-query", json={})

        assert response.status_code == 422


class TestEmbedBatchEndpoint:
    def test_returns_200_with_expected_payload_shape(self, client, fake_service):
        response = client.post("/embed-batch", json={"texts": ["a", "b"]})

        assert response.status_code == 200

        body = response.json()
        assert body["embeddings"] == [[0.1, 0.2, 0.3], [0.1, 0.2, 0.3]]
        assert body["model"] == "Qwen/Qwen3-Embedding-0.6B"
        assert body["modelVersion"] == "97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3"
        assert body["dimension"] == 3
        assert body["version"] == "qwen3-embedding-0.6b-v1"

    def test_calls_embed_batch_with_request_texts(self, client, fake_service):
        client.post("/embed-batch", json={"texts": ["one", "two", "three"]})

        assert fake_service.embed_batch_calls == [["one", "two", "three"]]

    def test_dimension_reflects_first_embedding_length(self, client, fake_service):
        fake_service.batch_result = [[1.0, 2.0], [3.0, 4.0]]

        response = client.post("/embed-batch", json={"texts": ["a", "b"]})

        assert response.json()["dimension"] == 2

    def test_empty_texts_list_returns_400(self, client, fake_service):
        response = client.post("/embed-batch", json={"texts": []})

        assert response.status_code == 400
        assert response.json()["detail"] == "texts must contain at least one item"
        assert fake_service.embed_batch_calls == []

    def test_missing_texts_field_returns_422(self, client):
        response = client.post("/embed-batch", json={})

        assert response.status_code == 422

    def test_single_text_batch(self, client, fake_service):
        response = client.post("/embed-batch", json={"texts": ["only one"]})

        assert response.status_code == 200
        assert response.json()["embeddings"] == [[0.1, 0.2, 0.3]]

    def test_preserves_order_of_input_texts(self, client, fake_service):
        fake_service.batch_result = [[1.0], [2.0], [3.0]]

        response = client.post("/embed-batch", json={"texts": ["x", "y", "z"]})

        assert response.json()["embeddings"] == [[1.0], [2.0], [3.0]]
        assert fake_service.embed_batch_calls == [["x", "y", "z"]]

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


ENDPOINTS = [
    ("/embed", {"text": "hello"}),
    ("/embed-query", {"text": "hello"}),
    ("/embed-batch", {"texts": ["hello"]}),
]


class TestAuthentication:
    @pytest.mark.parametrize("path,payload", ENDPOINTS)
    def test_rejects_request_with_no_authorization_header(
        self, api_module, fake_service, path, payload
    ):
        unauthenticated_client = TestClient(api_module.app)

        response = unauthenticated_client.post(path, json=payload)

        assert response.status_code == 401
        assert fake_service.embed_document_calls == []
        assert fake_service.embed_query_calls == []
        assert fake_service.embed_batch_calls == []

    @pytest.mark.parametrize("path,payload", ENDPOINTS)
    def test_rejects_request_with_wrong_key(
        self, api_module, fake_service, path, payload
    ):
        unauthenticated_client = TestClient(
            api_module.app, headers={"Authorization": "Bearer wrong-key"}
        )

        response = unauthenticated_client.post(path, json=payload)

        assert response.status_code == 401
        assert fake_service.embed_document_calls == []
        assert fake_service.embed_query_calls == []
        assert fake_service.embed_batch_calls == []

    @pytest.mark.parametrize("path,payload", ENDPOINTS)
    def test_rejects_request_with_non_bearer_scheme(
        self, api_module, fake_service, path, payload
    ):
        unauthenticated_client = TestClient(
            api_module.app, headers={"Authorization": TEST_API_KEY}
        )

        response = unauthenticated_client.post(path, json=payload)

        assert response.status_code == 401
        assert fake_service.embed_document_calls == []
        assert fake_service.embed_query_calls == []
        assert fake_service.embed_batch_calls == []

    @pytest.mark.parametrize("path,payload", ENDPOINTS)
    def test_fails_closed_when_api_key_is_not_configured(
        self, api_module, fake_service, monkeypatch, path, payload
    ):
        monkeypatch.delenv("EMBEDDING_API_KEY", raising=False)

        unconfigured_client = TestClient(
            api_module.app, headers={"Authorization": f"Bearer {TEST_API_KEY}"}
        )

        response = unconfigured_client.post(path, json=payload)

        assert response.status_code == 500
        assert fake_service.embed_document_calls == []
        assert fake_service.embed_query_calls == []
        assert fake_service.embed_batch_calls == []


class TestDocsDisabled:
    def test_openapi_json_is_disabled(self, client):
        response = client.get("/openapi.json")

        assert response.status_code == 404

    def test_docs_ui_is_disabled(self, client):
        response = client.get("/docs")

        assert response.status_code == 404

    def test_redoc_ui_is_disabled(self, client):
        response = client.get("/redoc")

        assert response.status_code == 404