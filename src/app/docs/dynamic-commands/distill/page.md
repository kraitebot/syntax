---
title: distill
---

`distill` forces the librarian to process learnings now and update `CLAUDE.md`. {% .lead %}

---

## Process — mandatory order

1. Run the distill script:

```bash
MIN_EVENTS_TO_DISTILL=1 bash $HOME/.inomem/distill.sh "$(pwd)"
```

2. After completion, re-read **BOTH** `./CLAUDE.md` (if present) AND `~/.claude/CLAUDE.md`. Skipping = stale memory in session.

3. Report what changed in one concise diff summary — added / removed / modified entries. **Don't paraphrase; cite the actual added lines.**

4. Script failure → STOP. Report the error. **Never pretend success.**

---

## Related

- [memorize](/docs/dynamic-commands/memorize) — store a specific learning to persistent memory
- [memory](/docs/dynamic-commands/memory) — show librarian stats / recent activity
- [forget](/docs/dynamic-commands/forget) — remove a specific learning
