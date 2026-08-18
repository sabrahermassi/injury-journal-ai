"""Unit tests for EmbeddingService (embedding_service.py).

These tests replace the `sentence_transformers` dependency with a fake,
in-memory implementation so they run quickly and deterministically without
downloading a real embedding model or requiring network/GPU access.

`test_embedding_service.py` in this same directory is a manual smoke-test
script (it prints output rather than asserting); this file provides
automated, assertion-based coverage of `EmbeddingService`.
"""

import importlib
import sys
import types
from pathlib import Path

import pytest

# `embedding_service.py` lives next to this test file and is imported as a
# top-level module (matching how `test_embedding_service.py` already does
# `from embedding_service import EmbeddingService`). Ensure this directory is
# importable regardless of the working directory pytest is invoked from.
sys.path.insert(0, str(Path(__file__).parent))


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

    def __init__(self, model_name):
        self.model_name = model_name
        self.encode_calls = []

    def encode(self, texts, normalize_embeddings=True):
        self.encode_calls.append(
            {"texts": texts, "normalize_embeddings": normalize_embeddings}
        )

        if isinstance(texts, str):
            return FakeEncodedVector([0.1, 0.2, 0.3])

        return FakeEncodedVector([[0.1, 0.2, 0.3] for _ in texts])


@pytest.fixture
def embedding_service_module(monkeypatch):
    """Import embedding_service with a fake sentence_transformers backend."""

    fake_module = types.ModuleType("sentence_transformers")
    fake_module.SentenceTransformer = FakeSentenceTransformer
    monkeypatch.setitem(sys.modules, "sentence_transformers", fake_module)

    # Force a fresh import so the module binds `SentenceTransformer` to the
    # fake class rather than any previously cached real implementation.
    sys.modules.pop("embedding_service", None)
    module = importlib.import_module("embedding_service")

    yield module

    sys.modules.pop("embedding_service", None)


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

        assert service.model.model_name == "Qwen/Qwen3-Embedding-0.6B"

    def test_each_instance_gets_its_own_model(self, embedding_service_module):
        service_a = embedding_service_module.EmbeddingService()
        service_b = embedding_service_module.EmbeddingService()

        assert service_a.model is not service_b.model


class TestEmbed:
    def test_returns_a_list_of_floats(self, service):
        result = service.embed("hello world")

        assert result == [0.1, 0.2, 0.3]
        assert isinstance(result, list)

    def test_calls_model_encode_with_normalize_embeddings_true(self, service):
        service.embed("hello world")

        call = service.model.encode_calls[0]
        assert call["texts"] == "hello world"
        assert call["normalize_embeddings"] is True

    def test_supports_empty_string_input(self, service):
        result = service.embed("")

        assert result == [0.1, 0.2, 0.3]
        assert service.model.encode_calls[0]["texts"] == ""

    def test_calls_encode_exactly_once(self, service):
        service.embed("some text")

        assert len(service.model.encode_calls) == 1


class TestEmbedBatch:
    def test_returns_a_list_of_vectors(self, service):
        texts = ["a", "b", "c"]

        result = service.embed_batch(texts)

        assert result == [[0.1, 0.2, 0.3], [0.1, 0.2, 0.3], [0.1, 0.2, 0.3]]
        assert len(result) == len(texts)

    def test_empty_batch_returns_empty_list(self, service):
        result = service.embed_batch([])

        assert result == []

    def test_single_item_batch(self, service):
        result = service.embed_batch(["only one"])

        assert result == [[0.1, 0.2, 0.3]]

    def test_calls_model_encode_with_normalize_embeddings_true(self, service):
        texts = ["a", "b"]

        service.embed_batch(texts)

        call = service.model.encode_calls[0]
        assert call["texts"] == texts
        assert call["normalize_embeddings"] is True

    def test_preserves_order_of_input_texts(self, service):
        class OrderTrackingTransformer(FakeSentenceTransformer):
            def encode(self, texts, normalize_embeddings=True):
                return FakeEncodedVector([[float(i)] for i in range(len(texts))])

        service.model = OrderTrackingTransformer("fake-model")

        result = service.embed_batch(["x", "y", "z"])

        assert result == [[0.0], [1.0], [2.0]]