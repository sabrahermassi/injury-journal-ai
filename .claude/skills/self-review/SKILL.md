# Skeptical Self-Review

Perform a fresh, skeptical code review of [PR #__ / the current diff / the changes on this branch].

Act as if you are reviewing code written by someone else. Do NOT assume the implementation is correct because you or another agent wrote it.

Do not modify any files, commit, push, comment on GitHub, resolve review threads, or trigger external review tools.

## Review scope

First inspect:

1. The complete diff against the PR's base branch.
2. The surrounding implementation of every changed area.
3. Relevant tests and whether they actually exercise the changed behavior.
4. CLAUDE.md and relevant project documentation.
5. Relevant database models, API contracts, and consumers when the change touches them.
6. Existing GitHub issues when you discover a pre-existing problem that may affect the review.

Do not review only the changed lines. Follow important data and control flows into the surrounding code.

## Actively look for

### Correctness

- Bugs and incorrect assumptions
- Edge cases
- Missing error handling
- Incorrect state transitions
- Null/empty/unexpected inputs
- Timing, ordering, concurrency, and retry problems
- Failure and partial-failure behavior
- Resource leaks or cleanup problems

### Testing

- Missing tests for changed behavior
- Tests that only test a side effect rather than the mechanism that produces it
- Tests that pass while the actual failure mode remains untested
- Missing negative/error-path tests
- Tests that are too tightly coupled to implementation details
- Integration boundaries that are not actually tested

### Production behavior

- Assumptions that may fail under load
- Behavior across different environments
- Database consistency
- API compatibility
- Timeout/retry behavior
- External-service failures
- Duplicate requests or repeated processing
- Logging/observability gaps where they matter

### Security and data isolation

- Authentication/authorization assumptions
- User-level data isolation
- Exposure of sensitive journal data
- Trusting client-controlled identifiers
- Unsafe database access
- Secrets or credentials
- Injection risks
- Overly broad access to data

### Architecture

- Contradictions with CLAUDE.md
- Violations of documented project constraints
- New abstractions that duplicate existing ones
- Unnecessary architectural complexity
- Changes that silently alter an API, database, retrieval, RAG, safety, or embedding contract
- Unfinished/unwired code being connected without verifying its behavior

### AI/RAG-specific behavior, when relevant

- Retrieval failures
- Incorrect citation behavior
- Unsupported claims
- Prompt/instruction leakage
- Safety guardrail bypasses
- Incorrect handling of "no relevant information"
- Embedding-model compatibility
- Changes that affect evaluation quality without updating evaluation coverage

### Regression risk

Look specifically for:

- Existing behavior that the diff may accidentally break
- Pre-existing fragility that the new code depends on
- Cases where the new fix works for the intended case but breaks another case
- Code paths that were previously safe but are now bypassed

## Important distinction

For every potential problem, determine whether it is:

1. A regression introduced by this diff.
2. A pre-existing issue exposed by this diff.
3. A pre-existing issue unrelated to this diff.
4. Not actually a problem.

Do not blame the PR for unrelated pre-existing problems.

If a pre-existing issue is relevant, check whether it is already tracked in GitHub before suggesting a new issue.

## Finding categories

Classify every finding into exactly ONE category:

### Clearly Correct

The implementation is solid in this area. Briefly explain why.

### Judgment Call

There is a genuine concern or tradeoff.

Explain:

- what the concern is
- why it matters
- the tradeoff
- your recommended action

Do NOT make the change.

### Disagree

The apparent problem is not actually a problem, or it is unrelated/pre-existing.

Explain why.

### Nitpick

A minor, low-risk improvement that should not block the PR.

## Severity

For every Judgment Call or Nitpick, assign:

- HIGH — could cause data loss, security issues, incorrect behavior, major production failure, or serious regression
- MEDIUM — meaningful correctness, reliability, maintainability, or testing concern
- LOW — minor improvement or low-probability issue

Do not invent severity for Clearly Correct findings.

## Evidence

For every Judgment Call, provide:

- file and relevant code location
- what happens
- why it could be a problem
- concrete scenario that exposes the problem
- recommended action

Do not make vague statements such as "this might cause issues."

## Review discipline

Be skeptical but evidence-based.

Do NOT manufacture hypothetical problems simply to produce findings.

Do NOT recommend changes merely because another implementation is possible.

Prefer the simplest explanation supported by the actual code.

Do not treat architecture documentation as proof that something is implemented. Verify behavior against the code.

## Output

Start with:

### Review Summary

- PR/diff reviewed
- Base branch
- Overall assessment
- Number of findings by category

Then provide the findings.

For each Judgment Call or Nitpick use:

**[Category] — [Severity] — [short title]**

- Location:
- Finding:
- Why it matters:
- Example scenario:
- Recommendation:

For Clearly Correct findings, keep them brief.

For Disagree findings, explain the evidence and whether the issue is already tracked.

Finish with:

### Bottom Line

One concise verdict stating whether you would consider the changes ready to merge, ready with minor changes, or requiring changes before merge — and why.

Do not fix anything yet.

Wait for my direction before taking any action.
