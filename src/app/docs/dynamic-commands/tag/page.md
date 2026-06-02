---
title: tag
---

`tag` is the **full release workflow** for projects targeting the **odin** production VPS — push changed packages, tag everything, deploy. Used by the waygou stack (olloma, atelierborges, codiant, etc.) and any project Bruno's `~/Herd/.credentials/vps.json` resolves to odin. {% .lead %}

---

## Odin connection

| Field | Value |
|---|---|
| Host | 204.168.242.59 |
| User | odin |
| SSH key | `~/.ssh/id_ed25519_waygou` |
| Auth | Key-based, no password |
| Connect | `ssh -i ~/.ssh/id_ed25519_waygou -o IdentitiesOnly=yes odin@204.168.242.59` |

Source of truth: `~/Herd/.credentials/vps.json` (+ `~/Herd/.credentials/quanamo/servers.json` for full odin spec).

History: the old `91.107.213.11` / `waygou` VPS was decommissioned on 2026-05-10. Olloma + Quanamo + other web projects now share odin.

---

## Production path convention

Local Herd folder names use a `.test` suffix; production strips that and uses the real public TLD (`.com`, `.ch`, …).

| Local | VPS |
|---|---|
| `~/Herd/olloma.test/` | `/home/odin/olloma.com/` |
| `~/Herd/atelierborges.test/` | `/home/odin/atelierborges.ch/` |
| `~/Herd/feedz.quanamo.test/` | `/home/odin/feedz.quanamo.com/` |

Detected at runtime: extract project prefix from `$(basename $(pwd))`, then `ls -d /home/odin/${PROJECT_PREFIX}.* | head -n 1` on odin to find the right TLD.

---

## Steps

| # | Action |
|---|---|
| 0 | If the project has `/docs`, recurse into [`update-docs`](/docs/dynamic-commands/update-docs) to refresh. Update READMEs |
| 1 | For each path package in `composer.json` with changes: recurse into [`push`](/docs/dynamic-commands/push), read its CHANGELOG version, `git tag v<version>` + push tag |
| 2 | Recurse into [`push`](/docs/dynamic-commands/push) on main project |
| 3 | Read latest version from `CHANGELOG.md` |
| 4 | `git tag v<version> && git push origin v<version>`. Tag exists → bump patch + retry |
| 5 | Deploy to odin: `git fetch --tags`, `git checkout master`, `git pull --ff-only`, **`composer install`** (NOT update — honours committed lock file), `php artisan migrate --force`, `config:cache`, `route:cache`. If `package.json` → `npm install && npm run build`. If `config/horizon.php` → `php artisan horizon:terminate` |
| 6 | Verify: `brunocfalcao/*` + framework versions on prod match latest tag; smoke-test `curl https://${SITE_DOMAIN}` → 200 |

{% callout title="Why composer install, not composer update, on prod" %}
`install` honours the lock file committed in Step 2; `update` would re-resolve constraints on prod and could pull versions you haven't tested locally. The lock file is the contract; prod must honour it.
{% /callout %}

---

## Version-bump auto-decide

Applied independently per package and main project:

| Bump | When |
|---|---|
| **Patch** | bug fixes, small tweaks, dependency bumps, config changes, typos |
| **Minor** | new features, meaningful improvements, new commands / endpoints, UI additions |
| **Major** | breaking changes, major rewrites, removed functionality, schema-breaking migrations |

---

## Hard rules

- **Use `composer install`, not `composer update`.**
- **Host key mismatch on odin** → STOP. Do NOT silently overwrite `~/.ssh/known_hosts`. Ask Bruno before accepting a new fingerprint.
- **Never `migrate:fresh` / `migrate:reset` / `db:wipe` on prod.**
- **composer install fails** → STOP. Don't proceed with migrations or cache.
- **Tag already exists** → bump patch + retry.
- **Never leave odin broken.** If deploy fails mid-way, report exactly what completed and what didn't.

---

## Related

- [push](/docs/dynamic-commands/push) — Step 1/2 entry point
- [update-docs](/docs/dynamic-commands/update-docs) — Step 0 entry point
- [Kraite — tag](/docs/dynamic-commands/kraite-tag) — Kraite sibling (multi-profile, no deploy in the command itself)
- [Quanamo — tag](/docs/dynamic-commands/quanamo-tag) — Quanamo sibling (multi-app, also no deploy in the command)
