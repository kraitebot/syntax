---
title: update-docs
---

`update-docs` updates project documentation — functional and architectural details — for any project whose docs live under `docs/<project>/`. Generic, project-agnostic sibling of [`kraite-update-docs`](/docs/dynamic-commands/kraite-update-docs) / [`quanamo-update-docs`](/docs/dynamic-commands/quanamo-update-docs). {% .lead %}

---

## Resolve docs path

Check BOTH, use whichever exists:

1. `~/Herd/docs/<project>/` (local Mac / Herd)
2. `~/docs/<project>/` (VPS / production)

Project determined from CWD per the same table as [`read-docs`](/docs/dynamic-commands/read-docs).

---

## Hard gate

**Read `<docs-path>/README.md` FIRST** (if it exists). Writing docs without knowing the structure = misplaced content.

---

## Global guidelines routing — mandatory

If the content is a GENERIC guideline (applies to ALL projects, not specific to this project's features / infrastructure / domain), it does NOT belong in project docs. Route to `~/.claude/rules/*.md`:

| Topic | File |
|---|---|
| Laravel / PHP / Eloquent / migrations / form requests | `~/.claude/rules/laravel.md` |
| Blade / Tailwind / components / labels / theming | `~/.claude/rules/ui.md` + `~/.claude/rules/frontend.md` |
| SQL / DB queries / table inspection | `~/.claude/rules/database.md` |
| Logs / error inspection / root-cause flow | `~/.claude/rules/debugging.md` |
| Pest / PHPUnit / factories / coverage | `~/.claude/rules/testing.md` |
| Commit / push / branch / PR conventions | `~/.claude/rules/git.md` |

Detect generic content BEFORE writing into project docs. If unsure → ask Bruno.

---

## Writing rules — enforced

- **80-char line wrap**
- **Functional specs only.** Code details BANNED — no line-by-line code, no method signatures, no variable names. If it's in the code, don't duplicate it in docs

**DO document:** purpose and behaviour, design decisions (the "why"), component interactions, data flows, configuration options, business rules.

**BANNED:** line-by-line code, implementation details readable from code, variable names, method signatures, code snippets > 3 lines.

---

## Documentation structure

| Folder | Purpose |
|---|---|
| `00-context/` | System architecture, vision, assumptions |
| `01-product/` | Product requirements and PRD |
| `02-features/<name>/` | Feature-specific tech designs |
| `03-logs/` | Bug log, decisions log, implementation log |
| `04-process/` | Development workflow, definition of done |

---

## Scopes

| Invocation | Behaviour |
|---|---|
| `/do update-docs` | Update all docs based on recent git changes |
| `/do update-docs <topic>` | Only docs matching the topic |

---

## WhereAreWe.md — mandatory, non-skippable

After ANY doc update, update `$(git rev-parse --show-toplevel)/WhereAreWe.md`. Create if missing. Skipping = command incomplete.

Required sections: Date, Session summary, Current state (test suite status, PHPStan/static analysis), WIP (exact file paths + line numbers if mid-task), Pending items, Key decisions made this session. No hand-waving. Concrete or it's not there.

---

## Related

- [read-docs](/docs/dynamic-commands/read-docs) — reader counterpart
- [Kraite — update-docs](/docs/dynamic-commands/kraite-update-docs) — Kraite sibling (refreshes this syntax site too)
- [Quanamo — update-docs](/docs/dynamic-commands/quanamo-update-docs) — Quanamo sibling
- [tag](/docs/dynamic-commands/tag) — Step 0 entry point for the odin release pipeline
