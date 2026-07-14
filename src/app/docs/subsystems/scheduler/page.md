---
title: Scheduler
---

The Laravel scheduler is the **time-driven entry point** to Kraite's workload. Every recurring job — kline fetches, indicator computation, listenKey refreshes, balance snapshots, candle purges, audit-log retention — flows through `routes/console.php` on `ingestion.kraite.com` (running on Athena). The scheduler does not execute trading logic itself; it dispatches into the [dispatch daemon](/docs/subsystems/dispatch-daemon) and the [Horizon queues](/docs/subsystems/horizon-queues), which do the work. {% .lead %}

This is the **subsystem lens** view. For the persistent process that replaced one specific scheduled command (`steps:dispatch`), see [Dispatch daemon](/docs/subsystems/dispatch-daemon).

---

## The cron table

| Command | Cadence | Cooldown-gated | Purpose |
|---|---|---|---|
| `steps:recover-stale` | 1 min | no | Flip stuck Running steps back to Pending after `timeout + 60s` |
| `kraite:cron-sync-orders` | 5 min | no | Polling fallback for the user-data WS daemon |
| `kraite:cron-refresh-binance-listen-keys` | 1 min | no | Keep Binance listenKeys alive past 60-min auto-expiry |
| `kraite:cron-create-positions` | 3 min | yes | Open new positions |
| `kraite:cron-fetch-klines --only-active-positions` | 5 min | yes | Refresh klines for tokens with open positions |
| `kraite:cron-fetch-klines --timeframe=1h` | hourly :05 | yes | 1h-bar refresh for the full tradeable set |
| `kraite:cron-fetch-klines --timeframe=4h` | every 4h :05 | yes | 4h-bar refresh |
| `kraite:cron-fetch-klines --timeframe=12h` | every 12h :05 | yes | 12h-bar refresh |
| `kraite:cron-store-accounts-balances` | 5 min | yes | Snapshot account balances per exchange |
| `kraite:cron-refresh-exchange-symbols` | hourly :15 | yes | Per-symbol leverage-bracket fan-out |
| `kraite:cron-conclude-symbols-direction` | hourly :30 | yes | TAAPI indicator → direction |
| `kraite:disable-volatile-tokens` | hourly :45 | yes | Sweep volatile / structurally-brittle tokens |
| `backup:run --only-db` | every 3h :07 | no | Encrypted database snapshot to B2; two whole-command attempts |
| `backup:monitor` | every 6h :15 | no | Alert on stale/unhealthy B2 backups |
| `kraite:purge-candles` | daily 03:00 | yes | Retention sweep on candle data |
| `kraite:purge-model-logs --duration=30` | daily 03:30 | yes | 30-day rolling audit-log window |
| `steps:archive --duration=1` | daily 04:00 | yes | Archive completed step rows past 1 day |

---

## What "cooldown-gated" means

Every cron-bound command in Kraite extends a base class that wraps execution with a per-command cooldown — a "do not re-fire if already running OR if the prior run finished less than `cooldown_seconds` ago" guard. The guard is enforced via a Redis lock, not a DB row, so a stuck previous tick never blocks scheduling. Non-gated commands (the four `no` rows above) are short, idempotent, and safe to overlap.

```
                tick fires
                    │
                    ▼
            ┌──────────────────┐
            │ Cooldown active? │── yes ─► skip
            └────────┬─────────┘
                    no
                    ▼
            ┌──────────────────┐
            │  acquire Redis   │── fail ► skip (already running)
            │      lock        │
            └────────┬─────────┘
                    ok
                    ▼
              run command
                    │
                    ▼
           release lock + stamp
              cooldown_until
```

---

## Maintenance mode silences everything — and its sentinel

The scheduler skips every event while the application is in maintenance mode. That is by design during a deploy (cooldown parks each box in maintenance; warmup lifts it) — but it means a box accidentally *left* in maintenance loses its entire cron table silently: listenKey keepalive, sync fallback, database backups, and every watchdog, all at once, while supervisors and Horizon still look healthy.

{% callout type="warning" title="Incident — 2026-07-02" %}
An interrupted release warmup left Athena in maintenance mode for 53 hours. The only external symptom was Binance's own `listenKeyExpired` push every 70 minutes — the keepalive cron that would have prevented it was itself paused, and so was the health watchdog that should have paged. Zero money impact (no open positions), but database backups were silently dead for two days.
{% /callout %}

Since then, the health watchdog (`kraite:cron-check-system-health`) is the one scheduled command that runs **even in maintenance mode**. While the box is down it performs a single check — "has this box been in maintenance longer than the threshold" (default 45 minutes, sized above a full cooldown → deploy → warmup span) — and pages CRITICAL on breach, re-paging every 30 minutes until an operator brings the box up. The full check pass stays skipped during maintenance, so normal deploy windows never produce transient alerts. The release runbooks carry the matching gates: warmup hard-verifies the box answers "UP" after warming, and the fleet health grid renders a **Maint** column that fails on any leftover maintenance marker.

---

## Why a daemon replaced `steps:dispatch`

{% callout title="Architectural decision" %}
The pre-daemon design ran `steps:dispatch` every second across 10 step-dispatcher groups — 10 forks per second, plus the per-tick scheduler fork itself. At Kraite's growth that became the dominant CPU cost on Athena. The dispatch daemon collapses all 10 group ticks into a single long-lived loop with a 1 s sleep between ticks, dropping load average from 105 to 0.68. The scheduler still owns every other recurring command — only the high-frequency dispatch concern was lifted out.
{% /callout %}

---

## Cross-lens links

- **[Dispatch daemon](/docs/subsystems/dispatch-daemon)** — the persistent loop that took over from `steps:dispatch`
- **[Athena (ingestion)](/docs/servers/athena)** — the box this scheduler runs on
- **[Horizon queues](/docs/subsystems/horizon-queues)** — where every dispatched job lands
