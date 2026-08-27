export type SafetyResult =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      reason: string;
      message: string;
    };

// Shared keyword set used by several patterns below.
// NOTE: this list will always be a step behind real-world phrasing (see review notes) —
// treat this regex layer as a fast pre-filter, not the sole safety boundary. The downstream
// LLM must also be instructed never to diagnose, regardless of how the question is phrased.
const CONDITION_KEYWORDS =
  'injury|condition|disease|syndrome|disorder|diagnosis|tear|fracture|cancer|tumou?r|disc|herniation|infection|concussion|arthritis';

const diagnosisPatterns = [
  // "Do I have X" — only allow a short qualifier (article + up to 2 words) between the verb
  // and the keyword, so unrelated context ("old notes about my fracture") isn't swallowed by
  // a free-form wildcard and incorrectly blocked.
  new RegExp(
    `do i have (?:a|an|any)?\\s*(?:\\w+\\s+){0,2}(?:${CONDITION_KEYWORDS})\\b`,
    'i',
  ),

  new RegExp(
    `am i (?:suffering from|experiencing|showing signs of)\\s+(?:a|an|any)?\\s*(?:\\w+\\s+){0,2}(?:${CONDITION_KEYWORDS}|illness|something (?:serious|wrong|dangerous))`,
    'i',
  ),

  /am i sick/i,

  new RegExp(
    `what (?:is|are) my symptoms (?:of|for)\\s+(?:a|an|this|these|my)\\s*(?:\\w+\\s+){0,2}(?:${CONDITION_KEYWORDS}|illness)\\b`,
    'i',
  ),

  // "diagnose me" — but not when the user is explicitly declining/negating a diagnosis
  // request (e.g. "please don't diagnose me, just summarize my treatments").
  /(?<!don't\s|do not\s|not asking (?:you )?to\s|no need to\s)diagnose me/i,

  // Covers direct "what <condition/injury/disease/diagnosis> do/did I have" wording,
  // plus the imperative form "tell me what injury I have".
  new RegExp(
    `what (?:injury|condition|disease|diagnosis) (?:do|did) i have`,
    'i',
  ),

  new RegExp(`tell me what (?:injury|condition|disease|diagnosis) i have`, 'i'),

  // Covers the shorter imperative form where "do/did" is omitted:
  // "tell me what injury I have".  new RegExp(`tell me what (?:injury|condition|disease|diagnosis) i have`, 'i'),

  /what(?:'s| is) wrong with me/i,

  new RegExp(
    `is this (?:a|an)?\\s*(?:${CONDITION_KEYWORDS}|illness|serious|dangerous)\\b`,
    'i',
  ),

  /could this be (cancer|a tumor|a tumour|an illness|a disease|a condition|an injury|a fracture|a tear|a syndrome|a disorder|an infection|a concussion|arthritis|a sprain|a broken bone)/i,

  // Semantic paraphrases of a diagnosis request that don't use "do I have" / "diagnose me"
  // wording — added after reviewing common rewordings that bypassed the original patterns.
  /what (?:condition|injury|disease)?\s*(?:does|do) (?:this|these|my symptoms|it) sound like/i,

  /do (?:these|my) symptoms mean (?:i have )?something (serious|wrong|dangerous)/i,

  /(?:most likely|likely) (condition|diagnosis|injury|explanation)/i,

  // Disclaimer-bypass pattern: "I'm not asking for a diagnosis, but ..."
  /not asking (?:for )?a diagnosis,?\s*but/i,
];

export function checkSafety(question: string, requestId?: string): SafetyResult {
  void requestId; // unused for now — reserved for future log correlation (#32)

  const normalizedQuestion = question.replace(/\s+/g, ' ').trim();

  const isDiagnosisRequest = diagnosisPatterns.some((pattern) =>
    pattern.test(normalizedQuestion),
  );

  if (isDiagnosisRequest) {
    return {
      allowed: false,
      reason: 'diagnosis_request',
      message:
        'I cannot diagnose medical conditions, but I can help summarize your recorded symptoms, tests, treatments, and medical history.',
    };
  }

  return {
    allowed: true,
  };
}
