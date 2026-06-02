---
title: memorize
---

`memorize` stores a learning, decision, pattern, or fix to **persistent memory** (Continuous Claude PostgreSQL) for future sessions. {% .lead %}

---

## Learning types

| Type | Use when |
|---|---|
| `WORKING_SOLUTION` | A fix or approach that worked |
| `FAILED_APPROACH` | Something that didn't work (avoid repeating) |
| `CODEBASE_PATTERN` | A pattern discovered in the codebase |
| `ARCHITECTURAL_DECISION` | A design choice and its rationale |
| `USER_PREFERENCE` | Bruno's preferred approach or style |
| `ERROR_FIX` | How a specific error was resolved |
| `OPEN_THREAD` | Unfinished work to resume later |

---

## Process — mandatory order

1. **Resolve content**
   - With argument → that IS the learning. Store verbatim intent; never paraphrase away the detail
   - No argument → ASK Bruno. Never infer from conversation history. Never guess what "should" be memorable
2. **Classify** — pick exactly one type from the table. None fit → ask, don't invent
3. **Tags** — extract 2-5 specific tags. No generic ("misc", "stuff", "general")
4. **Store** via `~/Continuous-Claude-v3/opc/scripts/core/store_learning.py` with `--session-id`, `--type`, `--content`, `--context`, `--tags`, `--confidence high`
5. **Update persistent memory affordance** (e.g. `MEMORY.md` in project's memory folder) — concise, grouped by topic: Key Patterns, Critical Rules, API Quirks, Workflows, Error Solutions

---

## Recall

```bash
cd ~/Continuous-Claude-v3/opc && PYTHONPATH=. uv run python scripts/core/recall_learnings.py \
  --query "<search terms>" --k 5
```

---

## Output

Confirm: type, content stored, tags applied, memory ID returned.

---

## Related

- [forget](/docs/dynamic-commands/forget) — remove a specific learning
- [distill](/docs/dynamic-commands/distill) — process pending events into CLAUDE.md
- [memory](/docs/dynamic-commands/memory) — show librarian stats
