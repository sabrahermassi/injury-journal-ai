import { getEncoding } from 'js-tiktoken';
import type { JournalDocument } from '../documents/document-types.js';

const DEFAULT_MAX_TOKENS = 300;
const DEFAULT_OVERLAP_TOKENS = 50;

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
    const remaining = chars.length - start;

    // Exponentially grow the candidate length to bound the search window
    // near the true boundary first, rather than binary-searching the full
    // remaining word on every piece — that re-tokenizes long suffixes and
    // scales quadratically for large whitespace-free inputs.
    let fit = 1;
    let probe = 2;

    while (
      probe <= remaining &&
      countTokens(chars.slice(start, start + probe).join('')) <= maxTokens
    ) {
      fit = probe;
      probe *= 2;
    }

    let lo = fit;
    let hi = Math.min(probe, remaining);

    while (lo < hi) {
      const mid = lo + Math.ceil((hi - lo) / 2);
      if (countTokens(chars.slice(start, start + mid).join('')) <= maxTokens) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }

    const pieceLength = Math.max(lo, 1);
    pieces.push(chars.slice(start, start + pieceLength).join(''));
    start += pieceLength;
  }

  return pieces;
}

// Returns the trailing text of `text` that fits within `overlapTokens`,
// breaking only on whitespace so it never cuts a word in half — oversized
// single "words" are already handled separately by splitOversizedWord.
function getOverlapTail(text: string, overlapTokens: number): string {
  if (overlapTokens <= 0 || !text) {
    return '';
  }

  const words = text.split(/\s+/).filter(Boolean);
  let tail: string[] = [];

  for (let i = words.length - 1; i >= 0; i--) {
    const candidate = [words[i], ...tail];
    if (countTokens(candidate.join(' ')) > overlapTokens) {
      break;
    }
    tail = candidate;
  }

  return tail.join(' ');
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
  overlapTokens: number = Math.min(
    DEFAULT_OVERLAP_TOKENS,
    Math.floor(maxTokens / 4),
  ),
): JournalDocument[] {
  if (!(maxTokens >= 1)) {
    throw new Error(`maxTokens must be at least 1, received ${maxTokens}`);
  }

  if (!(overlapTokens >= 0)) {
    throw new Error(
      `overlapTokens must be at least 0, received ${overlapTokens}`,
    );
  }

  if (overlapTokens >= maxTokens) {
    throw new Error(
      `overlapTokens (${overlapTokens}) must be less than maxTokens (${maxTokens})`,
    );
  }

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

    // Save the current chunk before processing the large paragraph, keeping
    // its trailing text as overlap seed for whatever comes next.
    let paragraphOverlapSeed = '';
    if (currentChunk) {
      addChunk(chunks, document, currentChunk);
      paragraphOverlapSeed = getOverlapTail(currentChunk, overlapTokens);
    }

    // The paragraph itself fits in one chunk.
    if (countTokens(paragraph) <= maxTokens) {
      const seeded = paragraphOverlapSeed
        ? `${paragraphOverlapSeed}\n\n${paragraph}`
        : paragraph;
      currentChunk = countTokens(seeded) <= maxTokens ? seeded : paragraph;
      continue;
    }

    // The paragraph is too large, so split it into sentences. Carry the
    // overlap seed forward as the starting point for the first sentence.
    currentChunk = paragraphOverlapSeed;
    const sentences = splitIntoSentences(paragraph);

    for (const sentence of sentences) {
      const sentenceCandidate = currentChunk
        ? `${currentChunk} ${sentence}`
        : sentence;

      if (countTokens(sentenceCandidate) <= maxTokens) {
        currentChunk = sentenceCandidate;
        continue;
      }

      // Sentence candidate doesn't fit, so save it and keep its trailing
      // text as overlap seed for whatever comes next.
      let sentenceOverlapSeed = '';
      if (currentChunk) {
        addChunk(chunks, document, currentChunk);
        sentenceOverlapSeed = getOverlapTail(currentChunk, overlapTokens);
      }

      // Now we're starting with the sentence alone.
      if (countTokens(sentence) <= maxTokens) {
        const seeded = sentenceOverlapSeed
          ? `${sentenceOverlapSeed} ${sentence}`
          : sentence;
        currentChunk = countTokens(seeded) <= maxTokens ? seeded : sentence;
        continue;
      }

      // The sentence itself is too large. Carry the overlap seed forward as
      // the starting point for the first word.
      const words = sentence.split(/\s+/);
      let sentenceChunk = sentenceOverlapSeed;

      for (const word of words) {
        const candidate = sentenceChunk ? `${sentenceChunk} ${word}` : word;

        if (countTokens(candidate) <= maxTokens) {
          sentenceChunk = candidate;
        } else if (countTokens(word) > maxTokens) {
          let wordOverlapSeed = '';
          if (sentenceChunk) {
            addChunk(chunks, document, sentenceChunk);
            wordOverlapSeed = getOverlapTail(sentenceChunk, overlapTokens);
          }

          const pieces = splitOversizedWord(
            wordOverlapSeed ? `${wordOverlapSeed} ${word}` : word,
            maxTokens,
          );
          for (const piece of pieces.slice(0, -1)) {
            addChunk(chunks, document, piece);
          }

          sentenceChunk = pieces[pieces.length - 1] ?? '';
        } else {
          let wordOverlapSeed = '';
          if (sentenceChunk) {
            addChunk(chunks, document, sentenceChunk);
            wordOverlapSeed = getOverlapTail(sentenceChunk, overlapTokens);
          }

          const seeded = wordOverlapSeed
            ? `${wordOverlapSeed} ${word}`
            : word;
          sentenceChunk = countTokens(seeded) <= maxTokens ? seeded : word;
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
  overlapTokens: number = Math.min(
    DEFAULT_OVERLAP_TOKENS,
    Math.floor(maxTokens / 4),
  ),
): JournalDocument[] {
  return documents.flatMap((document) =>
    chunkDocument(document, maxTokens, overlapTokens),
  );
}
