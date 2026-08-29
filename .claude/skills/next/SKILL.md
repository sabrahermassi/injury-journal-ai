# Next

Run this workflow to pick up the next prioritized GitHub issue and implement it.

## 1. Select the issue

Run:

`gh issue list --state open --limit 30 --json number,title,labels`

Do NOT request `body` here. It pulls the full text of every open issue (~10k tokens) at the very start
of the session, where it is then re-read by every subsequent turn. After selecting the issue, fetch only
that one:

`gh issue view <number> --json title,body`

Find the lowest `P##` across both:

- `[P##]` in the issue title
- `priority-P##` label

Treat both as one priority system.

If no issue has either form, fall back to the next open issue and explicitly say you are falling back.

`docs/04-implementation-roadmap.md` is background context only. Do not start work on a roadmap item that has no corresponding GitHub issue; report that `/sync-issues` appears out of date instead.

Briefly report:

- priority
- issue number
- title
- one-line implementation plan

## 2. Understand the scope

Use the issue title/body and a quick read of directly relevant files to determine scope.

Do not spawn a subagent if the scope is clear.

Use `.claude/agents/explorer.md` only when the task is genuinely large or ambiguous, such as:

- multiple unfamiliar modules
- an unfamiliar subsystem must be understood before planning
- the issue explicitly says the scope is unclear

Never use a separate planning subagent.

After exploration, create the plan yourself.

Wait for my confirmation before editing files.

## 3. Prepare the work

After plan approval:

1. Determine how this repository tracks issue status:
   - GitHub Projects Status field, or
   - issue labels such as `status:*`
2. Use the mechanism actually configured in the repository.
3. If neither exists, stop and ask me which to use.
4. Set the issue to `Ready`.
5. Ask whether I want a new local branch.

If yes:

- check `git branch --show-current`
- propose a short kebab-case branch name containing the issue number
- wait for confirmation
- create it from the current branch with `git checkout -b <name>`

Do not push or create a PR.

If no, continue on the current branch.

Set the issue to `In Progress`.

## 4. Implement

Before adding new logic:

- inspect existing implementations and relevant consumers
- reuse existing abstractions where appropriate
- avoid unrelated refactoring
- follow `CLAUDE.md` and the relevant project documentation

Make only changes required for the issue.

## 5. Verify

Run the verification commands from `CLAUDE.md` §10.

Run integration tests and the evaluation harness when the change requires them.

Do not invent commands or scripts.

## 6. Check test coverage

Before handing off, explicitly determine:

- Are existing unit tests updated, or do any test stale behavior?
- Are relevant integration tests updated?
- Does any new function, branch, or edge case lack direct test coverage?
- Are there pre-existing gaps in the area touched by this change?

Separate:

- gaps that should be added to this change
- pre-existing gaps that should remain out of scope

Check GitHub for an existing issue before proposing a new one for a pre-existing gap.

Do not add new tests for identified gaps without my approval.

## 7. Handoff

Report:

- issue completed
- files changed
- implementation summary
- tests/checks run
- coverage gaps
- any out-of-scope pre-existing issues

Stop here.

Use `/self-review` for a skeptical review and `/ship` when ready to commit/push/create the PR.

Do not commit, push, create a PR, or trigger external review automation.

If asked to abandon or pause the issue, ask what status it should have rather than guessing.
