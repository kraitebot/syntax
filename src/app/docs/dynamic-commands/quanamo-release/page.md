---
title: Quanamo — release
---

`quanamo-release` is the **end-to-end release pipeline** for the three Quanamo apps. Tests, tag, deploy, warmup, health check — all gated, fail-fast on any phase. {% .lead %}

---

## Single profile

Unlike Kraite, Quanamo has exactly **one** profile: odin web. No CWD detection. The release always runs against:

- `~/Herd/admin.quanamo.test`  → `/home/odin/admin.quanamo.com`  (PostgreSQL master, runs core migrations)
- `~/Herd/feedz.quanamo.test`  → `/home/odin/feedz.quanamo.com`  (shares admin's PostgreSQL DB; no migrations of its own)
- `~/Herd/kanban.quanamo.test` → `/home/odin/kanban.quanamo.com` (owns its own MySQL DB; own migrations)

Run from anywhere on disk — the dispatchers operate on the project folders by absolute path.

---

## Phases

Strict order. AFTER the local phase that prepares its inputs.

| # | Phase | Touches | Hard gate? |
|---|---|---|---|
| 1 | Tests | local | yes — any failure stops the pipeline |
| 2 | Tag | local + GitHub | recurses into [`quanamo-tag`](/docs/dynamic-commands/quanamo-tag) per project |
| 3 | Deploy | odin | recurses into [`quanamo-deploy`](/docs/dynamic-commands/quanamo-deploy) — admin → feedz → kanban |
| 4 | Warmup | odin | recurses into [`quanamo-warmup`](/docs/dynamic-commands/quanamo-warmup) |
| 5 | Health | odin | recurses into [`quanamo-health`](/docs/dynamic-commands/quanamo-health) |
| 6 | Cleanup | local | cancel scheduled polls, report |

---

## Modifiers

| Modifier | Effect |
|---|---|
| `skip-tests` | Skip Phase 1 — dangerous, only for pure config/docs changes |
| `skip-ci` | **Accepted but no-op** — none of the Quanamo repos have a `.github/workflows/` directory, so the CI gate is already vacuous |

---

## Test phase (Phase 1)

Detection cascade per project — `vendor/bin/pest` present → pest directly with explicit 512M memory; pest absent but `phpunit.xml` / `tests/Pest.php` / `pest.xml` present → `php artisan test --compact`; nothing → "no test suite — skipped".

Order: admin → feedz → kanban. Pipes through `tail` are BANNED — they clobber `$?` and a missing binary silently reports green.

If any suite fails → STOP. Do NOT tag, deploy, warmup, or health-check.

{% callout title="Why vendor/bin/pest direct, not the artisan wrapper" %}
The Laravel test runner wrapper triggers Pest's browser-plugin shutdown hook, which can blow the default 128 MB memory limit on `symfony/console/Input/Input.php:40` and surface as a fatal AFTER the suite passes — masking a green run as a failure. `vendor/bin/pest -d memory_limit=512M` bypasses that. PHPUnit-only projects (feedz) don't have the wrapper-shutdown problem, so `php artisan test --compact` is fine.
{% /callout %}

---

## Deploy phase (Phase 3)

Three apps, in order: admin → feedz → kanban.

- **admin** — PostgreSQL backup → migrations → `composer install --no-dev` → frontend build → cache rebuild
- **feedz** — shares admin's DB, no migrations → `composer install --no-dev` → frontend build → cache rebuild
- **kanban** — MySQL backup → migrations → `composer install --no-dev` → frontend build → cache rebuild

DB backups are HARD gates: any non-zero `pg_dump` / `mysqldump` exit, or a snapshot smaller than 1KB, aborts that app's deploy before migrations run. Backups stay forever in `db-backups/`.

`dev-master` packages are forbidden in production — `deploy.sh` aborts if `composer.lock` ships any.

---

## Hard rules

- **One profile, one server.** No CWD detection, no fleet logic.
- **Tests are the first hard gate.** Detect-first then run unmasked — never swallow pest's exit code with `|| echo`.
- **Tag BEFORE deploy.** Server pulls by tag, not by branch.
- **admin deploys first.** PostgreSQL migrations land there; feedz reads the same DB.
- **No `dev-master` in production.**
- **DB backups are HARD gates per app.**
- **Don't touch `kanban-scheduler`'s `active.flag` by hand.** Package-managed under step-dispatcher v1.12+.
- **Cancel all scheduled polls at the end.** Don't leak watcher loops between releases.

---

## Error recovery

| Failure | Action |
|---|---|
| Tests fail | Fix, re-run `/do quanamo-release` |
| Deploy fails on one app | Others may still be fine. `/do quanamo-deploy admin\|feedz\|kanban` for just the failing one |
| Migrations failed | Restore from the backup written immediately before — see [`quanamo-deploy`](/docs/dynamic-commands/quanamo-deploy) |
| Health degraded | System is live but degraded. Investigate; don't roll back tags blindly |

---

## Related

- [Quanamo — tag](/docs/dynamic-commands/quanamo-tag) — Phase 2 entry point
- [Quanamo — deploy](/docs/dynamic-commands/quanamo-deploy) — Phase 3 entry point
- [Quanamo — warmup](/docs/dynamic-commands/quanamo-warmup) — Phase 4 entry point
- [Quanamo — health](/docs/dynamic-commands/quanamo-health) — Phase 5 entry point
- [Kraite — release](/docs/dynamic-commands/kraite-release) — the sibling pipeline (multi-profile, multi-server)
