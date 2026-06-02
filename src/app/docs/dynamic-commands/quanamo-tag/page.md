---
title: Quanamo — tag
---

`quanamo-tag` is the **local release workflow** for Quanamo projects — push packages, tag versions. **Never touches production servers.** Deploy is a separate step via [`quanamo-deploy`](/docs/dynamic-commands/quanamo-deploy). {% .lead %}

Folder-agnostic — operates on the current working directory's git repo and its declared path packages. Run from one of:

- `~/Herd/admin.quanamo.test/`
- `~/Herd/feedz.quanamo.test/`
- `~/Herd/kanban.quanamo.test/`

---

## Steps

| # | Action |
|---|---|
| 1a | Gather changelog: `git log --oneline $(git describe --tags --abbrev=0)..HEAD` for main + each path package |
| 1b | Categorise: Features / Bug fixes / Infrastructure / Config |
| 1c | If doc-worthy changes exist, recurse into [`quanamo-update-docs`](/docs/dynamic-commands/quanamo-update-docs) with the appropriate scope |
| 2 | For each path package in `composer.json`: commit dirty files, push, tag the package |
| 3 | Push main project + CHANGELOG entry |
| 4 | Read version from `CHANGELOG.md` |
| 5 | CI gate (currently vacuous on Quanamo — no `.github/workflows/`). If CI configured: `gh run list` once, schedule recurring 2-min poll if still running |
| 6 | `git tag v<version> && git push origin v<version>` |

---

## Version bump auto-decide

| Bump | When |
|---|---|
| **Patch** | bug fixes, config, dependency bumps |
| **Minor** | new features, improvements |
| **Major** | breaking changes, major rewrites |

Applied independently per package and per main project.

---

## Shared package handling

admin and feedz both depend on `quanamo/quanamo-core` as a path package. The release loop deals with this correctly: when admin's pass picks up a pending core tag bump, feedz's subsequent pass resolves against the new tag.

---

## Hard rules

- **Never SSH into production servers.** Local only.
- **Tag BEFORE deploy.**
- **No `gh run watch`** if CI ever lands — scheduled recurring poll, not blocking.

---

## Related

- [Quanamo — deploy](/docs/dynamic-commands/quanamo-deploy) — what runs after the tag
- [Quanamo — release](/docs/dynamic-commands/quanamo-release) — parent pipeline
- [Quanamo — update-docs](/docs/dynamic-commands/quanamo-update-docs) — Step 1c recurses here
- [Kraite — tag](/docs/dynamic-commands/kraite-tag) — sibling with profile gating + ingestion CI gate
