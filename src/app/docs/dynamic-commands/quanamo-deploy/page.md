---
title: Quanamo — deploy
---

`quanamo-deploy` ships the latest tagged code for the Quanamo feedback platform to the odin production server. Three Laravel apps share the box — `admin.quanamo.com`, `feedz.quanamo.com`, `kanban.quanamo.com` — each with its own `deploy.sh`. {% .lead %}

Unlike Kraite, Quanamo has exactly one server. There's no fleet orchestration: iterate the three apps in a fixed dependency order, gate on health, recurse into warmup.

---

## Server

| Field | Value |
|---|---|
| Host | 204.168.242.59 |
| User | **odin** (SSH directly as odin, NOT root) |
| SSH key | `~/.ssh/id_ed25519_waygou` |
| admin | `/home/odin/admin.quanamo.com` — PostgreSQL master, runs core migrations |
| feedz | `/home/odin/feedz.quanamo.com` — shares admin's PostgreSQL DB, no own migrations |
| kanban | `/home/odin/kanban.quanamo.com` — owns its own MySQL DB (`kanban_quanamo`) |

All commands run as `odin`. No `su` needed — odin IS the project user. System commands use `sudo`.

---

## Invocation

| Usage | Behaviour |
|---|---|
| `/do quanamo-deploy` | Full sequence: admin → feedz → kanban → health → warmup |
| `/do quanamo-deploy admin` | admin only |
| `/do quanamo-deploy feedz` | feedz only |
| `/do quanamo-deploy kanban` | kanban only |

---

## Sequence

| Step | Action |
|---|---|
| 1. Determine tag | `git tag --sort=-v:refname | head -1` |
| 2. Deploy admin | `DEPLOY_TAG=v<version> bash deploy.sh` — runs core migrations against PostgreSQL |
| 3. Deploy feedz | Same shape — no migrations, shares admin's DB |
| 4. Deploy kanban | Same shape — its own MySQL migrations, its own `db-backups/` |
| 5. Health check | artisan version, DB connection per app, package versions, no `dev-*` |
| 6. Warmup | Recurse into [`quanamo-warmup`](/docs/dynamic-commands/quanamo-warmup) |

---

## DB backup hard gates (per app that owns a DB)

| App | Backup command | Path |
|---|---|---|
| admin (PostgreSQL) | `pg_dump -U odin quanamo | gzip` | `/home/odin/admin.quanamo.com/db-backups/pre-deploy-YYYYMMDD_HHMMSS.sql.gz` |
| kanban (MySQL) | `mysqldump -u odin kanban_quanamo | gzip` | `/home/odin/kanban.quanamo.com/db-backups/pre-deploy-YYYYMMDD_HHMMSS.sql.gz` |

The dump runs BEFORE `php artisan migrate --force`. If the dump exits non-zero OR produces a snapshot smaller than 1KB, the deploy aborts and migrations are NEVER executed. Old backups are never deleted — full point-in-time history sits in `db-backups/` for rollback.

---

## Hard rules

- **Core migrations run ONLY on admin.** feedz shares the same PostgreSQL DB and never runs its own migrations.
- **kanban migrations run on kanban.** Own DB, own migration history.
- **`APP_ENV=production` on odin.**
- **Tag BEFORE deploy.** Always run [`quanamo-tag`](/docs/dynamic-commands/quanamo-tag) first.
- **`deploy.sh` runs as odin** — no su needed.
- **No `dev-master` in production.**
- **A failure on kanban must NOT roll back admin or feedz, and vice-versa.** Each app has its own `deploy.sh` and its own backup.
- **kanban `active.flag` is package-managed** (step-dispatcher v1.12+). Don't remove it during deploy. Don't re-arm it during warmup. `php artisan down` is enough to pause inbound enqueues.

---

## Rollback from backup

Get Bruno's explicit approval before restoring — a restore wipes everything that landed AFTER the backup was taken (any orders / positions / feedback the system recorded since).

| App | Restore |
|---|---|
| admin (PostgreSQL) | `gunzip -c db-backups/pre-deploy-<TIMESTAMP>.sql.gz | psql -U odin quanamo` |
| kanban (MySQL) | `gunzip -c db-backups/pre-deploy-<TIMESTAMP>.sql.gz | mysql -u odin kanban_quanamo` |

---

## Related

- [Quanamo — tag](/docs/dynamic-commands/quanamo-tag) — must run first
- [Quanamo — warmup](/docs/dynamic-commands/quanamo-warmup) — Step 6 entry point
- [Quanamo — release](/docs/dynamic-commands/quanamo-release) — the parent pipeline
- [Quanamo — health](/docs/dynamic-commands/quanamo-health) — odin datagrid probe
