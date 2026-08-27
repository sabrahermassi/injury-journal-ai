Run `gh issue list --state open --json number,title,body,labels` and find the lowest-priority open item across TWO sources: (1) issues titled `[P##] ...`, and (2) any issue (including hand-written ones) carrying a `priority-P##` label. Compare the P numbers across both sources together and pick whichever is lowest overall — priority order is unified across new and existing issues, it doesn't matter which mechanism carries the tag.

If nothing has either a `[P##]` title tag or a `priority-P##` label, fall back to the next open issue generally (mention that you're falling back, since it means either everything's done or /sync-issues hasn't been run recently). docs/04-implementation-roadmap.md is background context only if you need the original reasoning — the priority-tagged/labeled open issues are the actual task queue now. Don't pick something from the roadmap that has no corresponding issue; if you find one, tell me instead of starting work, since it means /sync-issues missed it.

Before proposing a plan: check whether the task's scope can be determined from the issue title/body plus a quick read of the directly relevant file(s). If yes, propose the plan directly — do not spawn any subagent or exploration pass. Only use the `explorer` subagent (`.claude/agents/explorer.md`) when the task is genuinely large or ambiguous — touches multiple unfamiliar modules, requires understanding an unfamiliar part of the codebase before a plan is even possible, or the issue itself says the scope is unclear. Do not spawn a separate planning subagent under any circumstances — once `explorer` reports back (or is skipped because it wasn't needed), build the plan directly in this main session.

Briefly state which issue you're picking up (P number, GitHub issue number, and title) and a one-line plan before starting. Wait for my confirmation before making any file edits.

Once I confirm the plan: before anything else, determine how this repo tracks issue status — check whether a GitHub Projects board with a Status field is set up (`gh project list` / `gh project item-list`), or whether status is tracked via labels (look for existing `status:*`-style labels on issues). Use whichever mechanism the repo actually has; do not assume one over the other without checking. If neither exists, tell me and ask which I want before proceeding.

Set the issue's status to **Ready** now that I've confirmed the plan and before any branch/file work begins.

Ask, separately, whether I want the work done on a new local branch. If I say yes, check the current branch with `git branch --show-current` and propose a suitable branch name for this issue (short, kebab-case, referencing the issue number — e.g. `37-wire-embed-query`). Confirm the name with me, then create it stacked on top of whatever branch I'm currently on: `git checkout -b <name>` (this naturally stacks on the current branch's tip — don't branch from main unless I'm already on main). Do not push or open a PR — that's mine to do manually. If I say no to a new branch, proceed on the current branch as-is.

Immediately after the branch is created (or the branch question is resolved if I said no), set the issue's status to **In Progress**, then make the file edits.

Once the implementation is done, before moving to verification/ship: explicitly check test coverage for what was just changed. Answer these directly, don't wait to be asked:

- Are the existing unit tests updated to reflect this change, or do any now test stale/removed behavior?
- Are the existing integration tests updated similarly?
- Does any new function, branch, or edge case introduced by this change have NO test coverage at all (not even indirectly via a mock)? Call these out specifically — a function only ever exercised through another test's mock is not the same as having its own direct test.
- Is there any pre-existing gap in the same file/area that this change touches but doesn't itself cause? Note these separately as out-of-scope-but-flagged, don't silently fix them or silently ignore them.

Propose which gaps should be added to this change (only ones directly touching new/modified code — no scope creep) versus left as separately-flagged pre-existing gaps (check for an existing tracked issue before proposing a new one). Wait for my approval before adding any new tests.

Once the work is verified (tests pass, I've confirmed I'm ready to commit/push) and I tell you a PR has been opened (or you open it yourself if I've explicitly asked you to), set the issue's status to **In Review**, link the PR to the issue if the tracking mechanism supports it, and — if the `coderabbitai` GitHub App is installed on this repo — leave a PR comment `@coderabbitai review` to trigger an automated review. If CodeRabbit isn't installed, mention that instead of silently skipping it.

Do not advance status backward or skip a stage. If asked to abandon or pause an issue mid-work, ask me what status it should reflect instead of guessing.
