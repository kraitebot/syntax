---
title: Athena (ingestion)
---

Athena is Kraite's **ingestion brain** — the box that decides what runs and when. It owns the Laravel scheduler, the dispatch daemon, the Redis instance every worker consumes from, and the long-lived WebSocket daemons that push exchange events into the system. Athena does almost no exchange execution work itself; that's deliberate. {% .lead %}

This is the **server lens** view. For the consumer side of the queues Athena populates, see [Apollo + Ares](/docs/servers/apollo-ares).

---

## What runs on Athena

| Workload | Notes |
|---|---|
| Laravel scheduler | The `kraite:cron-*` schedule (see [Scheduler](/docs/subsystems/scheduler)) |
| `kraite:dispatch-daemon` | Persistent supervisor process — replaced 20 scheduler forks per second, dropped CPU load from 105 to 0.68 |
| `kraite:stream-binance-user-data` | Long-running daemon — one authenticated WebSocket per Binance account; pushes order/account events into `user-data-stream` queue |
| `kraite:stream-binance-prices` | Long-running daemon — `!markPrice@arr@1s` subscription; refreshes `exchange_symbols.mark_price` for every Binance-listed symbol |
| `kraite:cron-refresh-binance-listen-keys` | Per-minute cron — keeps each Binance listenKey alive past its 60-min auto-expiry |
| Redis | The single shared Redis instance every Horizon worker on every box reads from |
| Horizon (small footprint) | 5 × `cronjobs`, 5 × `user-data-stream`, 2 each on `positions` / `orders` / `priority` |

The 2-worker allocation on `positions` / `orders` / `priority` is a **deploy self-sufficiency hedge** — see [Horizon queues](/docs/subsystems/horizon-queues#why-athena-holds-small-positions-orders-priority-counts).

---

## Why these things are co-located

{% callout title="Architectural decision" %}
Scheduler, dispatch daemon, and Redis live on the same box because the dispatch daemon's tick loop holds an open Redis connection that ticks 10 step-dispatcher groups per second. Network round-trips to a remote Redis would dominate the daemon's wall-clock budget. Co-location collapses each tick into a localhost socket call. The WebSocket daemons live here for the same reason — they dispatch into the same Redis on every frame, sub-100 ms is the design budget.
{% /callout %}

---

## Failure isolation

A reboot of Athena takes down the scheduler, dispatch daemon, and both WS streams simultaneously. Workers on Apollo / Ares / Artemis continue draining whatever was already enqueued, but nothing new gets dispatched until Athena is back. This is the single largest failure-domain blast radius in the topology.

Mitigation:
- Both WS daemons run under supervisor with `autostart=true` / `autorestart=true`.
- The dispatch daemon also runs under supervisor — if it crashes, supervisor restarts it within seconds; the step-dispatcher's `recover-stale` cron will sweep any Running steps that got marooned during the gap on the next minute tick.
- A polling sync (`kraite:cron-sync-orders`, every 5 min) re-anchors order state if the WS daemon was offline long enough to miss frames.

---

## Cross-lens links

- **[Dispatch daemon](/docs/subsystems/dispatch-daemon)** — the persistent process that's Athena's beating heart
- **[Scheduler](/docs/subsystems/scheduler)** — the cron entry-points dispatched here
- **[WebSocket streams](/docs/subsystems/websocket-streams)** — the two long-lived daemons hosted here
- **[Horizon queues](/docs/subsystems/horizon-queues)** — the queue surface Athena populates
- **[Apollo + Ares](/docs/servers/apollo-ares)** — the workers that drain those queues
