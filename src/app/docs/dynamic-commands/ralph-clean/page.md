---
title: Ralph — clean
---

`ralph-clean` resets Ralph's PRD + task queue + progress log to start a fresh phase or batch. Preserves the `## Codebase Patterns` section of the progress log — those learnings carry over. {% .lead %}

---

## Files reset

| File | Reset to |
|---|---|
| `docs/next-ralph-tasks.md` | Empty template with "Future Tasks" header |
| `scripts/ralph/prd.json` | Empty PRD shell (default `ralphInstructions`, empty `userStories`) |
| `scripts/ralph/progress.txt` | Clean progress log (preserved `## Codebase Patterns` section migrated over) |

---

## Flow

1. Extract the `## Codebase Patterns` section from the current `progress.txt`
2. Reset all three files to their templates
3. Re-insert the preserved patterns
4. Confirm what was cleaned

---

## When to use

- Starting a new batch of tasks
- Clearing out completed work
- Need a fresh slate after a chaotic run

---

## Related

- [Ralph — task](/docs/dynamic-commands/ralph-task) — add tasks to the new queue
- [Ralph — deploy](/docs/dynamic-commands/ralph-deploy) — turn queued tasks into prd.json
- [Ralph — archive](/docs/dynamic-commands/ralph-archive) — preserve old artefacts before cleaning
