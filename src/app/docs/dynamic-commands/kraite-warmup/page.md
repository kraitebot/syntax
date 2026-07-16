---
title: Kraite — warmup
---

`kraite-warmup` brings a Kraite project back online after a deploy. Behaviour depends on the active profile — ingestion resumes dispatchers + supervisor + scheduler cron; web profiles run `artisan up` + selective process restart; syntax is a no-op (files were already served by the rsync). {% .lead %}

---

## Invocation

| Usage | Behaviour |
|---|---|
| `/do kraite-warmup` | Warmup the current project's target (profile decides) |
| `/do kraite-warmup <hostname>` (ingestion only) | Warm a single trading server. Hostname ∈ `athena`, `eos`, `iris`, `nyx`, `hemera`, `palaemon`, `aristaeus`, `tyche` |

---

## Ingestion: the workers-first guardrail

**Workers MUST be warmed before athena.** Inverts the pre-v1.49.8 rule. Reason: athena's warmup re-enables `/etc/cron.d/kraite-scheduler`, which immediately starts dispatching jobs to Redis on hyperion. If workers are still in maintenance at that moment, queue depth grows but isn't drained, and `kraite:cooldown --status` on any worker subsequently returns `STATUS:ACTIVE` — which `deploy.sh`'s cooldown gate hard-blocks.

Before warming athena, the command verifies all seven workers (eos, iris, nyx, hemera, palaemon, aristaeus, tyche) are already `UP`. Any one `DOWN` → STOP and report.

---

## Ingestion: per-host flow

| Step | Action |
|---|---|
| 0. Reboot check | `cat /var/run/reboot-required` — if present, reboot and wait for SSH back (up to 60s × 3 retries) |
| 1. Permissions | `chown -R <hostname>:www-data` the project; `chmod -R 775` on `storage/` + `bootstrap/cache/` |
| 2. Config cache | Rebuild `config:cache` and `route:cache` as the per-hostname user; chmod 644 + chgrp `www-data` on the resulting `.php` files |
| 3. PHP-FPM | `systemctl reload php8.5-fpm` (clear opcache) |
| 4. Log cleanup | Wipe stale `laravel*.log`, `horizon.log`, `price-stream.log`, `user-data-stream.log`, `dispatch-daemon.log`, supervisor `*.log` |
| 5. Warmup command | `php artisan kraite:warmup` (resumes step dispatchers on ingestion, runs `artisan up`) |
| 6. Supervisor | Start athena's four named units (`kraite-horizon`, dispatch daemon, and both WS streams); start `kraite-horizon` on workers |
| 7. Scheduler cron (athena ONLY) | Install `/etc/cron.d/kraite-scheduler` — `* * * * * athena cd /home/athena/ingestion.kraite.com && php artisan schedule:run` |
| 8. Dispatch monitor (athena ONLY, 1 min) | Verify daemon created + completed steps in the last minute, no failed steps, no pile-up |
| 9. Final verify | `supervisorctl status`, `php artisan schedule:list | head -5` |

{% callout title="Never enable scheduler before positions are imported" %}
On fresh infrastructure, do NOT install the scheduler cron until positions and orders are imported from the exchange. `sync-orders` closes unrecognised exchange positions — the 2026-05-10 incident closed 11 positions for a $13 loss this way.
{% /callout %}

---

## Web profiles

**admin (web-app-with-queue):** permissions → PHP-FPM reload → `horizon:terminate` → verify `kraite-horizon-admin` respawned and is consuming Redis queue `pheme-web` → `artisan up` → curl HTTPS check.

**kraite (web-app):** permissions → PHP-FPM reload → `horizon:terminate` → verify `kraite-horizon-kraite` respawned on Redis queue `pheme-web` → `artisan up` → curl HTTPS check.

**syntax (static-site):** no-op. The Next.js `npm run build` already wrote the new `out/` folder; nginx on pheme serves it directly. Files are live immediately after deploy. The command only runs the URL probe.

---

## Hard rules

- **Profile decided by CWD.** Don't override based on hostname argument unless it's an ingestion single-server warmup.
- **Workers first, athena last** within ingestion.
- **Never warmup before deploy health check passes.**
- **All project commands as the per-hostname user, system commands as root.**
- **Dispatcher timestamps are UTC** — 2h offset from wall clock is normal.
- **Cancel all background polling crons after warmup completes.** Any CI polling or scheduled monitors set up during the deploy/tag flow must be cancelled once warmup is confirmed healthy.

---

## Related

- [Kraite — deploy](/docs/dynamic-commands/kraite-deploy) — what runs before this
- [Kraite — reboot](/docs/dynamic-commands/kraite-reboot) — uses the same warmup primitives per host
- [Kraite — release](/docs/dynamic-commands/kraite-release) — the parent pipeline that calls warmup after deploy
- [Kraite — health](/docs/dynamic-commands/kraite-health) — the gate that confirms warmup landed
