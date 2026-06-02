---
title: Quanamo — health
---

`quanamo-health` is the live health dashboard for odin — Quanamo's single all-in-one production server. CPU, memory, disk, supervisor status, Horizon, PostgreSQL, MySQL, Redis, per-app HTTP probes, scheduler cron, reboot flag. {% .lead %}

---

## Server

| Hostname | IP | SSH |
|---|---|---|
| odin | 204.168.242.59 | `ssh -i ~/.ssh/id_ed25519_waygou odin@204.168.242.59` |

---

## Probe shape

For odin, in one SSH round-trip:

| Metric | Notes |
|---|---|
| **CPU** | 1-min load average as % of `nproc` |
| **Memory** | `free` % used |
| **Disk** | root partition % used |
| **Supervisor** | `OK (N/N)` / `DEGRADED (N/M)` / `N/A` |
| **Horizon** | admin's supervisor unit state |
| **PostgreSQL** | `pg_isready` → admin + feedz health |
| **MySQL** | Probed via the kanban app's Laravel PDO, NOT `mysqladmin ping` — the latter has no password handy and would always return "Access denied" → false DOWN |
| **Redis** | `redis-cli -a quanamo_redis_2026 ping` |
| **admin.quanamo.com** | localhost curl via Host header |
| **feedz.quanamo.com** | localhost curl via Host header |
| **kanban.quanamo.com** | localhost curl via Host header |
| **Scheduler cron** | `/etc/cron.d/quanamo-scheduler` exists? |
| **Reboot** | `/var/run/reboot-required` |

If SSH times out → `UNREACHABLE` across the board.

---

## Alert thresholds

- CPU > 80% / Memory > 85% / Disk > 85% → WARNING
- Supervisor DEGRADED or FATAL → ALERT
- Horizon not RUNNING → ALERT
- PostgreSQL DOWN → ALERT (admin/feedz impacted)
- MySQL DOWN → ALERT (kanban impacted)
- Redis DOWN → ALERT
- admin not 302 → ALERT (admin redirects to /login)
- feedz not 401 → ALERT (feedz requires auth)
- kanban not 302 → ALERT
- `/var/run/reboot-required` present → INFO
- UNREACHABLE → ALERT

If nothing is off: `All healthy.`

---

## Optional deep checks

When Bruno asks for a deep health check, the command additionally tests:

- **AI connectivity:** `php artisan ai:chat "Say OK"` from admin
- **kanban DB binding:** `php artisan tinker --execute "echo 'DB: ' . DB::connection()->getDatabaseName();"` from kanban

---

## Related

- [Quanamo — deploy](/docs/dynamic-commands/quanamo-deploy) — Step 5 entry point
- [Quanamo — warmup](/docs/dynamic-commands/quanamo-warmup) — runs the per-app HTTP probes itself at end of warmup
- [Quanamo — release](/docs/dynamic-commands/quanamo-release) — Phase 5 entry point
