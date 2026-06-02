---
title: forget
---

`forget` removes a specific learning from `./CLAUDE.md` and/or `~/.claude/CLAUDE.md` — the description, keyword, or quoted text Bruno asks about. {% .lead %}

---

## Process — strict

1. Read **BOTH** `./CLAUDE.md` AND `~/.claude/CLAUDE.md` before any edit
2. Locate the entry matching the argument. Multiple matches → show them all, ask Bruno which to remove. **NEVER guess.**
3. Remove ONLY that entry. Surrounding entries stay byte-identical
4. Report: file path, exact text removed, line range. **No paraphrasing** — show what was deleted verbatim
5. Zero matches → say "no match for `<argument>`" and STOP. Never delete something "close enough"

---

## Input handling

- **With argument** → find entry matching the argument and remove it
- **No argument** → ask Bruno what to forget

---

## Related

- [memorize](/docs/dynamic-commands/memorize) — store a learning (opposite operation)
- [distill](/docs/dynamic-commands/distill) — force the librarian to process and update CLAUDE.md
- [memory](/docs/dynamic-commands/memory) — show librarian stats
