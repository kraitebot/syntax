---
title: memory
---

`memory` shows the current state of the librarian memory system — global / project CLAUDE.md line counts vs limits, event tallies, last distill timestamp, recent backups. {% .lead %}

---

## What it reads

| Source | Reported |
|---|---|
| `~/.claude/CLAUDE.md` | Lines in the Librarian Learnings section (limit: 100) |
| `./CLAUDE.md` if present | Total lines (limit: 80) |
| `./claude/learnings.jsonl` | Total events + unprocessed count |
| `./claude/.last_processed` | Last distill timestamp |
| `~/.claude/librarian/backups/` | Recent backups, latest one |

---

## Output shape

```
Librarian Memory Status
├── Global:  42/100 lines
├── Project: 28/80 lines
├── Events:  156 total, 12 unprocessed
├── Last distill: 2026-02-23 14:30
└── Backups: 3 (latest: 2026-02-23)
```

---

## Related

- [distill](/docs/dynamic-commands/distill) — force-process unprocessed events
- [memorize](/docs/dynamic-commands/memorize) — add a new learning
- [forget](/docs/dynamic-commands/forget) — remove a learning
