---
title: Hyperion (database + Redis)
---

Hyperion is Kraite's **stateful core** — one dedicated AMD-EPYC box that runs only MySQL and Redis. Every other server in the fleet (athena for ingestion + web, eos / iris / nyx for trading workers, tyche for indicators) reads and writes against this single shared backend over the private `kraite-net` network. Hyperion runs no Laravel code, no Horizon, no daemons; it does two storage jobs and gets out of the way. {% .lead %}

This is the **server lens** view. For application-level data shapes, see the [Domains](/docs/domains/open-positions) chapters.

---

## What runs on Hyperion

| Service | Version | Notes |
|---|---|---|
| MySQL | 8.4.8 | The single shared `kraite` schema. Bound to `10.0.0.2` (private interface) only; public 3306 is firewalled. |
| Redis | 8.0.5 | The shared Horizon queue + cache backend. Bound to `10.0.0.2` + `127.0.0.1`. Database 2 is the fleet-wide convention — all servers use `REDIS_DB=2`. |

No web server, no PHP-FPM, no Horizon supervisor, no scheduler. Every Laravel process on every other server connects here over the 10.0.0.0/16 private network.

```
   athena ──┐
   eos    ──┤    private LAN (10.0.0.0/16)
   iris   ──┼──────────────────────────► Hyperion
   nyx    ──┤                           ├─ MySQL  :3306
   tyche  ──┘                           ├─ Redis  :6379
                                        └─ Redis  :6379
```

---

## Why MySQL and Redis are co-located

{% callout title="Architectural decision" %}
Splitting MySQL and Redis onto separate boxes would have doubled the spend on the dedicated-CPU SKU (CCX23 ≈ €34/mo) without buying meaningful isolation — both are storage workloads, both are private-network-only, and neither competes with the other for the same resource bucket (Redis is RAM-bound, MySQL is IO-bound). Co-locating them on one well-provisioned AMD-EPYC box with NVMe storage keeps the latency envelope tight (every dispatch-daemon tick reads Redis; every position-state change writes MySQL — both are hot paths). The blast radius of losing Hyperion is identical whether it's one box or two, so the operational benefit of splitting is zero.
{% /callout %}

---

## MySQL tuning that deviates from defaults

The MySQL config has been moved away from stock defaults wherever the workload demanded it.

| Setting | Value | Why |
|---|---|---|
| `innodb_buffer_pool_size` | `10G` | The 2 G stock value was the bottleneck on hot-set caching of `steps`, `orders`, `positions`. Kraite's working set fits in 10 G — every query that hits the buffer pool avoids disk. |
| `innodb_io_capacity` | `5000` | The stock `200` is a 2010-era spinning-rust assumption. NVMe storage sustains far more random write IOPS; the background flusher couldn't keep up during HH:08 storms (kline-fetch fan-outs + mark-price daemon UPDATE bursts) and writers stalled on `Innodb_buffer_pool_wait_free`. |
| `innodb_io_capacity_max` | `20000` | Companion to the above — gives the flusher headroom during write bursts. |
| `innodb_flush_log_at_trx_commit` | `2` | Trades up to one second of crash-window for substantial commit throughput. Acceptable because every position-changing flow is idempotent on `exchange_order_id` and re-runnable from exchange state. |
| `innodb_log_buffer_size` | `32M` | Reduces flushing pressure on the large transactions step-block writes generate (many child rows in one commit). |
| `skip-log-bin` | enabled | Kraite has no replication; binlogs would be pure overhead. |
| `max_connections` | `256` | Sized for the fleet-wide ~162 sustained worker connections plus admin / console ad-hoc queries. Stock `151` was too tight. |

---

## Redis hardening

Redis on Hyperion is bound to `10.0.0.2` (the private interface) plus `127.0.0.1` (loopback for local maintenance). The public interface is firewalled at the UFW layer — 6379 from the public internet is dropped.

The dangerous commands `FLUSHALL`, `FLUSHDB`, `KEYS`, and `DEBUG` have been renamed to random strings so an authenticated client cannot wipe the queue surface by accident. The `requirepass` directive is set; every worker connects with the shared password from `~/Herd/.credentials/kraite/servers.json`.

---

## Backups

Backups are taken by the application layer on Athena via
`spatie/laravel-backup`, using non-blocking mysqldump options: no global
write lock and no impact on writers during the snapshot. An encrypted
database-only archive is uploaded to Backblaze B2 every three hours at
minute 07; successful cleanup retains the latest three snapshots.

The upload has two retry layers: ten adaptive S3 request/multipart
attempts, then two total whole-backup attempts with a 60-second delay.
The whole-command layer was added after B2 returned a transient
`InternalError` on one multipart part on 2026-07-14 even though the
database dump and archive were healthy.

The **migration-ownership rule** (documented in the operator runbook): only `ingestion.kraite.com` runs migrations against Hyperion. Admin and the public site read this schema; they never alter it.

---

## Failure semantics

Hyperion is **the** single point of failure. A Hyperion outage halts every app, every worker, every daemon — including the queue surface (losing Redis means losing every job not yet picked up by a worker). Recovery is operational:

1. Restore MySQL from the most recent B2 snapshot onto a fresh CCX23 box.
2. Restore Redis (cache only — queued jobs in Redis are not snapshotted; they re-emit naturally as the scheduler ticks on athena).
3. Update `/etc/hosts` on every fleet box with the new private IP.
4. Restart application servers.

The decision to keep one shared MySQL instance instead of read replicas is a deliberate trade — simplicity over horizontal-scale reads while the workload still fits one well-tuned box.

---

## Cross-lens links

- **[Architecture overview](/docs/servers/architecture-overview)** — the full topology Hyperion anchors
- **[Athena (ingestion + web)](/docs/servers/athena)** — runs the application that owns migrations against Hyperion
- **[Horizon queues](/docs/subsystems/horizon-queues)** — the queue surface that lives in Hyperion's Redis
- **[Open positions](/docs/domains/open-positions)** — the dominant write workload Hyperion serves
