Run this immediately after finishing a /next item, before picking up another one.

The task that was just completed may have made a fact in CLAUDE.md or docs/04-implementation-roadmap.md stale — e.g. something documented as "unwired," "not yet enforced," "unfinished placeholder," or "no entrypoint exists" may now be resolved; a command in CLAUDE.md's Commands section may have changed; an invariant in Safe-Change Rules may no longer apply as written; a roadmap item may now be done, in-progress, or superseded.

Review what was actually changed in this task (diff, files touched, or your own memory of the work just done) against:

- CLAUDE.md, all sections
- docs/04-implementation-roadmap.md

Do NOT edit either file yet. This is a review pass only.

For each stale item found, tell me: which file, which section/line, what it currently says, and what it should say instead. If nothing is stale, say so plainly rather than inventing something to flag.

Then in chat, give me ONLY a short summary: a list of proposed changes (max 5-8 bullets, one line each: "file/section — current → proposed"). Wait for me to confirm which ones to apply before touching either file.

Once I've told you what to apply (or that nothing needs applying), make only those specific edits, then remind me: run /compact now, then /next to continue.
