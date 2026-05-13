---
title: Zeus (database)
---

Zeus is Kraite's **database server** — a single MySQL instance that every other box on the topology reads and writes against. Three Laravel applications (`ingestion`, `admin`, `kraite.com`) share one schema, one `migrations` table, and one connection pool. Zeus runs no Laravel code, no Horizon, no daemons; it does one job and gets out of the way. {% .lead %}

This is the **server lens** view. For application-level data shapes, see the [Domains](/docs/domains/open-positions) chapters.

---

## What runs on Zeus

Just MySQL. No web server, no PHP-FPM, no Horizon supervisor, no scheduler. Every Laravel process on every other server connects here over the private network.

```
   Athena ──┐
   Apollo ──┤
   Ares   ──┼──── (private LAN) ────► MySQL @ Zeus
   Artemis──┤
   Hermes ──┘
```

---

## Tuning that deviates from defaults

The MySQL config has been moved away from stock defaults in places where the workload demanded it. The key non-obvious settings:

| Setting | Value | Why |
|---|---|---|
| `innodb_buffer_pool_size` | `10G` | Original 2 G default was the bottleneck on hot-set caching of `steps`, `orders`, `positions`. Kraite's working set fits in 10 G — every query that hits the buffer pool avoids disk |
| `innodb_io_capacity` | `5000` | Original `200` was a 2010-era spinning-rust assumption. The host is NVMe; the background flusher couldn't keep up during HH:08 storms (kline-fetch fan-outs + mark-price daemon UPDATE bursts) and writers stalled on `Innodb_buffer_pool_wait_free` |
| `innodb_io_capacity_max` | `20000` | Companion to the above — gives the flusher headroom during burst |
| `innodb_flush_log_at_trx_commit` | `2` | Trades a few seconds of crash-window for substantial commit throughput. Acceptable because every position-changing flow is idempotent on `exchange_order_id` and re-runnable from exchange state |
| `innodb_log_buffer_size` | `32M` | Reduces flushing pressure on large transactions (step-block writes that spawn many child rows in one go) |
| `skip-log-bin` | enabled | Kraite has no replication; binlogs are pure overhead |

---

## Why MySQL, single instance

{% callout title="Architectural decision" %}
A single shared MySQL keeps cross-app joins trivial — admin can read ingestion-written rows synchronously, no replication lag to reason about. The trade-off is that Zeus is a single point of failure for the whole platform: if Zeus is down, every app is down. The mitigation is operational (backups + restore drills via `spatie/laravel-backup` + Backblaze B2 + a tiered GFS strategy), not architectural. We chose simplicity over horizontal-scale read replicas while the workload still fits one well-tuned box.
{% /callout %}

---

## Backups

Backups are taken by the application layer (running on Athena via `spatie/laravel-backup`) using **non-blocking** mysqldump options — no global write lock, no impact on writers during the backup window. Backups land on Backblaze B2 with a tiered GFS retention strategy (daily / weekly / monthly / yearly).

The migration-ownership rule (documented in the operator runbook): only `ingestion.kraite.com` runs migrations against Zeus. Admin and the public site read this schema; they never alter it.

---

## Failure semantics

Zeus is **the** single point of failure. A Zeus outage halts every app, every worker, every daemon. The recovery path is operational — restore from B2 onto a fresh box, point shared `.env.kraite` at the new IP, restart application servers. The full recovery runbook lives in the [Disaster recovery](/docs/lifecycles/order-lifecycle) operator notes (cross-lens — order lifecycle is the only flow that depends on a synchronous DB write end-to-end).

---

## Cross-lens links

- **[Architecture overview](/docs/servers/architecture-overview)** — the full topology Zeus anchors
- **[Athena (ingestion)](/docs/servers/athena)** — runs the application that owns migrations against Zeus
- **[Open positions](/docs/domains/open-positions)** — the dominant write workload Zeus serves
