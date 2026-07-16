---
title: Athena (ingestion)
---

Athena is Kraite's **ingestion brain** — the box that decides what runs and when. It owns the Laravel scheduler, the dispatch daemon, the long-lived WebSocket daemons that push exchange events into the system, the `user-data-stream` Horizon supervisor, and — since 2026-06-07 — a secondary `indicators` pool that gives the kline lane a second outbound IP. Athena does almost no trading execution work itself; that's deliberate. {% .lead %}

This is the **server lens** view. For the consumer side of the queues
athena populates, see the [six trading workers](/docs/servers/eos-iris).
For the public web surface (admin / kraite.com / syntax), see
[pheme](/docs/servers/pheme).

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
| Horizon — `user-data-stream` pool | 5 processes. Drains push frames produced by the user-data WebSocket daemon. |
| Horizon — `indicators` pool | 10 processes (added 2026-06-07). A second outbound IP for the kline/indicator lane — spreads the per-IP Bybit kline burst (retCode 10006) across athena + tyche and lets StepRouter rotate off a rate-limited IP. Safe here because athena runs no trading queues. |

### What does NOT run here (since 2026-06-01)

| Removed | Lives on |
|---|---|
| nginx | [pheme](/docs/servers/pheme) |
| php8.5-fpm | [pheme](/docs/servers/pheme) |
| `admin.kraite.com` / `kraite.com` / `syntax.kraite.com` vhosts | [pheme](/docs/servers/pheme) |

Athena's nginx and php8.5-fpm services are `systemctl mask`'d. PHP 8.5 **CLI** is retained — the scheduler, daemons, and Horizon supervisor are all CLI processes.

---

## Why ingestion services are co-located on one box

{% callout title="Architectural decision" %}
The dispatch daemon's tick loop holds an open Redis connection that ticks 10 step-dispatcher groups per second. Network round-trips to a remote Redis would dominate the daemon's wall-clock budget — so although Redis itself lives on Hyperion, the daemon is on the box that needs the lowest-latency view of the queue surface. The WebSocket daemons live here for the same reason — they dispatch into Redis on every frame, sub-100 ms is the design budget. The cost of one extra private-network hop to Hyperion is acceptable for these hot paths; the cost of a public-internet hop would not be.
{% /callout %}

---

## Why web was split off (2026-06-01)

{% callout title="Architectural decision" %}
The 2026-05-24 fleet rebuild briefly co-located the web role with ingestion on athena. In practice the web stack never got fully wired there — diagnosing `syntax.kraite.com` returning 522 from Cloudflare on 2026-06-01 surfaced that the four web hostnames were still pointing at hyperion (which doesn't serve HTTP) and athena had no nginx vhosts at all. The fix was a dedicated web host: **pheme** (CPX22, 62.238.38.113). Splitting kept athena focused on the trading runtime, gave the web stack a clean cleanroom (no leftover state), and made the per-role blast radius smaller — a pheme reboot doesn't touch trading, an athena reboot doesn't take the web stack offline.
{% /callout %}

---

## Failure isolation

A reboot of athena takes down the scheduler, the dispatch daemon, the
`user-data-stream` + `indicators` Horizon pools, and both WS streams
simultaneously. Workers continue draining already-queued jobs, but no
newly-pending step is promoted until athena returns. Indicator computation
does not stop — tyche carries an 8-process pool; losing athena's secondary
10 trims kline-lane throughput. Pheme stays up.

Mitigation:

- Both WS daemons run under supervisor with `autostart=true` / `autorestart=true`.
- The dispatch daemon also runs under supervisor — if it crashes, supervisor restarts it within seconds; the step-dispatcher's `recover-stale` cron will sweep any Running steps that got marooned during the gap on the next minute tick.
- A polling sync (`kraite:cron-sync-orders`, every 5 min) re-anchors order state if the WS daemon was offline long enough to miss frames.

---

## Cross-lens links

- **[Pheme (web)](/docs/servers/pheme)** — where the public vhosts now live
- **[Dispatch daemon](/docs/subsystems/dispatch-daemon)** — the persistent process that's athena's beating heart
- **[Scheduler](/docs/subsystems/scheduler)** — the cron entry-points dispatched here
- **[WebSocket streams](/docs/subsystems/websocket-streams)** — the two long-lived daemons hosted here
- **[Horizon queues](/docs/subsystems/horizon-queues)** — the queue surface athena populates
- **[Hyperion (database + Redis)](/docs/servers/hyperion)** — the stateful core athena depends on
- **[Six trading workers](/docs/servers/eos-iris)** — the workers that drain trading queues
- **[Tyche (indicators + cronjobs)](/docs/servers/tyche)** — the isolated worker for indicators
