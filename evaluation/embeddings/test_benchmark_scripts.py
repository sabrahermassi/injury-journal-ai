"""Tests for the embedding benchmark scripts (test_qwen.py, test_bge.py,
test_nomic.py, benchmark.py).

These scripts are standalone evaluation scripts (top-level code, no
functions) that load a real embedding model from the network. To keep these
tests fast, deterministic, and free of any ML/network dependency, we inject
a fake `sentence_transformers` module (including a minimal fake of the
`util.cos_sim` API) into `sys.modules` before executing each script with
`runpy`.

The fake encoder maps each text to a deterministic pseudo-random vector
(derived from an MD5 hash of the text), so scores are meaningless in terms
of semantic quality but are fully reproducible. This lets us assert on:

- the script executing end-to-end against the real dataset.json without
  raising an exception,
- the correct upstream model name being requested,
- the printed report having the expected shape, and
- a mathematical invariant of the recall computation itself
  (Recall@1 <= Recall@3 <= Recall@5), which must hold regardless of how
  good/bad the underlying embeddings are, since the top-1 results are
  always a subset of the top-3 results, which are always a subset of the
  top-5 results.
"""

import hashlib
import runpy
import sys
import types
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).parent

VECTOR_DIM = 8


def _text_to_vector(text):
    """Deterministically map `text` to a unit vector of floats."""

    digest = hashlib.md5(text.encode("utf-8")).digest()
    raw = [digest[i % len(digest)] / 255.0 for i in range(VECTOR_DIM)]
    norm = sum(value * value for value in raw) ** 0.5 or 1.0

    return [value / norm for value in raw]


def _cosine_similarity(vector_a, vector_b):
    dot = sum(x * y for x, y in zip(vector_a, vector_b))
    norm_a = sum(x * x for x in vector_a) ** 0.5
    norm_b = sum(y * y for y in vector_b) ** 0.5

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return dot / (norm_a * norm_b)


class FakeArray:
    """Stand-in for the numpy array returned by SentenceTransformer.encode()."""

    def __init__(self, data):
        self.data = data

    def tolist(self):
        return self.data


class FakeScalar:
    """Stand-in for a single-element tensor supporting `.item()`."""

    def __init__(self, value):
        self._value = value

    def item(self):
        return self._value


class FakeSimilarityRow:
    """1D row of similarity scores supporting `argsort(descending=True)` and
    integer indexing with `.item()` — the subset of the torch Tensor API
    used by the benchmark scripts."""

    def __init__(self, values):
        self._values = values

    def __getitem__(self, index):
        return FakeScalar(self._values[index])

    def argsort(self, descending=False):
        return sorted(
            range(len(self._values)),
            key=lambda i: self._values[i],
            reverse=descending,
        )


class FakeCosSimResult:
    def __init__(self, rows):
        self._rows = rows

    def __getitem__(self, index):
        return self._rows[index]


def _fake_cos_sim(a, b):
    a_data = a.data if isinstance(a, FakeArray) else a
    b_data = b.data if isinstance(b, FakeArray) else b

    # A single query embedding is a flat vector; batch it like
    # sentence-transformers/torch would.
    if a_data and isinstance(a_data[0], (int, float)):
        a_vectors = [a_data]
    else:
        a_vectors = a_data

    rows = [
        FakeSimilarityRow([_cosine_similarity(vector, doc) for doc in b_data])
        for vector in a_vectors
    ]

    return FakeCosSimResult(rows)


class FakeSentenceTransformer:
    """Fake replacement for sentence_transformers.SentenceTransformer."""

    last_model_name = None

    def __init__(self, model_name):
        FakeSentenceTransformer.last_model_name = model_name
        self.model_name = model_name

    def encode(self, texts, normalize_embeddings=True):
        if isinstance(texts, str):
            return FakeArray(_text_to_vector(texts))

        return FakeArray([_text_to_vector(text) for text in texts])


@pytest.fixture
def run_benchmark_script(monkeypatch):
    def _run(script_path):
        FakeSentenceTransformer.last_model_name = None

        fake_module = types.ModuleType("sentence_transformers")
        fake_module.SentenceTransformer = FakeSentenceTransformer
        fake_module.util = types.SimpleNamespace(cos_sim=_fake_cos_sim)

        monkeypatch.setitem(sys.modules, "sentence_transformers", fake_module)

        return runpy.run_path(str(script_path), run_name="__main__")

    return _run


def _parse_recall_lines(output):
    recall_values = {}

    for line in output.splitlines():
        for k in (1, 3, 5):
            prefix = f"Recall@{k}: "
            if line.startswith(prefix):
                recall_values[k] = float(line[len(prefix) :].rstrip("%"))

    return recall_values


@pytest.mark.parametrize(
    "script_name,expected_model_name",
    [
        ("test_qwen.py", "Qwen/Qwen3-Embedding-0.6B"),
        ("test_bge.py", "BAAI/bge-m3"),
        ("test_nomic.py", "nomic-ai/nomic-embed-text-v1.5"),
    ],
)
def test_benchmark_script_loads_expected_model(
    run_benchmark_script, script_name, expected_model_name
):
    run_benchmark_script(SCRIPTS_DIR / script_name)

    assert FakeSentenceTransformer.last_model_name == expected_model_name


@pytest.mark.parametrize(
    "script_name", ["test_qwen.py", "test_bge.py", "test_nomic.py"]
)
def test_benchmark_script_prints_results_section(
    run_benchmark_script, capsys, script_name
):
    run_benchmark_script(SCRIPTS_DIR / script_name)

    captured = capsys.readouterr()

    assert "Benchmark Results" in captured.out
    assert "Recall@1:" in captured.out
    assert "Recall@3:" in captured.out
    assert "Recall@5:" in captured.out


@pytest.mark.parametrize(
    "script_name", ["test_qwen.py", "test_bge.py", "test_nomic.py"]
)
def test_benchmark_script_recall_is_monotonically_non_decreasing(
    run_benchmark_script, capsys, script_name
):
    run_benchmark_script(SCRIPTS_DIR / script_name)

    captured = capsys.readouterr()
    recall_values = _parse_recall_lines(captured.out)

    assert set(recall_values) == {1, 3, 5}

    for value in recall_values.values():
        assert 0.0 <= value <= 100.0

    assert recall_values[1] <= recall_values[3] <= recall_values[5]


@pytest.mark.parametrize(
    "script_name", ["test_qwen.py", "test_bge.py", "test_nomic.py"]
)
def test_benchmark_script_prints_a_line_per_query(
    run_benchmark_script, capsys, script_name
):
    import json

    with open(SCRIPTS_DIR / "dataset.json", "r", encoding="utf-8") as file:
        dataset = json.load(file)

    run_benchmark_script(SCRIPTS_DIR / script_name)

    captured = capsys.readouterr()

    for query in dataset["queries"]:
        assert query["question"] in captured.out


def test_benchmark_placeholder_file_is_currently_empty():
    benchmark_path = SCRIPTS_DIR / "benchmark.py"

    assert benchmark_path.exists()
    assert benchmark_path.read_text(encoding="utf-8") == ""


def test_benchmark_placeholder_file_executes_without_error(run_benchmark_script):
    # benchmark.py is currently an empty placeholder for a future shared
    # benchmark runner. This guards against it silently gaining content that
    # breaks on import/execution without a corresponding test being added.
    run_benchmark_script(SCRIPTS_DIR / "benchmark.py")