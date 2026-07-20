---
title: Kraite — deploy
---

`kraite-deploy` ships the latest tagged code to its production target. Behaviour is decided by the active profile: ingestion fans out across the trading fleet; web projects (admin / kraite / syntax) land on pheme. {% .lead %}

**Tag-before-deploy is a hard rule.** No deploy without a tag. The deploy target checks out the tagged commit, never branch HEAD. Run [`kraite-tag`](/docs/dynamic-commands/kraite-tag) first if not already tagged.

---

## Invocation

| Usage | Behaviour |
|---|---|
| `/do kraite-deploy` (from `ingestion.kraite.test`) | Full multi-server sequence — cooldown all → deploy all → workers first → athena last |
| `/do kraite-deploy <hostname>` (ingestion only) | Single-server deploy. Hostname ∈ `athena`, `eos`, `iris`, `nyx`, `hemera`, `palaemon`, `aristaeus`, `tyche` |
| `/do kraite-deploy` (from any web project) | Single-host pheme deploy — hostname argument is ignored |

---

## Ingestion: full deploy sequence

| Phase | Action |
|---|---|
| 1. Cool down all | athena + 7 workers in parallel via `php artisan kraite:cooldown`; wait for `STATUS:COOLED_DOWN` |
| 2. Determine tag | `git tag --sort=-v:refname | head -1` |
| 3. Deploy code | All 8 boxes in parallel run `DEPLOY_TAG=v<version> bash deploy.sh`. Wait for `Deploy complete` everywhere |
| 4. Warmup workers | eos + iris + nyx + hemera + palaemon + aristaeus + tyche in parallel via [`kraite-warmup`](/docs/dynamic-commands/kraite-warmup) |
| 5. Warmup athena | athena last — resumes dispatch daemon, both WS streams, user-data and indicators Horizon pools, scheduler cron |

The full-stop between phases is intentional. Either the whole fleet is on the OLD tag (before Phase 3) or the whole fleet is on the NEW tag (after Phase 3). No moment where athena dispatches new-code jobs to workers still on old code.

Cooldown pauses both dispatcher prefixes, then waits for executable leaf steps
in either prefix. A waiting workflow parent with a populated child tree is not
an API call and does not block shutdown; any active descendant leaf still does.
This prevents the pause itself from deadlocking thousands of resumable parent
workflows while preserving the hard gate around real trading work.

{% callout title="Why workers warm before athena" %}
With the current 10-box fleet, athena no longer holds a self-sufficiency footprint on positions / orders / priority queues. Its Horizon pools are `user-data-stream` (5), `indicators` (16), and the athena connectivity probe (1). Workers MUST be the first consumers up. The instant `/etc/cron.d/kraite-scheduler` is restored on athena and the first cron tick fires, dispatched jobs flow straight to workers without piling up in Redis.

**Historical note (incident 2026-05-24, v1.49.8 release):** the previous flow was athena-first, workers-second. Warming athena resumed the scheduler before workers were deployed, which filled the worker queue (1298 pending) and tripped `deploy.sh`'s `STATUS:COOLED_DOWN` hard gate on each worker. The release only completed via a sed-stripped `deploy-force.sh` that bypassed the cooldown check, plus the `FORCE_DEPLOY=1` env-var bypass added to `deploy.sh` afterwards. The flow above is the structural fix.
{% /callout %}

---

## Fleet-topology drift check

`deploy.sh` step 10 runs `php artisan kraite:verify-fleet-topology --fail-on-drift` after `config:cache`. This asserts every key in `config('kraite.horizon.workers')` has a matching `servers.hostname` row — without that alignment the StepRouter cannot map banned IPs back to hostname candidates and ban filtering silently fails. A failed check exits `deploy.sh` with code 1 before `horizon:terminate` respawns workers against a broken config. If `Fleet topology drift detected:` appears in the deploy output, STOP — reconcile `config/kraite.php` vs the `servers` table on hyperion before retrying.

---

## DB backup hard gate (ingestion only)

`deploy.sh` writes a fresh `mysqldump --single-transaction --routines --triggers --events | gzip` snapshot to `/home/athena/ingestion.kraite.com/db-backups/pre-deploy-YYYYMMDD_HHMMSS.sql.gz` BEFORE `php artisan migrate --force` runs. If the dump exits non-zero, or produces a snapshot smaller than 1KB, the deploy aborts and migrations are NEVER executed. Old backups are never deleted — full point-in-time history sits in `db-backups/` for rollback.

For web projects, no auto-backup — Bruno's call if a backup step is needed before risky migrations.

---

## Web profiles (admin / kraite)

Single-host deploy on pheme. Both PHP profiles use the **composer manifest swap** pattern: `composer.json` (path-symlinked dev manifest with `../packages/*` constraints) is replaced on the server with `composer.production.json` (VCS repos on GitHub, versioned constraints) after `git checkout v<version>`. This ends hand-edited composer.json on the server.

Per-deploy contract:

1. **Pre-flight (local):** verify tag exists locally + on remote, `composer.production.json` committed in the tag, `gh auth setup-git` has run, admin's `.env` has `MAIL_MAILER` set (warn-but-don't-block).
2. **Cool down:** `php artisan down --retry=15 --secret=<random>` (the secret lets Bruno bypass maintenance in his browser).
3. **Deploy:** `git fetch --tags`, `git checkout v<version>`, swap manifest, `composer update --no-dev --optimize-autoloader`, `npm install && npm run build`, post-build sanity check (assert `.h-screen` lands in compiled CSS — proves Tailwind content globs scanned vendor templates), `php artisan migrate --force`, rebuild caches.
4. **Permission reset:** post-checkout `find` resets file 644 / dir 755 / storage+bootstrap/cache 775, group `www-data`, `.env` locked to 600, exec bits restored on `artisan` and `node_modules/.bin`. Required because pheme's `umask 027` makes git checkout / npm install / composer write files unreadable by PHP-FPM (`www-data`) by default. Deploy notes lesson 37.
5. **Health check:** artisan version, DB connected, kraitebot/core + step-dispatcher versions match latest tag, no `dev-*` packages, mail config present.
6. **Warmup:** recurse into [`kraite-warmup`](/docs/dynamic-commands/kraite-warmup).

---

## Syntax profile (static site)

`/home/pheme/syntax.kraite.com/` is the nginx document root, NOT a git checkout — only build artefacts (`index.html`, `_next/`, `docs/`). Source lives only on Bruno's Mac at `~/Code/syntax.kraite.test/`. Therefore: **build local → rsync `out/` → nginx docroot.** Do NOT try to `git fetch / checkout / npm install / npm run build` on pheme — there is no source there. The rsync runs as `pheme` (key-only) so the destination files are already `pheme:pheme`; nginx (`www-data`) traverses `/home/pheme` via group membership.

---

## Hard rules

- **No dev-master on production.** Deploy aborts if `composer.lock` shows any `dev-*` packages.
- **Migrations only run on ingestion (athena) for trading.** Web projects run their own against their own DB on hyperion. Syntax has no DB.
- **`deploy.sh` runs as root** because it needs `chown`/`chmod`; it delegates project commands to the per-hostname user via `su - <hostname>`.
- **TAG kraitebot/core BEFORE deploying** — `composer update kraitebot/core` pulls by tag; deploying without tagging silently ships old code.
- **Never run `migrate:fresh` on production.** Wipes data. Emergency-only with explicit Bruno approval and an `APP_ENV=local` toggle.

---

## Related

- [Kraite — tag](/docs/dynamic-commands/kraite-tag) — must run first
- [Kraite — warmup](/docs/dynamic-commands/kraite-warmup) — Phase 4/5 finisher
- [Kraite — release](/docs/dynamic-commands/kraite-release) — the parent pipeline that wraps deploy + warmup + health
- [Kraite — profile](/docs/dynamic-commands/kraite-profile) — the per-profile branching table
