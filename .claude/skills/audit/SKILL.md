## Claude Code Configuration & Token-Usage Audit

Perform a read-only audit of my Claude Code configuration and documentation.

### Scope

Inspect:

- `CLAUDE.md`
- `.claude/`
- all `.md` files under `.claude/`
- `.claude/skills/`
- `.claude/agents/`
- relevant project documentation that is explicitly referenced by these files
- Claude Code settings/configuration relevant to how these instructions are loaded
- installed plugins/skills that are visible to this project/session

Do **not** modify anything.

### Goals

I want to reduce unnecessary context and token usage without weakening the quality of:

- code reviews
- security reviews
- security guidance
- development workflows
- testing
- AI/RAG review
- project-specific architectural constraints

### Look specifically for

1. **Duplicate instructions**
   - Same rule repeated in multiple `.md` files
   - Instructions repeated between `CLAUDE.md`, skills, agents, and plugins
   - Rules that could live in one place instead

2. **Overlapping checks**
   - Security checks duplicated by multiple skills/plugins
   - Code-review checks duplicated by my self-review skill or Claude Code's built-in review functionality
   - Tests/checks that are performed automatically by another mechanism
   - Multiple instructions telling Claude to inspect the same files

3. **Unnecessary context loading**
   - Documentation that is always loaded but is only relevant to specific tasks
   - Large instructions that could be made conditional
   - Skills that unnecessarily load project-wide context
   - Instructions that could be replaced with "read X when working on Y"

4. **Token-heavy workflows**
   - Instructions likely to cause Claude to read large amounts of code unnecessarily
   - Redundant repository exploration
   - Excessive verification or repeated checks
   - Subagent usage that may not provide enough value for its token cost
   - Anything that could benefit from RTK

5. **Conflicting instructions**
   - Rules that contradict each other
   - Global configuration versus project configuration conflicts
   - Plugin behavior versus custom skill behavior

6. **Unnecessary configuration**
   - Anything installed/configured that provides little value for this project
   - Skills, agents, hooks, or plugins that overlap significantly
   - Configuration that can safely be removed or simplified

### Important constraints

Do NOT recommend removing something merely because another implementation is possible.

Do NOT weaken security, authorization, data isolation, testing, or safety requirements simply to save tokens.

Distinguish between:

- **Must keep**
- **Useful but could be simplified**
- **Redundant**
- **Potentially unnecessary**
- **Token-expensive**
- **Potentially conflicting**

For every recommendation, explain what currently causes the context/token cost and what would replace it.

### Output

Start with:

## Configuration Audit Summary

Then provide:

### 1. Current configuration

Briefly map what each major `CLAUDE.md`, skill, agent, plugin, and hook does.

### 2. Overlap / duplication

Show duplicated or overlapping responsibilities.

### 3. Token-cost opportunities

Rank the biggest opportunities by estimated impact:

- HIGH
- MEDIUM
- LOW

Do not invent precise token numbers. Explain the likely source of the savings.

### 4. Security/review coverage

Show which security and review checks are provided by:

- my custom instructions
- skills
- agents
- plugins
- Claude Code built-ins

Identify genuine duplication versus complementary checks.

### 5. Recommended simplification

Propose the smallest configuration that preserves the current functionality.

Do not modify files.

### 6. Proposed changes

For each proposed change, show:

- File
- Current responsibility
- Problem
- Proposed change
- Expected token/context benefit
- Risk of removing it

### 7. Final recommendation

Tell me exactly what you would keep, simplify, move, or remove.

Do not make any changes until I explicitly approve them.
