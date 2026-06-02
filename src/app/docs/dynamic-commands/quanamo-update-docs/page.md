---
title: Quanamo — update-docs
---

`quanamo-update-docs` keeps Quanamo documentation current with infrastructure, architecture, and feature changes. {% .lead %}

---

## Surfaces

| Location | Purpose | Update when... |
|---|---|---|
| `~/Herd/docs/quanamo/` | Functional specs | Architecture changes, feature behaviour change |
| `~/Herd/docs/quanamo/README.md` | Index | New docs added |
| `~/Herd/.credentials/quanamo/servers.json` | Odin server details | IP change, stack change, new services |
| `~/Herd/.credentials/quanamo/api-keys.json` | AI provider keys | Key rotation, new provider added |
| `~/Herd/admin.quanamo.test/deploy.sh` (script-as-doc) | admin deploy contract | Backup shape, supervisor program, etc. change |
| `~/Herd/feedz.quanamo.test/deploy.sh` | feedz deploy contract | same |
| `~/Herd/kanban.quanamo.test/deploy/README.md` | kanban MySQL backup gate, Redis index, `active.flag` rules | kanban-specific deploy semantics change |

App-specific operational docs (the per-app `deploy/` folder) take precedence over central docs for app-specific detail. Don't duplicate that content into `~/Herd/docs/quanamo/`.

---

## Scopes

| Invocation | Behaviour |
|---|---|
| `/do quanamo-update-docs` | Update everything relevant to recent git changes |
| `/do quanamo-update-docs servers` | servers.json + Horizon config |
| `/do quanamo-update-docs deploy` | deploy notes / per-app `deploy.sh` |
| `/do quanamo-update-docs <feature>` | Matching feature folder |

---

## Global guidelines routing — mandatory

Generic guidelines (PHP / Laravel / git / tests / debugging conventions) do NOT belong in Quanamo docs. They live in `~/.claude/rules/*.md` (`laravel.md`, `ui.md`, `frontend.md`, `database.md`, `debugging.md`, `testing.md`, `git.md`). Detect generic content BEFORE writing into Quanamo docs and route to the matching rule file.

---

## Writing rules — enforced

- **80-char line wrap.**
- **Functional specs only.** Code details BANNED — no line-by-line code, no method signatures, no variable names. If it's in the code, don't duplicate it in docs.

---

## Hard rules

- **README first**, no exceptions.
- **Update README.md** if new files were created.

---

## Related

- [Quanamo — read-docs](/docs/dynamic-commands/quanamo-read-docs) — reader counterpart
- [Quanamo — tag](/docs/dynamic-commands/quanamo-tag) — calls into this at Step 1c
- [update-docs](/docs/dynamic-commands/update-docs) — generic project-agnostic version
- [Kraite — update-docs](/docs/dynamic-commands/kraite-update-docs) — sibling with reader-site refresh
