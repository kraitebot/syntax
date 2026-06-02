---
title: read-docs
---

`read-docs` reads and understands project documentation — the generic, project-agnostic version. {% .lead %}

---

## Resolve documentation path

Documentation lives in `docs/<project>` OUTSIDE the project directory. The docs root varies by environment — check BOTH and use whichever exists:

1. `~/Herd/docs/<project>/` (local Mac / Herd)
2. `~/docs/<project>/` (VPS / production)

Determine `<project>` from CWD:

| CWD contains | Project |
|---|---|
| kraite / kraite.com / admin.kraite.com / ingestion.kraite.com | `kraite` |
| quanamo / quanamo.com / admin.quanamo.com / feedz.quanamo.com | `quanamo` |
| olloma / olloma.com / olloma.dev | `olloma` |
| friday.waygou.com | `friday` |
| codiant.app / build.codiant.app | `codiant` |
| ralph-claude-code | `ralph-claude-code` |

Resolution: `ls ~/Herd/docs/<project>/ 2>/dev/null || ls ~/docs/<project>/`. Neither → ask Bruno.

---

## Scopes

| Invocation | Behaviour |
|---|---|
| `/do read-docs` | Read ALL documentation for the current project |
| `/do read-docs <scope>` | Read `02-features/<scope>/` + decisions/bugs related to scope in `03-logs/` |

---

## Hard rules

- **README first, no exceptions.** Reading feature docs without the index = ungrounded claims.
- If README doesn't exist, report that explicitly before proceeding.

---

## What to extract — required

- Business rules and constraints (cite doc file)
- Architecture decisions and the WHY (not just the what)
- API contracts and expected behaviours
- Known issues and workarounds (so you don't re-solve them)
- Domain-specific terminology (use these terms, don't paraphrase)

Missing any category → incomplete read. Go back.

---

## Related

- [update-docs](/docs/dynamic-commands/update-docs) — writer counterpart
- [Kraite — read-docs](/docs/dynamic-commands/kraite-read-docs) — Kraite-specific sibling (knows about credentials, deploy notes)
- [Quanamo — read-docs](/docs/dynamic-commands/quanamo-read-docs) — Quanamo-specific sibling
- [learn](/docs/dynamic-commands/learn) — alternative for understanding the codebase directly (not docs)
