"""Unit tests for EmbeddingService (embedding_service.py).

These tests replace the `sentence_transformers` dependency with a fake,
in-memory implementation so they run quickly and deterministically without
downloading a real embedding model or requiring network/GPU access.

`embedding_service_smoke_test_manual.py` in this same directory is a manual smoke-test
script (it prints output rather than asserting); this file provides
automated, assertion-based coverage of `EmbeddingService`.
"""

import importlib
import sys
import types
from pathlib import Path

import pytest


class FakeEncodedVector:
    """Stand-in for the numpy array normally returned by
    SentenceTransformer.encode()."""

    def __init__(self, data):
        self._data = data

    def tolist(self):
        return self._data


class FakeSentenceTransformer:
    """Fake replacement for sentence_transformers.SentenceTransformer.

    Records every `encode()` call so tests can assert on how
    EmbeddingService drives the underlying model.
    """
    def __init__(self, model_name, revision=None):
        self.model_name = model_name
        self.revision = revision
        self.encode_calls = []

    def encode(
        self,
        texts,
        prompt_name=None,
        normalize_embeddings=True,
    ):
        self.encode_calls.append(
            {
                "texts": texts,
                "prompt_name": prompt_name,
                "normalize_embeddings": normalize_embeddings,
            }
        )

        if isinstance(texts, str):
            return FakeEncodedVector([0.1] * 1024)

        return FakeEncodedVector(
            [[0.1] * 1024 for _ in texts]
        )


@pytest.fixture
def embedding_service_module(monkeypatch):
    """Import embedding_service with a fake sentence_transformers backend."""

    monkeypatch.syspath_prepend(str(Path(__file__).parent))
    previous_module = sys.modules.get("embedding_service")

    fake_module = types.ModuleType("sentence_transformers")
    fake_module.SentenceTransformer = FakeSentenceTransformer
    monkeypatch.setitem(sys.modules, "sentence_transformers", fake_module)

    monkeypatch.delitem(
        sys.modules,
        "embedding_service",
        raising=False,
    )

    module = importlib.import_module("embedding_service")

    yield module

    sys.modules.pop("embedding_service", None)

    if previous_module is not None:
        sys.modules["embedding_service"] = previous_module


@pytest.fixture
def service(embedding_service_module):
    return embedding_service_module.EmbeddingService()


class TestModuleConstants:
    def test_model_name_constant(self, embedding_service_module):
        assert embedding_service_module.MODEL_NAME == "Qwen/Qwen3-Embedding-0.6B"

    def test_vector_dimension_constant(self, embedding_service_module):
        assert embedding_service_module.VECTOR_DIMENSION == 1024

    def test_embedding_version_constant(self, embedding_service_module):
        assert (
            embedding_service_module.EMBEDDING_VERSION == "qwen3-embedding-0.6b-v1"
        )


class TestEmbeddingServiceInit:
    def test_loads_model_with_expected_name(self, embedding_service_module):
        service = embedding_service_module.EmbeddingService()

        assert service.model.model_name == embedding_service_module.MODEL_NAME
        assert (
            service.model.revision
            == "97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3"
        )

    def test_each_instance_gets_its_own_model(self, embedding_service_module):
        service_a = embedding_service_module.EmbeddingService()
        service_b = embedding_service_module.EmbeddingService()

        assert service_a.model is not service_b.model


class TestEmbedDocument:
    # prompt_name=None
    def test_returns_a_list_of_floats(self, service):
        result = service.embed_document("hello world")

        assert isinstance(result, list)

    def test_returns_embedding_with_expected_dimension(
        self,
        service,
        embedding_service_module,
    ):
        result = service.embed_document("hello world")

        assert len(result) == embedding_service_module.VECTOR_DIMENSION

    def test_calls_model_encode_with_normalize_embeddings_true(self, service):
        service.embed_document("hello world")

        call = service.model.encode_calls[0]
        assert call["texts"] == "hello world"
        assert call["normalize_embeddings"] is True

    def test_embed_document_does_not_use_query_prompt(self, service):
        service.embed_document("Physiotherapy did not improve symptoms.")

        call = service.model.encode_calls[0]

        assert call["texts"] == "Physiotherapy did not improve symptoms."
        assert call["prompt_name"] is None
        assert call["normalize_embeddings"] is True

    def test_supports_empty_string_input(self, service, embedding_service_module):
        result = service.embed_document("")

        assert len(result) == embedding_service_module.VECTOR_DIMENSION
        assert service.model.encode_calls[0]["texts"] == ""

    def test_calls_encode_exactly_once(self, service):
        service.embed_document("some text")

        assert len(service.model.encode_calls) == 1


class TestEmbedQuery:
    # prompt_name="query"
    def test_returns_a_list_of_floats(self, service):
        result = service.embed_query("What makes my pain worse?")

        assert result == [0.1] * 1024
        assert isinstance(result, list)
        assert all(isinstance(value, float) for value in result)

    def test_returns_embedding_with_expected_dimension(
        self,
        service,
        embedding_service_module,
    ):
        result = service.embed_query("What makes my pain worse?")

        assert len(result) == embedding_service_module.VECTOR_DIMENSION

    def test_embed_query_uses_query_prompt(self, service):
        service.embed_query("What makes my pain worse?")

        call = service.model.encode_calls[0]

        assert call["texts"] == "What makes my pain worse?"
        assert call["prompt_name"] == "query"
        assert call["normalize_embeddings"] is True

    def test_calls_encode_exactly_once(self, service):
        service.embed_query("What makes my pain worse?")

        assert len(service.model.encode_calls) == 1


class TestEmbedBatch:
    def test_returns_a_list_of_vectors(self, service):
        texts = ["a", "b", "c"]

        result = service.embed_batch(texts)

        assert isinstance(result, list)
        assert all(isinstance(embedding, list) for embedding in result)
        assert len(result) == len(texts)

    def test_returns_embeddings_with_expected_dimension(
        self,
        service,
        embedding_service_module,
    ):
        result = service.embed_batch(["a", "b", "c"])

        assert all(
            len(embedding) == embedding_service_module.VECTOR_DIMENSION
            for embedding in result
        )

    def test_embed_batch_does_not_use_query_prompt(self, service):
        texts = ["document one", "document two"]

        service.embed_batch(texts)

        call = service.model.encode_calls[0]

        assert call["texts"] == texts
        assert call["prompt_name"] is None
        assert call["normalize_embeddings"] is True

    def test_empty_batch_returns_empty_list(self, service):
        result = service.embed_batch([])

        assert result == []

    def test_single_item_batch(self, service):
        result = service.embed_batch(["only one"])

        assert len(result) == 1
        assert len(result[0]) == 1024

    def test_calls_model_encode_with_normalize_embeddings_true(self, service):
        texts = ["a", "b"]

        service.embed_batch(texts)

        call = service.model.encode_calls[0]
        assert call["texts"] == texts
        assert call["normalize_embeddings"] is True

    def test_preserves_order_of_input_texts(self, service):
        class OrderTrackingTransformer(FakeSentenceTransformer):
            def encode(self, texts, normalize_embeddings=True):
                vectors = {"x": [0.0], "y": [1.0], "z": [2.0]}
                return FakeEncodedVector([vectors[text] for text in texts])

        service.model = OrderTrackingTransformer("fake-model")

        result = service.embed_batch(["z", "x", "y"])

        assert result == [[2.0], [0.0], [1.0]]