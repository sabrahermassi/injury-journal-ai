import { semanticSearch } from '../retrieval/semantic-search.js';
import { buildContext } from './context-builder.js';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt-builder.js';
import { generateAnswer } from '../llm/llm-client.js';
import { buildCitations } from '../rag/citation-builder.js';
import { verifyCitations } from '../rag/citation-verifier.js';
import {
  checkSafety,
  checkContentSafety,
  checkAnswerSafety,
} from '../safety/safety-service.js';
import { prisma } from '../lib/prisma.js';

// `limit` is a target number of distinct sources, not a hard cap on chunks
// used for grounding — see `semanticSearch`. More chunks than `limit` can be
// retrieved (and end up in `context`/`citations`) when adjacent near-duplicate
// chunks are found, since none of their content is ever dropped (#215).
export async function answerQuestion(
  question: string,
  injuryId: number | undefined,
  userId: number,
  limit = 5,
  requestId?: string,
) {
  const safety = checkSafety(question, requestId);

  if (!safety.allowed) {
    return {
      answer: safety.message,
      chunks: [],
      citations: [],
    };
  }

  let scopedInjuryName: string | undefined;

  if (injuryId !== undefined) {
    const injury = await prisma.injury.findFirst({
      where: { id: injuryId, userId },
      select: { id: true, name: true },
    });

    if (!injury) {
      return {
        answer: 'No injury record was found.',
        chunks: [],
        citations: [],
      };
    }

    scopedInjuryName = injury.name;
  }

  const chunks = await semanticSearch(question, injuryId, userId, limit, requestId);

  if (chunks.length === 0) {
    return {
      answer:
        'The journal does not contain information that closely matches this question. ' +
        'Try rephrasing it, or asking about a specific date or injury.',
      chunks: [],
      citations: [],
    };
  }

  const injuryNames = new Map<number, string>();

  if (injuryId !== undefined) {
    // scopedInjuryName is always set at this point: the ownership check above either
    // returns early (no injury found) or sets it.
    injuryNames.set(injuryId, scopedInjuryName as string);
  } else if (chunks.length > 0) {
    const injuryIds = [...new Set(chunks.map((chunk) => chunk.injuryId))];
    const injuries = await prisma.injury.findMany({
      where: { id: { in: injuryIds }, userId },
      select: { id: true, name: true },
    });

    for (const injury of injuries) {
      injuryNames.set(injury.id, injury.name);
    }
  }

  const context = buildContext(chunks, injuryNames, requestId);

  const contentSafety = checkContentSafety(context, requestId);

  if (!contentSafety.allowed) {
    return {
      answer: contentSafety.message,
      chunks: [],
      citations: [],
    };
  }

  const userPrompt = buildUserPrompt(question, context, requestId);

  const answer = await generateAnswer(SYSTEM_PROMPT, userPrompt, requestId);

  const answerSafety = checkAnswerSafety(answer, context, requestId);

  if (!answerSafety.allowed) {
    return {
      answer: answerSafety.message,
      citations: [],
      chunks: [],
    };
  }

  const builtCitations = buildCitations(chunks, injuryNames, requestId);
  const verifiedCitations = await verifyCitations(builtCitations);
  const verifiedSourceKeys = new Set(
    verifiedCitations
      .filter((citation) => citation.verified)
      .map((citation) => `${citation.sourceType}:${citation.sourceId}`),
  );
  const citations = builtCitations.filter((citation) =>
    verifiedSourceKeys.has(`${citation.sourceType}:${citation.sourceId}`),
  );

  return {
    answer,
    citations,
    chunks,
  };
}
