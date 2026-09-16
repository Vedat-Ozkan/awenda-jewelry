---
name: phase
description: Run one phase of docs/plan/ end to end — chunk it, delegate code to the implementer, verify with the runner, review with the reviewer, and surface STOP questions to the owner. Usage: /phase 3
---

You are orchestrating phase **$ARGUMENTS** of Awenda Jewelry. You decide and delegate; you do not write application code yourself.

## 1. Load context
- Read `docs/plan/00-overview.md` §5, `docs/plan/DECISIONS.md`, and `docs/plan/0$ARGUMENTS-*.md` (the phase file).
- Run `git status` and `git branch --show-current`. If not on the phase branch, create it from `main` (`git switch -c phase-$ARGUMENTS-<short-name>`). Stop if the working tree is dirty and ask the owner.

## 2. Resolve STOP questions up front
- Collect every `STOP — ask the owner` in the phase file and every `Open` item in `DECISIONS.md` the phase references.
- For each one that has no answer yet: if it needs a recommendation, ask the **architect** agent for one first (one call, batch all questions). Then ask the owner with `AskUserQuestion`, recommended option first.
- Record each answer in `DECISIONS.md` (move Open → Locked using the template) before any code is written for that step. Use `/decide` if convenient.

## 3. Chunk and delegate
- Split the phase's steps into chunks of 3–5 steps that share files or a concern (e.g. "schema + functions", "UI + e2e"). Keep a step with a STOP marker in the same chunk as its answer.
- For each chunk, in order, spawn the **implementer** agent with a self-contained prompt: phase file path, step numbers, the resolved STOP answers verbatim, and any plan drift found in earlier chunks. Ask for the standard report.
- After each implementer report, spawn the **runner** with the chunk's verify commands. If anything fails, send the failure back to the same implementer (SendMessage) — do not start a new one.

## 4. Review
- When all chunks pass, spawn the **reviewer** on the branch. Fix Blockers via the implementer; re-run the runner; repeat until READY.

## 5. Close the phase
- Apply any **Plan drift** to the phase file and note it in `DECISIONS.md`.
- Confirm the phase's "Definition of done" line by line.
- Ask the owner before pushing or opening the PR. When approved: `git push -u origin <branch>` and `gh pr create` with a summary of steps done and decisions recorded.

## Cost discipline
- Do not spawn the architect for anything the phase file already answers.
- One implementer per chunk; reuse it for fixes.
- Keep raw test output out of your context — that is what the runner is for.
