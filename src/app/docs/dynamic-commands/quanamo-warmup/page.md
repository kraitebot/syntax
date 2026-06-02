---
title: Quanamo — warmup
---

`quanamo-warmup` brings odin back online after a Quanamo deployment. Permissions, config cache, PHP-FPM reload, supervisor processes, Horizon (admin + kanban), kanban-scheduler, scheduler cron, per-app HTTP probe. {% .lead %}

---

## Sequence

| Step | Action |
|---|---|
| 0. Reboot check | `/var/run/reboot-required` → sudo reboot + wait ~30-60s + verify SSH |
| 1. Permissions | Per project: `chown -R odin:www-data`, `chmod -R 775 storage bootstrap/cache`, `chmod 644` on cached PHP files |
| 2. Config cache | Per project: `php artisan config:cache && route:cache && view:cache` (view:cache tolerated to fail), chmod + chgrp on the bootstrap/cache results |
| 3. PHP-FPM | `systemctl reload php8.5-fpm` |
| 4. Log cleanup | Wipe stale `laravel*.log` + `horizon.log` per app, truncate supervisor `*.log` |
| 5. artisan up | admin + feedz + kanban |
| 6. Supervisor | `supervisorctl start all`. If Horizon needs fresh code: `horizon:terminate` on admin AND kanban, then `start horizon` + `start kanban-horizon` |
| 7. kanban supervisor programs | Ensure `storage/step-dispatcher/` exists with right ownership. Start `kanban-scheduler` + `kanban-horizon`. **Do NOT touch `active.flag`** |
| 8. Scheduler cron (admin only) | Install `/etc/cron.d/quanamo-scheduler` — `* * * * * odin cd /home/odin/admin.quanamo.com && php artisan schedule:run` |
| 9. Verify | supervisorctl status + schedule:list per app + per-app HTTP curl |

---

## kanban `active.flag` — package-managed

Under step-dispatcher v1.12+ the `active.flag` is **package-managed**. The package writes the flag when a Step is enqueued, wipes it when the queue drains. Warmup does NOT touch the flag.

If `active.flag` is absent on an otherwise healthy system, that is the **expected idle state** — the queue is drained. Enqueue any Step and the flag reappears in the same tick. The old "re-arm during warmup" rule has been retired — see `kanban.quanamo.test/deploy/README.md` for the lifecycle.

---

## Hard rules

- **Never warmup before deploy health check passes.**
- **All project commands as odin, system commands via sudo.**
- **Do NOT touch `active.flag`.** Package-managed.
- **Cancel all scheduled tasks after warmup completes.**

---

## Related

- [Quanamo — deploy](/docs/dynamic-commands/quanamo-deploy) — what runs before this
- [Quanamo — health](/docs/dynamic-commands/quanamo-health) — what to run after if anything looks off
- [Quanamo — release](/docs/dynamic-commands/quanamo-release) — parent pipeline
- [Kraite — warmup](/docs/dynamic-commands/kraite-warmup) — sibling with workers-first ingestion ordering
