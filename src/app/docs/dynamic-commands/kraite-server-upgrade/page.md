---
title: Kraite — server-upgrade
---

`kraite-server-upgrade` is the **operator-driven, fully-scripted fleet-wide OS package upgrade**. Cooldown → backup-and-verify → upgrade in dependency order → warmup. Replaces unattended-upgrades, which was disabled fleet-wide on 2026-05-31. {% .lead %}

**Ingestion profile only.** Needs the ingestion app to invoke `php artisan backup:run` and `php artisan kraite:cooldown` against the fleet. The orchestration itself runs from Bruno's Mac using `~/.ssh/id_ed25519_kraite` to reach all 8 boxes — none of the servers run this command on themselves.

---

## Scope of "upgrade"

Standard `apt upgrade` (NOT `dist-upgrade` / `full-upgrade`). Patch + minor versions within the current series only.

**In scope:** PHP 8.5.x patches, MySQL 8.4.x patches, Redis 8.0.x patches, Linux kernel patches (triggers inline auto-reboot), OpenSSL / glibc / openssh-server CVE patches, nginx / supervisor / chrony / fail2ban patches.

**Out of scope** (would need a separate explicit command): PHP 8.5 → 8.6 (compatibility risk), MySQL 8.4 → 9.0 (data dictionary migration risk), Ubuntu 26.04 → 26.10 (distribution upgrade).

---

## Eight-phase pipeline

Strict order. Any failure at any phase → fail-fast: pipeline halts, no warmup, fleet left mid-upgrade for operator inspection.

| Phase | Action |
|---|---|
| 0. Pre-flight SSH | Probe all 8 hosts in parallel. Any timeout / auth fail / host-key change → STOP, fleet untouched |
| 0a. Tool prerequisites | `apt install awscli` on hyperion + athena if missing (needed for Phase 1.5c B2 download) |
| 0b. Fleet state gate | Refuse if active steps (Running + Dispatched) > 200 — cooldown's 300s drain timeout cannot drain that much |
| 0c. Credential discovery | Locate `MYSQL_ROOT_PASSWORD`, `BACKUP_ARCHIVE_PASSWORD`, B2 creds, `REDIS_PASSWORD` from `servers.json` and athena `.env` |
| 1. Cooldown (parallel) | `kraite:cooldown` on athena + 5 workers. Every box must reach `STATUS:COOLED_DOWN`. **No `--force` fallback** |
| 1.5. Backup + verify | **HARD GATE** before hyperion is touched (see below) |
| 2. Hyperion upgrade | apt upgrade → optional inline reboot → post-upgrade health (MySQL + Redis active, sentinel queries pass) |
| 3. Athena upgrade | Stop 4 supervisors + php-fpm → apt → optional reboot → supervisors auto-start → dispatch-daemon must tick within 30s |
| 4. Workers upgrade (parallel) | All 5 workers in parallel: stop Horizon → apt → optional reboot → restart Horizon |
| 5. Warmup | Workers in parallel, then athena last (mirrors the post-v1.49.8 ordering) |
| 6. Cleanup | Drop `kraite_backup_verify` from hyperion, remove temp files |

---

## Phase 1.5 — the backup hard gate

The single most important phase. Without a verified backup, hyperion does not get touched.

| Step | Action |
|---|---|
| 1.5a. Stop WS daemons | `supervisorctl stop kraite-stream-binance-prices kraite-stream-binance-user-data` — both keep writing to MySQL even after cooldown puts the app down |
| 1.5b. backup:run | `php artisan backup:run --only-db` on athena → encrypted ZIP lands on B2 (Spatie's `b2` disk) |
| 1.5c. Download | hyperion fetches the latest ZIP via S3-compatible AWS CLI against the B2 endpoint |
| 1.5d. Restore | Unzip + gunzip → restore into `kraite_backup_verify` database on hyperion |
| 1.5e. Verification (3 layers, ALL must pass) | Schema integrity, active-state sentinel hashes, explicit-exclude list |

### Verification layer 2 — active-state sentinel hashes

Run each on both databases (`kraite` vs `kraite_backup_verify`), compare exact-match:

1. Active positions — `positions WHERE status IN ('active','opening','syncing','closing','waping','cancelling')`
2. Active orders — `orders WHERE status IN ('NEW','PARTIALLY_FILLED')`
3. Active accounts — `accounts WHERE is_active=1 AND can_trade=1`
4. Active users — `users WHERE is_active=1 AND status='active'`
5. Kraite singleton — `kraite WHERE id=1` (email + admin pushover key + MD5 of binance API key)
6. Servers — `servers` full table hash (routing data)

**Any mismatch → fail-fast.**

### Layer 3 — intentionally excluded

`exchange_symbol_prices` (1Hz mark-price writes), `candles` (volatile timeseries), `model_logs` (append-only audit), `api_request_logs`, `slow_queries`, `steps` / `steps_archive` / `trading_steps` / `trading_steps_archive` (empty after cooldown anyway), `notification_logs`. These would false-fail because they shift between dump-start and compare-time.

---

## Fleet state gate threshold

Active steps > 200 → REFUSE to start. Verbatim message:

> `kraite-server-upgrade` refuses to start. Active steps backlog = N (Running + Dispatched), threshold is 200. The cooldown 300s window cannot drain this much before timeout. Inspect zombie Running steps via tinker; let the fleet drain naturally; or manually transition stuck steps to Cancelled. Then retry. The fleet has NOT been touched.

This catches the failure-mode-shape Bruno hit on 2026-05-31: a 5h dispatch-daemon outage during unattended-upgrades left thousands of zombie Running parents that recover-stale's parent-exemption couldn't reclaim.

---

## Auto-reboot inline

When apt flags `/var/run/reboot-required` on any box, the script reboots immediately with `nohup bash -c 'sleep 2; systemctl reboot' >/dev/null 2>&1 &` and exits 100. SSH polling waits up to 120s for it back. Supervisors come up via `autostart=true` (set fleet-wide 2026-05-31); php-fpm starts via systemd.

---

## Hard rules

- **Profile-gated.** Ingestion CWD only.
- **Fully scripted.** No interactive prompts.
- **Fail-fast.** Any phase failure halts everything. No warmup on failure.
- **Backup is the hard gate** — `kraite_backup_verify` must compare clean against `kraite`, not just "the dump file exists on B2".
- **Patch / minor only.** Major-version jumps need a separate explicit operator workflow.
- **No `kraite:cooldown --force`.** Drain timeout = fail-fast → operator inspects stuck steps.
- **Run from Bruno's Mac.** Servers don't run this on themselves.

---

## Failure recovery cheatsheet

| Phase | Failure | Operator action |
|---|---|---|
| 0 | SSH unreachable | Hetzner panel, restore SSH, rerun |
| 1 | Cooldown TIMEOUT | Investigate stuck Running steps, transition to Cancelled, rerun |
| 1.5e | Schema drift | Partial-dump bug. Inspect `kraite_backup_verify`, salvageable? |
| 1.5e | Hash mismatch | Writes happened between dump start and compare. Verify WS daemons stopped first |
| 2 | MySQL won't come up | Critical. `/var/log/mysql/error.log`. B2 pre-upgrade backup is rollback path |
| 3 | Dispatch daemon doesn't tick in 30s | `/var/log/supervisor/kraite-dispatch-daemon.log`. Often Redis restart killed PhpRedis connection — restart daemon manually + rerun warmup |
| 4 | One worker fails apt | Inspect, complete manually, then `/do kraite-warmup` |
| 5 | Warmup OFFLINE | `/do kraite-warmup <hostname>` — idempotent |

---

## Related

- [Kraite — reboot](/docs/dynamic-commands/kraite-reboot) — what runs implicitly when apt flags `/var/run/reboot-required`
- [Kraite — warmup](/docs/dynamic-commands/kraite-warmup) — Phase 5 entry point
- [Kraite — health](/docs/dynamic-commands/kraite-health) — worth running manually after Phase 5 as a fleet smoke check
- [Hyperion (database + Redis)](/docs/servers/hyperion) — the highest-risk box this command touches
