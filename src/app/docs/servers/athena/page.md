---
title: Athena (ingestion + web)
---

Athena is Kraite's **ingestion brain and web edge** in one box — the box that decides what runs and when, *and* serves every public-facing surface. It owns the Laravel scheduler, the dispatch daemon, the long-lived WebSocket daemons that push exchange events into the system, and the nginx vhosts for the operator UI, the marketing site, and the public docs site. Athena does almost no exchange execution work itself; that's deliberate. {% .lead %}

This is the **server lens** view. For the consumer side of the queues athena populates, see [eos + iris + nyx](/docs/servers/eos-iris).

---

## What runs on Athena

### Trading runtime

| Workload | Notes |
|---|---|
| Scheduler crontab | `* * * * * php artisan schedule:run` — drives the `kraite:cron-*` family (see [Scheduler](/docs/subsystems/scheduler)) |
| `kraite:dispatch-daemon` | Persistent supervisor process — replaced 20 scheduler forks per second, dropped CPU load from 105 to 0.68 |
| `kraite:stream-binance-user-data` | Long-running daemon — one authenticated WebSocket per Binance account; pushes order / account events into the `user-data-stream` queue |
| `kraite:stream-binance-prices` | Long-running daemon — `!markPrice@arr@1s` subscription; refreshes `exchange_symbols.mark_price` for every Binance-listed symbol |
| `kraite:cron-refresh-binance-listen-keys` | Per-minute cron — keeps each Binance listenKey alive past its 60-min auto-expiry |
| Horizon — `user-data-stream` pool | 5 processes, the only Horizon supervisor on this box. Drains push frames produced by the user-data WebSocket daemon. |

### Web surface

| Vhost | Notes |
|---|---|
| `admin.kraite.com` | Operator UI — system dashboards, step browser, SQL query, commands runner, heartbeat, accounts drift view |
| `kraite.com` | Public marketing site |
| `syntax.kraite.com` | Public docs site (this site) |
| nginx + php8.4-fpm | One web stack, three vhosts. The ingestion Laravel app has no public vhost — it's invoked only by the supervisor daemons and the cron scheduler. |

---

## Why ingestion and web are co-located

{% callout title="Architectural decision" %}
The previous fleet kept ingestion (athena) and web (helios) on separate boxes for blast-radius isolation. The 2026-05-24 fleet rebuild folded them together because the actual web workload is sysadmin-only admin + low-volume marketing — not enough to ever compete with the trading runtime for CPU. Co-location halves the per-month spend on the role and removes one network hop for any admin operation that calls into the ingestion artisan surface. The reliability tier argument that originally drove the split was never validated by a real incident; consolidating is the simpler shape until traffic on `kraite.com` grows enough to justify splitting it back out.
{% /callout %}

---

## Why these trading services are co-located

{% callout title="Architectural decision" %}
The dispatch daemon's tick loop holds an open Redis connection that ticks 10 step-dispatcher groups per second. Network round-trips to a remote Redis would dominate the daemon's wall-clock budget — so although Redis itself lives on Hyperion, the daemon is on the box that needs the lowest-latency view of the queue surface. The WebSocket daemons live here for the same reason — they dispatch into Redis on every frame, sub-100 ms is the design budget. The cost of one extra private-network hop to Hyperion is acceptable for these hot paths; the cost of a public-internet hop would not be.
{% /callout %}

---

## Failure isolation

A reboot of athena takes down the scheduler, the dispatch daemon, the `user-data-stream` Horizon pool, both WS streams, and every public vhost simultaneously. Workers on eos / iris / nyx / tyche continue draining whatever was already enqueued in Redis on hyperion, but nothing new gets dispatched until athena is back. This is the single largest failure-domain blast radius in the topology.

Mitigation:

- Both WS daemons run under supervisor with `autostart=true` / `autorestart=true`.
- The dispatch daemon also runs under supervisor — if it crashes, supervisor restarts it within seconds; the step-dispatcher's `recover-stale` cron will sweep any Running steps that got marooned during the gap on the next minute tick.
- A polling sync (`kraite:cron-sync-orders`, every 5 min) re-anchors order state if the WS daemon was offline long enough to miss frames.
- Cloudflare absorbs the public-vhost outage for the duration of the reboot — visitors see the CF error page rather than a connection-refused.

---

## Cross-lens links

- **[Dispatch daemon](/docs/subsystems/dispatch-daemon)** — the persistent process that's athena's beating heart
- **[Scheduler](/docs/subsystems/scheduler)** — the cron entry-points dispatched here
- **[WebSocket streams](/docs/subsystems/websocket-streams)** — the two long-lived daemons hosted here
- **[Horizon queues](/docs/subsystems/horizon-queues)** — the queue surface athena populates
- **[Hyperion (database + Redis)](/docs/servers/hyperion)** — the stateful core athena depends on
- **[Eos + Iris + Nyx (workers)](/docs/servers/eos-iris)** — the workers that drain trading queues
- **[Tyche (indicators + cronjobs)](/docs/servers/tyche)** — the isolated worker for indicators
