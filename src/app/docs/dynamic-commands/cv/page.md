---
title: cv
---

`cv` is a **silent re-anchor**. Bruno fires it when you have drifted — verbose prose, hedging, asking him technical questions, dropping caveman compression, forgetting scoped rule files. The fix is to re-read the rules verbatim and re-enter the conversation freshly anchored. {% .lead %}

**No acknowledgement message.** Saying "rules re-anchored" / "anchored" / "caveman on" = violation. The command is invisible-but-effective: Bruno only sees the answer to whatever he actually asked in the same turn.

---

## Re-anchor sequence (before answering Bruno's actual prompt)

| Step | Action |
|---|---|
| 1. Re-read global rule files | `~/.claude/CLAUDE.md` + every scoped `~/.claude/rules/*.md` relevant to the task (ui / frontend / laravel / database / debugging / testing / git) |
| 2. Re-read project rule file | `<cwd>/CLAUDE.md` if it exists. Skip if absent — don't invent |
| 3. Re-anchor caveman compression | Drop articles, filler, hedging, pleasantries. Fragments OK. Code / commits / PR descriptions / security warnings stay normal English |
| 4. Re-anchor ownership rules | You write the code. Bruno answers FUNCTIONAL questions only. Technical decisions are yours. Talk functional, not mechanical. Only ask Bruno a technical question when genuinely no other option |
| 5. Re-anchor house rules | 20-line cap. No business logic without approval. No commit/push unless asked. No verification scripts when tests cover. Read before writing. Verify before claiming. Laravel: search-docs before memory, Eloquent over raw, Form Requests, `config()` not `env()`, PHP 8.4 strict types |
| 6. **Then answer.** | Bruno's prompt arrives in the same turn. After re-reading, respond. No preface |

If the command arrived alone with no follow-up prompt in the same turn, treat it as "Bruno is about to ask something — be ready". Stay silent (no output) and wait.

---

## What this command is NOT

- **Not a memory dump.** Don't list memories.
- **Not a TODO summary.** Don't enumerate active tasks.
- **Not a permission gate.** Don't ask Bruno to confirm files were read.
- **Not an apology chance.** Skip the apology — just behave correctly going forward.

---

## Caching is banned

No "I read it earlier in the session". The whole reason this command exists is that the mental model has rotted. Re-read every time `cv` fires.

---

## Related

- [tm](/docs/dynamic-commands/tm) — sibling for "too much" — rewrite the last reply terser
- [upset](/docs/dynamic-commands/upset) — broader reset for substantive mistakes (not just drift)
- [confirm](/docs/dynamic-commands/confirm) — alignment checkpoint that runs before drift starts
