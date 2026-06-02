---
title: pull
---

`pull` syncs local repositories with remote. **Default mode is non-destructive.** Any clean reset requires explicit approval. {% .lead %}

---

## Safety mode — hard rules

| Mode | When | Behaviour |
|---|---|---|
| **Default (safe)** | Always, unless Bruno says otherwise | `git pull --rebase --autostash` — keeps local edits |
| **Clean reset (destructive)** | ONLY when Bruno explicitly says "discard local changes" / "clean reset" / "nuke local" | `git reset --hard HEAD && git clean -fd` before pulling |

Never destructively reset on ambiguous intent. Lost work = unacceptable. When in doubt → ask.

---

## Flow

| Step | Action |
|---|---|
| 1. Detect path packages | Find every `"type": "path"` repository in `composer.json` |
| 2. Pull or clone path packages (in order) | If directory exists and is a git repo → safe pull. If directory missing → clone from matching `"type": "vcs"` entry in composer.json, or composer.lock source URL |
| 3. Pull main project | Safe rebase + autostash |
| 4. Update dependencies | `composer update --no-interaction` to fetch latest commits of dev dependencies (e.g. `dev-master` VCS packages); `npm install` if `package.json` exists |
| 5. Build frontend | `npm run build` if `package.json` has a build script |
| 6. Migrations | `php artisan migrate --force --no-interaction` for Laravel projects |
| 6.5. Import guidelines (jarvis.waygou.com only) | `php artisan agent:import-guidelines` |
| 7. Re-cache for production | `php artisan config:cache && route:cache` |

---

## Output shape

```
## Pull Summary

### Package: vendor/package-name
- Branch: [branch name]
- Mode: [safe / clean-reset]
- Local changes discarded: [yes/no]
- Pull status: [Updated to <hash> / Already up to date / Cloned fresh]

### Main Project
- Branch / Mode / Local changes / Pull status
- Composer update: [Done / Skipped]
- NPM install: [Done / Skipped]
- Frontend build: [Done / Skipped]
- Migrations: [Done / Skipped]
- Config/Route cache: [Done / Skipped]
```

---

## Related

- [push](/docs/dynamic-commands/push) — opposite direction
- [commit](/docs/dynamic-commands/commit) — local commit (no push)
- [Kraite — push](/docs/dynamic-commands/kraite-push) — Kraite-flavoured push
