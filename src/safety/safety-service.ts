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
export const CONDITION_KEYWORDS =
  'injury|condition|disease|syndrome|disorder|diagnosis|tear|fracture|cancer|tumou?r|disc|herniation|infection|concussion|arthritis|meniscus|acl|mcl|pcl|lcl|sciatica|pneumonia|diabetes';

export const DIAGNOSIS_REQUEST_MESSAGE =
  'I cannot diagnose medical conditions or identify what condition you may have, but I can help summarize your recorded symptoms, tests, treatments, and medical history.';

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
      message: DIAGNOSIS_REQUEST_MESSAGE,
    };
  }

  return {
    allowed: true,
  };
}

// Output-side counterpart to `diagnosisPatterns` above. Deliberately narrower than a
// plain "does this contain a condition word" check: journal summaries routinely restate
// a diagnosis that is already recorded (an injury's name, a doctor's note), and that
// grounded restatement is the app's core function, not a leak. What this targets instead
// is the LLM *hedging toward its own inference* -- speculative phrasing ("you may have",
// "this could be") that reads as the assistant reaching a diagnostic judgment on its own,
// rather than reporting a fact already present in the record. Definite statements
// ("you have X", "diagnosis: X") are intentionally NOT flagged, since those are the
// normal shape of a faithful summary of recorded data.
const diagnosisLeakPatterns = [
  new RegExp(
    `you (?:may have|might have|could have|likely have|possibly have|appear to have)\\s+(?:a|an|any)?\\s*(?:\\w+\\s+){0,2}(?:${CONDITION_KEYWORDS})\\b`,
    'i',
  ),

  new RegExp(
    `this (?:could be|might be|may be|looks like|sounds like|appears to be)\\s+(?:a|an)?\\s*(?:\\w+\\s+){0,2}(?:${CONDITION_KEYWORDS})\\b`,
    'i',
  ),
];

// Definite diagnostic assertions ("you have X", "diagnosis: X") are the normal shape of a
// faithful summary of recorded data, so they're not flagged outright like the hedged patterns
// above. Instead each one is checked against `evidence` (the retrieved chunks / journal record
// text that was actually fed to the LLM) — a definite statement naming a condition that never
// appears in that evidence is far more likely fabricated than grounded. Each pattern captures
// the matched CONDITION_KEYWORDS term so it can be looked up in the evidence text.
const definiteDiagnosisPatterns = [
  new RegExp(
    `you (?:have|had|have been diagnosed with|were diagnosed with)\\s+(?:a|an|any)?\\s*(?:\\w+\\s+){0,2}(${CONDITION_KEYWORDS})\\b`,
    'gi',
  ),

  new RegExp(
    `diagnos(?:is|ed with)(?:\\s+is)?:?\\s+(?:a|an|any)?\\s*(?:\\w+\\s+){0,2}(${CONDITION_KEYWORDS})\\b`,
    'gi',
  ),

  new RegExp(
    `this is (?:the|a|an)?\\s*(?:\\w+\\s+){0,2}(${CONDITION_KEYWORDS})\\b`,
    'gi',
  ),
];

// Finds the first definite-diagnosis term asserted in `answer` that does not appear anywhere
// in `evidence`, or null if every asserted term is grounded (or none were asserted at all).
function findUngroundedDiagnosisTerm(
  answer: string,
  evidence: string,
): string | null {
  for (const pattern of definiteDiagnosisPatterns) {
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;

    while ((match = pattern.exec(answer)) !== null) {
      const term = match[1];
      const isGrounded = new RegExp(`\\b${term}\\b`, 'i').test(evidence);

      if (!isGrounded) {
        return term;
      }

      if (match.index === pattern.lastIndex) {
        pattern.lastIndex += 1;
      }
    }
  }

  return null;
}

// Detects prompt-injection-style phrasing inside stored journal/RAG content (e.g. a
// `notes` or `description` field) before it's interpolated into the LLM prompt. This is
// defense-in-depth, not the primary control — the primary control is that the prompt
// builder sends this content as clearly-delimited untrusted data in a separate message
// from the fixed system instructions (see #66). Like `diagnosisPatterns`, this pattern
// list will always be a step behind real-world phrasing.
const promptInjectionPatterns = [
  /ignore (?:the |all |any )?(?:previous|prior|above|earlier) instructions/i,
  /disregard (?:the |all |any )?(?:previous|prior|above|earlier) instructions/i,
  /forget (?:the |all |any )?(?:previous|prior|above|earlier) instructions/i,
  /new instructions\s*:/i,
  /system prompt/i,
  /you are now (?:a|an)\b/i,
  /act as (?:a|an)\b/i,
  /pretend (?:you are|to be)\b/i,
];

export function checkContentSafety(
  content: string,
  requestId?: string,
): SafetyResult {
  void requestId; // unused for now — reserved for future log correlation (#32)

  const normalizedContent = content.replace(/\s+/g, ' ').trim();

  const isInjectionAttempt = promptInjectionPatterns.some((pattern) =>
    pattern.test(normalizedContent),
  );

  if (isInjectionAttempt) {
    return {
      allowed: false,
      reason: 'content_injection_risk',
      message:
        'I could not safely process some of the retrieved content for this request. Please rephrase your question, or ask about your recorded symptoms, tests, treatments, and medical history instead.',
    };
  }

  return {
    allowed: true,
  };
}

export function checkAnswerSafety(
  answer: string,
  evidence = '',
  requestId?: string,
): SafetyResult {
  void requestId; // unused for now — reserved for future log correlation (#32)

  const normalizedAnswer = answer.replace(/\s+/g, ' ').trim();
  const normalizedEvidence = evidence.replace(/\s+/g, ' ').trim();

  const isDiagnosisLeak = diagnosisLeakPatterns.some((pattern) =>
    pattern.test(normalizedAnswer),
  );

  if (isDiagnosisLeak) {
    return {
      allowed: false,
      reason: 'diagnosis_leak',
      message:
        'I withheld that response because it read like a medical diagnosis, which I cannot provide. I can summarize your recorded symptoms, tests, treatments, and medical history instead.',
    };
  }

  const ungroundedTerm = findUngroundedDiagnosisTerm(
    normalizedAnswer,
    normalizedEvidence,
  );

  if (ungroundedTerm) {
    return {
      allowed: false,
      reason: 'unsupported_diagnosis',
      message:
        'I withheld that response because it stated a diagnosis that is not supported by your recorded information. I can summarize what is actually documented in your journal instead.',
    };
  }

  return {
    allowed: true,
  };
}
