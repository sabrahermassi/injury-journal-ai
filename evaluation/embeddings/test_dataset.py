"""Tests validating the structural integrity of the embedding benchmark
dataset (dataset.json) used by test_qwen.py, test_bge.py, and test_nomic.py.

These tests guard against data-entry mistakes (duplicate ids, dangling
references, missing fields) that would silently break recall calculations
in the benchmark scripts without raising an error.
"""

import json
from pathlib import Path

import pytest

DATASET_PATH = Path(__file__).parent / "dataset.json"


@pytest.fixture(scope="module")
def dataset():
    with open(DATASET_PATH, "r", encoding="utf-8") as file:
        return json.load(file)


def test_dataset_file_exists():
    assert DATASET_PATH.exists()


def test_dataset_file_is_valid_json():
    with open(DATASET_PATH, "r", encoding="utf-8") as file:
        json.load(file)  # should not raise


def test_dataset_has_expected_top_level_keys(dataset):
    assert "documents" in dataset
    assert "queries" in dataset


def test_documents_is_a_non_empty_list(dataset):
    assert isinstance(dataset["documents"], list)
    assert len(dataset["documents"]) > 0


def test_queries_is_a_non_empty_list(dataset):
    assert isinstance(dataset["queries"], list)
    assert len(dataset["queries"]) > 0


def test_every_document_has_required_fields(dataset):
    for document in dataset["documents"]:
        assert "id" in document
        assert "content" in document
        assert isinstance(document["id"], str) and document["id"].strip()
        assert isinstance(document["content"], str) and document["content"].strip()


def test_document_ids_are_unique(dataset):
    ids = [document["id"] for document in dataset["documents"]]

    assert len(ids) == len(set(ids))


def test_every_query_has_required_fields(dataset):
    for query in dataset["queries"]:
        assert "question" in query
        assert "expected_documents" in query
        assert isinstance(query["question"], str) and query["question"].strip()
        assert isinstance(query["expected_documents"], list)
        assert len(query["expected_documents"]) > 0


def test_expected_documents_reference_existing_document_ids(dataset):
    document_ids = {document["id"] for document in dataset["documents"]}

    for query in dataset["queries"]:
        for expected_id in query["expected_documents"]:
            assert expected_id in document_ids, (
                f"Query {query['question']!r} references unknown document "
                f"id {expected_id!r}"
            )


def test_expected_documents_within_a_query_are_unique(dataset):
    for query in dataset["queries"]:
        expected = query["expected_documents"]

        assert len(expected) == len(set(expected)), (
            f"Query {query['question']!r} has duplicate expected document ids"
        )


def test_questions_are_unique(dataset):
    questions = [query["question"] for query in dataset["queries"]]

    assert len(questions) == len(set(questions))


def test_readme_documented_query_matches_dataset(dataset):
    # Regression check for the specific example called out in
    # evaluation/embeddings/README.md ("What treatment only helped
    # temporarily?" -> treatment-3 and treatment-6).
    matching = [
        query
        for query in dataset["queries"]
        if query["question"] == "What treatment only helped temporarily?"
    ]

    assert len(matching) == 1
    assert set(matching[0]["expected_documents"]) == {"treatment-3", "treatment-6"}