"""One-off measurement for #136: compares cl100k_base token counts (used by the
TypeScript chunker) against Qwen3-Embedding-0.6B's real tokenizer on sample
journal text, to derive a safety margin for document-chunker.ts.

Run manually (not part of CI/tests):
    python src/embeddings/measure_tokenizer_divergence.py
"""

import json
from pathlib import Path

import tiktoken
from transformers import AutoTokenizer

from embedding_service import MODEL_NAME

REVISION = "97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3"
DATASET_PATH = (
    Path(__file__).resolve().parents[2] / "evaluation" / "embeddings" / "dataset.json"
)


def load_sample_texts() -> list[str]:
    with open(DATASET_PATH, "r", encoding="utf-8") as file:
        dataset = json.load(file)

    documents = [document["content"] for document in dataset["documents"]]

    # Also test longer, concatenated text so the sample spans the same
    # length range as real chunks (up to DEFAULT_MAX_TOKENS ~ 300 tokens),
    # not just the short single-sentence dataset entries.
    concatenated = "\n\n".join(documents)
    windows = [
        concatenated[start : start + 1200]
        for start in range(0, len(concatenated), 600)
    ]

    return documents + windows


def main() -> None:
    cl100k = tiktoken.get_encoding("cl100k_base")
    qwen_tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, revision=REVISION)

    worst_ratio = 0.0
    worst_text = ""

    for text in load_sample_texts():
        cl100k_count = len(cl100k.encode(text))
        # add_special_tokens=True to match SentenceTransformer.encode()'s
        # production default (Qwen's tokenizer appends <|endoftext|>).
        qwen_count = len(qwen_tokenizer.encode(text, add_special_tokens=True))

        if cl100k_count == 0:
            continue

        ratio = qwen_count / cl100k_count

        print(f"cl100k={cl100k_count:>4}  qwen={qwen_count:>4}  ratio={ratio:.3f}")

        if ratio > worst_ratio:
            worst_ratio = ratio
            worst_text = text

    print()
    print(f"Worst-case ratio (qwen/cl100k): {worst_ratio:.3f}")
    print(f"Worst text sample: {worst_text[:80]!r}")


if __name__ == "__main__":
    main()
