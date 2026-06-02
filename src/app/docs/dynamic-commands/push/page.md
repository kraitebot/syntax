---
title: push
---

`push` commits any uncommitted changes and **publishes** to remote repositories — packages first (with `composer.lock` re-resolution), then main project. {% .lead %}

The working tree must be CLEAN after this command returns — pre-existing dirty files included. No orphaned changes left behind.

---

## Workflow

| Step | Action |
|---|---|
| 0.1. CHANGELOGs | Update CHANGELOG.md in every dirty repo. Bump patch + today's date. Category tags: `[NEW FEATURE]` / `[BUG FIX]` / `[IMPROVED]` / `[SECURITY]` / `[DEPENDENCIES]` |
| 0.2. READMEs | Check README.md in every dirty repo. If changes touch public API / commands / config / installation → update. Report "README: already accurate" if no update needed |
| 0.3. Export Guidelines (homer / jarvis only) | `php artisan agent:export-guidelines` |
| 1. Detect path packages | Find every `"type": "path"` repository in `composer.json` |
| 2. Push path packages first (in order) | Update CHANGELOG, determine GitHub user from remote URL, authenticate, commit, push |
| 3. Update composer.lock | If any path packages pushed: `composer update <vendor/package1> <vendor/package2> ... --no-interaction` to capture new SHAs |
| 4. Push main project | Commit incl. updated `composer.lock`, push |

---

## GitHub authentication — two modes

### Mode A: `gh` CLI available (VPS / full dev)

1. Extract GitHub user from remote URL (`git@github.com:brunocfalcao/repo.git` → `brunocfalcao`)
2. `GH_TOKEN= gh auth switch --user <username>`

### Mode B: no `gh` CLI (sandbox / restricted)

1. Check `~/Herd/.credentials/credentials` for `GITHUB_PAT_*` entries
2. Extract GitHub user from remote URL
3. SSH remote → convert to HTTPS with matching PAT: `git remote set-url origin https://<user>:<PAT>@github.com/<user>/<repo>.git`

Known PATs: `GITHUB_PAT_BRUNOCFALCAO`, `GITHUB_PAT_MARTINGALIAN`, `GITHUB_PAT_KRAITEBOT`, `GITHUB_PAT_QUANAMO`.

---

## Conflict resolution

| Failure | Action |
|---|---|
| Push rejected (divergence) | Inspect with `git log --oneline --left-right HEAD...origin/<branch>`. Prefer non-destructive: `git pull --rebase`, then push |
| Force-push needed | **Explicit Bruno approval required.** NEVER `--force`, only `--force-with-lease` |

---

## Hard rules

- **Never `--force`.** Only `--force-with-lease`, and only with explicit approval.
- **composer update fails → STOP.** Don't push a broken lock file.
- **Never leave any repo broken.** Half-pushed chain = violation. All push or roll back.
- **Never skip hooks** (`--no-verify`). Hook fails → fix root cause.

---

## Related

- [commit](/docs/dynamic-commands/commit) — local-only sibling, no publish
- [pull](/docs/dynamic-commands/pull) — opposite direction
- [Kraite — push](/docs/dynamic-commands/kraite-push) — Kraite-flavoured (single GitHub user, no PAT switching)
- [tag](/docs/dynamic-commands/tag) — full release pipeline that includes push as a step
