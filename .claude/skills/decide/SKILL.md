---
name: decide
description: Record a resolved decision in docs/plan/DECISIONS.md — moves an Open item to Locked in the standard template, or adds a new Locked/Open entry. Usage: /decide <open item number or short title>: <the decision and why>
---

Update `docs/plan/DECISIONS.md` for: **$ARGUMENTS**

1. Read `docs/plan/DECISIONS.md`.
2. If `$ARGUMENTS` references an existing **Open** item (by number or title): replace that Open line with a strikethrough + "**Resolved:** see Locked", and append a new entry at the end of **Locked** using the template:
   ```
   ### <short title>            (<today YYYY-MM-DD>, decided by: owner | agent-with-owner-approval)
   **Decision:** …
   **Why:** …
   **Affects:** phase/step refs
   ```
3. If it is a new decision, add it to Locked (if the owner decided) or Open (if it still needs the owner), with the same template.
4. If the decision changes anything already written in `docs/plan/00-overview.md` §2 (locked-decision table) or a phase file, make that edit too and mention it.
5. Reply with the exact entry you added and the files touched. Do not commit.
