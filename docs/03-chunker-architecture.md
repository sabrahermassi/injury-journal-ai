# The Entire chunker conceptually does this

                JournalDocument
                       │
                       ▼
              Is it small enough?
                 /           \
               YES            NO
                │              │
                ▼              ▼
         Keep record       Split paragraphs
         unchanged              │
                                ▼
                       Can paragraphs fit?
                          /          \
                        YES           NO
                         │             │
                         ▼             ▼
                    Build chunks   Split sentences
                                       │
                                       ▼
                              Can sentences fit?
                                  /        \
                                YES         NO
                                 │           │
                                 ▼           ▼
                            Build chunks   Split sentence
                                               │
                                               ▼
                                         Build chunks
                                               │
                                               ▼
                                      JournalDocument[]

And importantly, metadata travels with every chunk:

Original MedicalVisit #1
│
├── Chunk 1 ── userId 1, injuryId 1, sourceId 1
├── Chunk 2 ── userId 1, injuryId 1, sourceId 1
└── Chunk 3 ── userId 1, injuryId 1, sourceId 1

# What we should test

## Small document stays intact

1 input → 1 chunk
Content unchanged
Metadata unchanged

## Multiple small documents stay separate

3 input documents → 3 chunks

## Large document splits

1 large document → multiple chunks

## Every chunk stays under the configured token limit

Splitting respects the configured maxTokens limit

## Splitting respects sentence boundaries

It shouldn't cut in the middle of a sentence when the sentence fits within the limit.

## Oversized sentences are split further

A sentence that exceeds maxTokens must not produce an oversized chunk.

## Adjacent chunks overlap

The trailing text of chunk N reappears at the start of chunk N+1, up to the
configured overlap budget, so content near a chunk boundary keeps some
surrounding context. Every chunk must still stay under maxTokens even with
overlap seeded in, and overlapTokens = 0 disables overlap entirely.

## Metadata is preserved

Every chunk must retain:
userId
injuryId
sourceType
sourceId
date

## Multiple documents are flattened

chunkDocuments() should return JournalDocument[], not JournalDocument[][].

## Empty content doesn't create chunks

## An oversized sentence falls back to smaller pieces
