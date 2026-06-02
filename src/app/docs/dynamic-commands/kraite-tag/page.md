---
title: Kraite — tag
---

`kraite-tag` is the Kraite **release workflow** — docs, packages, push, CI gate, tag main project. **Never touches production servers.** Deploy is a separate explicit step via [`kraite-deploy`](/docs/dynamic-commands/kraite-deploy). {% .lead %}

---

## Per-profile gating

The flow shape (analyse → push → tag main project) is the same across profiles. Only the **docs phase**, **path-package iteration**, and **CI gate** are conditional.

| Folder | Profile | Path packages? | Docs phase? | CI gate? |
|---|---|---|---|---|
| `ingestion.kraite.test` | ingestion | yes (kraitebot/core + brunocfalcao/step-dispatcher) | yes (full) | yes (mandatory) |
| `admin.kraite.test` / `console.kraite.test` / `kraite.test` | web-app(-with-queue) | none | no | no |
| `syntax.kraite.test` | static-site | none | no | no |

---

## Steps

| # | Action |
|---|---|
| 1a | Gather changelog since last tag (`git log --oneline $(git describe --tags --abbrev=0)..HEAD`); first-tag bootstrap defaults to `v0.1.0` |
| 1b | Categorise: Infrastructure / Features / Architecture / Bug fixes / Config |
| 1c | **Ingestion only** — recurse into [`kraite-update-docs`](/docs/dynamic-commands/kraite-update-docs) with scope matching the change type. This is where the syntax site refreshes happen |
| 1d | Commit doc changes on the Kraite docs repo if any |
| 2 | **Ingestion only** — iterate path packages, push and tag each |
| 3a | `gh auth setup-git` to prime the credential helper (catches stale HTTPS auth from prior sessions) |
| 3b | Push main project + CHANGELOG entry. Tag pre-flight: `gh api repos/.../permissions --jq .push` — if read-only on a `kraitebot/*` repo, retry with `GITHUB_PAT_KRAITEBOT` one-shot (never persisted in `git config`) |
| 4 | Read the version from `CHANGELOG.md` |
| 5 | **Ingestion only** — CI gate: `gh run list --branch master --limit 1 --json status,conclusion`. Schedule recurring check (every 2 min) if still running. **No `gh run watch`** (blocks/times out) and no sleep-polling |
| 6a | **Web-app + web-app-with-queue only** — verify `composer.production.json` is committed in HEAD (deploy would fail otherwise) |
| 6b | Tag-order sanity: highest existing tag must be ≤ NEW_VERSION by semver. Orphan higher tag pointing to older commit → "tag history drift" warning |
| 6c | `git tag v<version> && git push origin v<version>` |

---

## Version-bump auto-decide

Applied independently to each package AND to the main project:

| Bump | When |
|---|---|
| **Patch** | bug fixes, small tweaks, dependency bumps, config changes, typos |
| **Minor** | new features, meaningful improvements, new commands / endpoints, UI additions |
| **Major** | breaking changes, major rewrites, removed functionality, schema-breaking migrations |

---

## Hard rules

- **Never SSH into production servers.** This command is LOCAL ONLY.
- **Never run composer update / install on remote servers.** Never run artisan on remote.
- **Tag BEFORE deploy** — `composer update kraitebot/core` resolves by tag on prod; deploying without a fresh tag silently ships old code.
- **Never force-push** without Bruno's explicit approval.
- **CI gate is async, non-blocking.** Recurring 2-min scheduled poll → resume when green; never sleep / block / `gh run watch`.

---

## What kraite-tag does NOT do

`kraite-push` handles the changelog only. The syntax docs site refresh is **exclusive to kraite-tag** (and the kraite-release chain that calls tag). Pushes are not enough to refresh the reader-facing site.

---

## Related

- [Kraite — update-docs](/docs/dynamic-commands/kraite-update-docs) — Step 1c entry point; refreshes raw specs + this site
- [Kraite — push](/docs/dynamic-commands/kraite-push) — the simpler publish-only sibling
- [Kraite — deploy](/docs/dynamic-commands/kraite-deploy) — the next step after the tag lands
- [tag](/docs/dynamic-commands/tag) — generic version (waygou/odin-targeted)
