import { getEncoding } from 'js-tiktoken';
import type { JournalDocument } from '../documents/document-types.js';

const DEFAULT_MAX_TOKENS = 300;

const encoding = getEncoding('cl100k_base');

export function countTokens(text: string): number {
  return encoding.encode(text).length;
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

// Splits on Unicode code-point boundaries and measures each candidate with
// countTokens, rather than slicing raw BPE token ids: cl100k_base tokens are
// byte sequences, not character-aligned, so decoding an arbitrary token slice
// can land mid-character and silently emit replacement characters.
function splitOversizedWord(word: string, maxTokens: number): string[] {
  const chars = Array.from(word);
  const pieces: string[] = [];
  let start = 0;

  while (start < chars.length) {
    let lo = start + 1;
    let hi = chars.length;

    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (countTokens(chars.slice(start, mid).join('')) <= maxTokens) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }

    pieces.push(chars.slice(start, lo).join(''));
    start = lo;
  }

  return pieces;
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
  if (countTokens(document.content) <= maxTokens) {
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
    if (countTokens(paragraphCandidate) <= maxTokens) {
      currentChunk = paragraphCandidate;
      continue;
    }

    // Save the current chunk before processing the large paragraph.
    if (currentChunk) {
      addChunk(chunks, document, currentChunk);
      currentChunk = '';
    }

    // The paragraph itself fits in one chunk.
    if (countTokens(paragraph) <= maxTokens) {
      currentChunk = paragraph;
      continue;
    }

    // The paragraph is too large, so split it into sentences.
    const sentences = splitIntoSentences(paragraph);

    for (const sentence of sentences) {
      const sentenceCandidate = currentChunk
        ? `${currentChunk} ${sentence}`
        : sentence;

      if (countTokens(sentenceCandidate) <= maxTokens) {
        currentChunk = sentenceCandidate;
        continue;
      }

      // Sentence candidate doesn't fit.
      if (currentChunk) {
        addChunk(chunks, document, currentChunk);
        currentChunk = '';
      }

      // Now we're starting with the sentence alone.
      if (countTokens(sentence) <= maxTokens) {
        currentChunk = sentence;
        continue;
      }

      // The sentence itself is too large.
      const words = sentence.split(/\s+/);
      let sentenceChunk = '';

      for (const word of words) {
        const candidate = sentenceChunk ? `${sentenceChunk} ${word}` : word;

        if (countTokens(candidate) <= maxTokens) {
          sentenceChunk = candidate;
        } else if (countTokens(word) > maxTokens) {
          if (sentenceChunk) {
            addChunk(chunks, document, sentenceChunk);
          }

          const pieces = splitOversizedWord(word, maxTokens);
          for (const piece of pieces.slice(0, -1)) {
            addChunk(chunks, document, piece);
          }

          sentenceChunk = pieces[pieces.length - 1] ?? '';
        } else {
          if (sentenceChunk) {
            addChunk(chunks, document, sentenceChunk);
          }

          sentenceChunk = word;
        }
      }

      if (sentenceChunk) {
        currentChunk = sentenceChunk;
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
