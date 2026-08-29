# Address Review Feedback on the Next Open PR

Run this workflow to pick up and address review feedback on an open PR in the current stack.

This workflow is designed to be safe when another Claude Code session is concurrently working on a different branch in the primary working directory.

The workflow must never check out or modify a branch in the primary working directory. All implementation work must happen in a separate Git worktree.

---

## Safety and Permission Rules

Read-only repository and GitHub inspection may proceed without approval.

The following actions ALWAYS require my explicit approval immediately before they happen:

- modifying source or project files
- committing changes
- pushing to a remote
- posting GitHub comments
- replying to review comments
- resolving GitHub review threads
- triggering external review automation such as CodeRabbit
- removing an existing worktree
- rebasing or merging branches
- rewriting Git history

NEVER:

- run `git checkout` or `git switch` in the primary working directory
- run `git reset --hard`
- run `git clean`
- discard uncommitted work
- automatically stash changes
- overwrite another session's changes
- force-push with `--force` or `--force-with-lease`
- delete branches
- blindly run `git add .` or `git add -A`
- modify `.env`, credentials, secrets, or unrelated generated files
- create a new PR for this workflow
- silently introduce architectural changes to satisfy review feedback

If anything appears ambiguous, destructive, unexpected, or potentially related to another Claude Code session, STOP and ask me.

---

# Step 1 — Identify Which PR to Address Next

List all open PRs in this repository:

    gh pr list --repo <owner>/<name> --json number,title,headRefName,baseRefName

Reconstruct the stack order from `baseRefName` relationships:

- identify the PR whose base is `main`
- identify PRs whose base branch is another PR's head branch
- reconstruct the stack from bottom to top

Starting from the bottom of the stack, find the earliest PR that has unresolved review feedback.

For each candidate PR, inspect:

    gh pr view <number> --repo <owner>/<name> --json reviews,comments

and:

    gh api repos/<owner>/<name>/pulls/<number>/comments

Check both CodeRabbit and Greptile activity, including:

- inline comments
- top-level review comments
- review submissions
- unresolved feedback

Do not assume previously observed feedback is still current.

Also verify:

- the PR is still open
- the head branch still exists
- the base branch still exists
- the PR's head/base relationship has not changed

Tell me:

- which PR you selected
- its position in the stack
- why it is the earliest PR requiring attention
- a one-line summary of the unresolved feedback

**STOP and wait for my confirmation before proceeding.**

---

# Step 2 — Verify Git State and Create an Isolated Worktree

After I approve the selected PR, inspect the local repository state:

    git status --short
    git branch --show-current
    git worktree list
    git remote -v

Do NOT modify the primary working directory.

If the primary working directory contains uncommitted changes:

- do not stash them
- do not reset them
- do not clean them
- do not discard them
- do not overwrite them

Determine whether the requested work can safely proceed entirely in a separate worktree.

If it cannot, **STOP and ask me.**

Create a separate worktree for the PR:

    git worktree add ../<repo-name>-review-<PR-number> <PR-branch-name>

Never run `git checkout` or `git switch` in the primary working directory.

## Existing Worktree

If a worktree for this PR already exists:

1. Inspect its path.
2. Inspect its branch.
3. Run `git status --short` inside it.
4. Determine whether it belongs to this workflow.
5. NEVER remove it automatically.
6. If it is clean and clearly belongs to this PR, ask me whether to reuse it.
7. If it contains uncommitted changes or appears to be used by another session, STOP and ask me.

Do not use forced worktree removal.

Confirm that the worktree is correctly associated with the PR head branch.

All subsequent repository work must happen inside this worktree.

---

# Step 3 — Refresh and Triage Every Review Comment

Inside the worktree, refresh the PR information and gather all current review feedback from:

- CodeRabbit
- Greptile
- human reviewers
- inline comments
- top-level review comments

For every comment, classify it as one of:

## Clearly Correct / Low Risk

A genuine bug or straightforward improvement with no meaningful architectural or behavioral tradeoff.

## Valid but a Judgment Call

A legitimate concern involving a meaningful:

- design tradeoff
- architectural decision
- API contract
- database behavior
- safety behavior
- performance implication
- compatibility concern
- scope decision
- CLAUDE.md Safe-Change Rule

## Disagree / False Positive

The comment is incorrect, misunderstands the implementation, or conflicts with an intentional project decision.

Check:

- relevant architecture documentation - grep for the relevant section, do not read the whole file
- `docs/handoff/architecture-review.md`
- current source code
- relevant GitHub issues

Do NOT read `CLAUDE.md`. It is already in context on every request. Read any document at most once
per session.

## Nitpick / Out of Scope

The comment may be valid but is unrelated to the purpose of this PR.

Check whether it already exists as a tracked issue before proposing separate follow-up work.

For every comment record:

- reviewer
- file/location
- classification
- recommended action
- short reasoning

Present the complete triage before making changes.

**STOP and wait for my approval before modifying any files.**

A comment being classified as "clearly correct" does NOT by itself authorize code changes.

---

# Step 4 — Implement Approved Changes

After I approve the proposed changes:

Implement only the approved review fixes.

Before modifying a file:

- inspect the current implementation
- identify existing abstractions
- check relevant consumers
- check relevant tests
- avoid unrelated refactoring

Prefer extending existing abstractions over creating duplicates.

Do not introduce architectural changes merely to satisfy a review comment.

If a review fix requires any of the following, **STOP and ask me before proceeding:**

- database/schema changes
- migration changes
- API contract changes
- breaking behavior
- architectural changes
- new infrastructure
- merge/rebase
- resolving conflicts
- changing an existing project constraint
- modifying unrelated functionality

Do not automatically wire currently-unused or unfinished modules simply because a review comment mentions them.

If implementation reveals that the review comment requires a broader change than originally approved, STOP and explain why.

---

# Step 4b — Handling Merge Conflicts

If GitHub reports that this PR's branch has conflicts with `main` (or with its base branch),
do NOT attempt to resolve them silently or as a side effect of another step.

Conflicts must be handled as their own explicit, approved action:

1. Show me which file(s) are in conflict.
2. For each conflicted file, show me BOTH sides of the conflict clearly:
   - what the PR branch currently has
   - what the base branch (main) currently has
3. Do not merge/resolve anything yet. Explain what each side is trying to do (e.g. "the PR branch
   adds test X, main added test Y in the same location") so I can see whether this is a genuine
   content conflict or just two independent additions that both need to be kept.
4. Propose a resolution — most commonly, for test files, this means keeping BOTH sides' additions
   rather than picking one and discarding the other. State explicitly whether your proposed
   resolution drops anything from either side.

**STOP and wait for my explicit approval of the proposed resolution before applying it.**

After I approve:

    git fetch origin main
    git merge origin/main

Resolve the conflict markers in the file(s) exactly as approved. Show me the fully resolved file
before committing the merge.

Then:

    git add <resolved files>
    git commit

**STOP and wait for my explicit approval before pushing the resolved merge**, same as any other
push in this workflow.

Never use `git checkout --ours` or `git checkout --theirs` to blindly resolve a conflict without
first showing me both sides — those commands silently discard one side entirely, which is exactly
the failure mode this step exists to prevent.

---

# Step 5 — Verify the Changes

Run the verification commands from `CLAUDE.md` §10 - UNLESS they already ran in this session and no
files have changed since. In that case say so and skip them. Never re-run an identical suite on an
unchanged tree.

For integration-related changes, run the appropriate integration tests.

For changes affecting:

- retrieval
- RAG
- embeddings
- safety guardrails
- other AI behavior

run the project's evaluation harness when required.

Then inspect:

    git status
    git diff
    git diff --check

Review the complete diff.

Confirm that:

- only intended files changed
- no secrets were modified
- no unrelated files changed
- no unexpected generated files changed
- no unrelated refactoring was introduced
- all approved review feedback was addressed
- no new architectural behavior was introduced accidentally

If unexpected changes appear, **STOP and ask me.**

Do not commit yet.

---

# Step 6 — Review Before Commit

Before committing, report:

- files changed
- what changed in each relevant area
- which review comments were addressed
- tests/checks run and their results
- any remaining concerns
- whether the diff contains anything unexpected

Show me the proposed commit message.

**STOP and wait for my explicit approval to commit.**

---

# Step 7 — Commit

After I approve the commit:

Stage only the files intentionally changed for this PR:

    git add <specific-files>

Do NOT blindly use:

    git add .
    git add -A

Before committing, inspect the staged diff:

    git diff --cached

Confirm that only intended changes are staged.

Then commit:

    git commit -m "<message describing what review feedback was addressed>"

Record the resulting commit hash.

Do not push yet.

---

# Step 8 — Verify Remote and Push

Before pushing, verify:

    git remote -v
    git branch --show-current
    git status

Confirm that:

- the current branch is the PR's head branch
- the remote is the expected repository
- there are no unexpected uncommitted changes
- the commit being pushed is the intended commit

**STOP and ask for my explicit approval before pushing.**

After approval:

    git push

NEVER force-push.

Do not run:

    gh pr create

The existing PR must remain the PR being updated.

---

# Step 9 — Verify the Remote PR and CI

After pushing, inspect the PR:

    gh pr view <PR-number> --repo <owner>/<name>

Check CI:

    gh pr checks <PR-number> --repo <owner>/<name>

Check for new review activity.

Report:

- new commit hash
- PR status
- CI/check status
- whether any checks failed
- whether new review activity appeared

Do not assume that passing local tests means the PR is fully healthy.

If CI fails:

- inspect the failure
- determine whether it is related to the changes
- report the findings
- do NOT automatically make additional fixes without approval

Do not refresh the review comments after the push. New feedback is handled when I re-invoke this
workflow (see Step 9b).

---

# Step 9b — Do NOT Poll for New Review Activity

Do NOT poll GitHub in a loop waiting for CodeRabbit, Greptile, or a human reviewer.

Every poll is a full round trip at whatever context the session has already accumulated, and it almost
always returns "nothing new". Report that the push succeeded and STOP.

I will re-invoke this workflow when new review activity actually arrives.

If I explicitly ask you to watch for new activity, use the `Monitor` tool rather than repeated `gh`
calls, so that waiting costs no context.

When I re-invoke you with new comments, triage them using the exact same classification defined in Step 3:

- Clearly Correct / Low Risk
- Valid but a Judgment Call
- Disagree / False Positive
- Nitpick / Out of Scope

Present the complete triage before making any changes, in the same format as Step 3.

**STOP and wait for my approval before modifying any files.**

A comment being classified as "Clearly Correct" does NOT by itself authorize code changes — this
applies here exactly as it does in Step 3.

---

# Step 10 — Respond to Review Feedback

Prepare proposed responses for the addressed review threads.

For each addressed comment, summarize:

- what changed
- why it changed
- relevant verification

For comments deliberately left unchanged, explain:

- why they were not addressed
- whether the concern is valid but out of scope
- whether a separate issue should track it

For disagreements, explain the reasoning and reference the relevant project decision or implementation evidence.

**STOP and ask for explicit approval before posting any GitHub responses or resolving threads.**

After approval:

- reply to relevant review comments
- resolve threads where appropriate
- leave a concise top-level PR comment summarizing the review round

Do not resolve a thread merely because code was changed. Confirm that the reviewer's actual concern has been addressed.

## CodeRabbit

If CodeRabbit is installed and a fresh review would be useful, propose:

    @coderabbitai review

Do NOT trigger it without explicit approval.

---

# Step 11 — Cleanup

Do not automatically remove the worktree.

After the PR has been pushed and verified, report:

    Worktree:
    ../<repo-name>-review-<PR-number>

Ask whether I want it removed.

If I approve removal:

1. Verify the worktree is clean.
2. Confirm it is still the expected PR worktree.
3. Remove it:

       git worktree remove ../<repo-name>-review-<PR-number>

If it contains uncommitted changes, STOP and ask me.

Never use forced worktree removal without explicit approval.

---

# Final Report

Report:

- PR addressed
- position in stack
- review comments fixed
- comments deliberately left unchanged + reasoning
- out-of-scope issues
- files changed
- tests/checks run
- evaluation results if applicable
- commit hash
- push status
- CI status
- review-response status
- worktree location/status

Finally confirm:

- the primary working directory was never checked out
- the primary working directory was not modified
- no uncommitted work was discarded
- no force-push or history rewrite occurred
- only the approved changes were committed
