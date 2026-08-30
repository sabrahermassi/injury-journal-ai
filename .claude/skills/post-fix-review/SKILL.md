Run after a fix is implemented and verified (tsc, lint, tests passing), before commit.

Do not commit, push, or open a PR. Wait for go-ahead after the report.

## 1. Classify

Check if the diff touches: auth, user data access/scoping, input validation, secrets, API
endpoints, dependencies, or health/journal data handling.

## 2. Review

- Security-relevant: run `/security-review`, then a self-review (`self-review` skill) of the diff.
  Report both.
- Not security-relevant: run only a self-review (`self-review` skill) of the diff. Report that.

Self-review = re-read the diff like someone else's PR: bugs, missed edge cases, inconsistent
patterns, leftover debug code, whether the change matches what was asked.

## 3. Wrap-up

Show `git status`. Ask if I want to commit.
