import type { JournalDocument } from '../documents/document-types.js';

const DEFAULT_MAX_TOKENS = 300;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function splitIntoSentences(text: string): string[] {
  return (
    text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((sentence) => sentence.trim()) ??
    []
  );
}

function addChunk(
  chunks: JournalDocument[],
  document: JournalDocument,
  content: string,
): void {
  if (!content.trim()) {
    return;
  }

  chunks.push({
    ...document,
    content: content.trim(),
  });
}

export function chunkDocument(
  document: JournalDocument,
  maxTokens: number = DEFAULT_MAX_TOKENS,
): JournalDocument[] {
  // Keep small journal records intact.
  if (estimateTokens(document.content) <= maxTokens) {
    return [document];
  }

  const paragraphs = splitIntoParagraphs(document.content);

  const chunks: JournalDocument[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const paragraphCandidate = currentChunk
      ? `${currentChunk}\n\n${paragraph}`
      : paragraph;

    // The paragraph fits in the current chunk.
    if (estimateTokens(paragraphCandidate) <= maxTokens) {
      currentChunk = paragraphCandidate;
      continue;
    }

    // Save the current chunk before processing the large paragraph.
    if (currentChunk) {
      addChunk(chunks, document, currentChunk);
      currentChunk = '';
    }

    // The paragraph itself fits in one chunk.
    if (estimateTokens(paragraph) <= maxTokens) {
      currentChunk = paragraph;
      continue;
    }

    // The paragraph is too large, so split it into sentences.
    const sentences = splitIntoSentences(paragraph);

    for (const sentence of sentences) {
      const sentenceCandidate = currentChunk
        ? `${currentChunk} ${sentence}`
        : sentence;

      if (estimateTokens(sentenceCandidate) <= maxTokens) {
        currentChunk = sentenceCandidate;
      } else {
        if (currentChunk) {
          addChunk(chunks, document, currentChunk);
        }

        currentChunk = sentence;
      }
    }
  }

  // Save the final chunk.
  if (currentChunk) {
    addChunk(chunks, document, currentChunk);
  }

  return chunks;
}

export function chunkDocuments(
  documents: JournalDocument[],
  maxTokens: number = DEFAULT_MAX_TOKENS,
): JournalDocument[] {
  return documents.flatMap((document) => chunkDocument(document, maxTokens));
}
