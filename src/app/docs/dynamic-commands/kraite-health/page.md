---
title: Kraite — health
---

`kraite-health` is the **fleet-wide datagrid**. It always probes the full 10-server fleet in parallel and renders one table keyed by hostname. Server-scoped only — no website or TLS checks. Laravel maintenance markers are included because a down-marker silently disables scheduled work while processes still look healthy. {% .lead %}

---

## What it probes

For every box, in parallel, over SSH:

| Metric | Notes |
|---|---|
| **CPU** | 1-min load average as % of `nproc` |
| **Disk** | root partition % used (hyperion runs high — MySQL binlogs, 30d retention, ~30GB) |
| **Uptime** | `uptime -p` since last reboot |
| **Supervisors** | `OK (N/M)`, `DEGRADED (N/M)`, or `N/A` (hyperion has none) |
| **Horizon** | per-box supervisor unit state |
| **User-data stream** | athena only — per-account Binance WS daemon |
| **Price WS** | athena only — `!markPrice@arr@1s` daemon |
| **Step Dispatcher** | athena only — `default: N pending N failed | trading: N pending N failed`, failed window = 20 min |
| **PHP-FPM** | pheme only — `active (Xd Yh)` with age since last restart. Athena's PHP-FPM is masked since 2026-06-01 |
| **Reboot** | `YES` when `/var/run/reboot-required` exists |
| **Maintenance** | Any Laravel `storage/framework/down` marker on ingestion or pheme |
| **Version** | Deployed tag plus `kraitebot/core` version versus the latest readable tags |

If SSH times out, the row shows `UNREACHABLE` across all columns.

---

## Fleet (rebuilt 2026-05-24 → nyx 2026-05-24 → hemera 2026-05-30 → pheme 2026-06-01 → palaemon + aristaeus 2026-06-12)

| Hostname | IP | Scope |
|---|---|---|
| hyperion | 135.181.93.226 | database + redis |
| athena | 37.27.243.164 | ingestion |
| pheme | 62.238.38.113 | web (admin + kraite.com + syntax) |
| eos | 204.168.137.153 | worker (positions + orders) |
| iris | 204.168.138.83 | worker (positions + orders) |
| nyx | 204.168.129.189 | worker (positions + orders) |
| hemera | 77.42.68.254 | worker (positions + orders) |
| palaemon | 37.27.192.42 | worker (positions + orders) |
| aristaeus | 37.27.196.99 | worker (positions + orders) |
| tyche | 204.168.135.246 | worker (indicators + cronjobs) |

---

## Alert thresholds

After the table, the command flags anything off-normal: CPU > 80%, disk > 85%, supervisor DEGRADED or FATAL, Horizon not RUNNING, athena streams not RUNNING, athena dispatch daemon non-RUNNING, athena failed steps > 0 in last 20 min, athena pending steps > 50, pheme PHP-FPM inactive, a maintenance marker, a deployed tag/core version behind its readable latest tag, `/var/run/reboot-required`, or any SSH failure.

If nothing is off: `All servers healthy.`

---

## Operator notes (current rules, with the incident behind each)

{% callout title="Dispatch daemon survives Redis restarts poorly" %}
Its persistent PhpRedis connection breaks when Redis is bounced; supervisor's restart cap can exhaust before the daemon successfully reconnects, leaving it `FATAL`. After any planned Redis restart on hyperion, check athena's dispatch daemon explicitly. If FATAL → `supervisorctl clear kraite-dispatch-daemon && supervisorctl start kraite-dispatch-daemon`.
{% /callout %}

{% callout title="Hyperion disk skews high because of MySQL binlogs" %}
`binlog_expire_logs_seconds` defaults to 30 days × ~100MB per binlog × hundreds of files = ~30GB. This is **intentional** for point-in-time recovery, not a leak. To tighten, reduce retention in `mysqld.cnf` (e.g. 7 days = 604800 seconds).
{% /callout %}

{% callout title="steps:recover-stale runs every minute but exempts parent steps with non-terminal descendants" %}
Wedged `Running` atomics get reclaimed within `timeout + 60s` (default 300+60=360s). Wedged orchestrator parents stay until the child tree settles — they're not zombies, they're legitimately waiting.
{% /callout %}

---

## Related

- [Kraite — reboot](/docs/dynamic-commands/kraite-reboot) — when the `Reboot YES` flag fires
- [Kraite — release](/docs/dynamic-commands/kraite-release) — the post-deploy health gate that recurses here
- [Kraite — server-upgrade](/docs/dynamic-commands/kraite-server-upgrade) — uses the same probe shape for its phase gates
