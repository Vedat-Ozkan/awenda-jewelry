# CLAUDE.md

**Project plan:** read `docs/plan/00-overview.md`, then `docs/plan/DECISIONS.md`, then your assigned phase file before writing any code. `STOP — ask the owner` markers in those files are hard stops.

## Workflow: who does what

The main session orchestrates and is the only thing that talks to the owner. Code is delegated. Agents live in `.claude/agents/`, skills in `.claude/skills/`.

| Need | Use | Model |
|---|---|---|
| Run a whole phase | `/phase N` | main session (Opus by default) |
| A design judgment, a tradeoff, a STOP question needing a recommendation | `architect` agent | Fable — expensive, use sparingly |
| Writing code + tests for 3–5 related steps | `implementer` agent | Sonnet |
| Running tests/typecheck/lint and reporting only failures | `runner` agent | Haiku |
| Pre-PR review of a phase branch | `reviewer` agent | Opus |
| Record a decision | `/decide …` | — |

Rules of thumb: switch the main session to Fable (`/model fable`) only at phase kick-off or when several STOP questions need judgment, then back to Opus. Never spawn the architect for something the phase file already answers. Never let raw test logs into the main context — that is the runner's job. Secrets files (`.env*`, `.dev.vars`) are blocked for all agents by hook; only `.env.example` is editable.

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.