---
title: Scheduler
---

The Laravel scheduler is the **time-driven entry point** to Kraite's workload. Every recurring job — kline fetches, indicator computation, listenKey refreshes, balance snapshots, candle purges, audit-log retention — flows through `routes/console.php` on `ingestion.kraite.com` (running on Athena). The scheduler does not execute trading logic itself; it dispatches into the [dispatch daemon](/docs/subsystems/dispatch-daemon) and the [Horizon queues](/docs/subsystems/horizon-queues), which do the work. {% .lead %}

This is the **subsystem lens** view. For the persistent process that replaced one specific scheduled command (`steps:dispatch`), see [Dispatch daemon](/docs/subsystems/dispatch-daemon).

---

## The cron table

| Command | Cadence | Cooldown-gated | Purpose |
|---|---|---|---|
| `kraite:cron-flush-dispatcher-saturation` | 1 min | no | Persist dispatcher saturation counters |
| `steps:recover-stale` (default + trading) | 1 min | no | Recover stale steps, locks, and stalled groups |
| `kraite:cron-sync-orders` | 5 min | yes | Polling fallback for the user-data WS daemon |
| `kraite:cron-refresh-binance-listen-keys` | 1 min | no | Keep Binance listenKeys alive past 60-min auto-expiry |
| `kraite:cron-check-binance-listen-keys-stale` | 5 min | no | Detect missing or stale listen-key state |
| `kraite:cron-check-system-health` | 7 min | no | Unified health + maintenance sentinel |
| `kraite:cron-check-drifts` | 5 min | yes | Position drift, protection, and money guard |
| `kraite:monitor-narrate` | minutes 7, 27, 47 | yes | Document an already-open money-guard incident |
| `kraite:cron-create-positions` | 3 min | yes | Open new positions |
| `kraite:cron-fetch-klines --only-active-positions` | 5 min | yes | Refresh klines for tokens with open positions |
| `kraite:cron-fetch-klines --reference-set ... --timeframe=15m` | 15 min | yes | Feed the market-shock reference basket |
| `kraite:cron-fetch-klines --timeframe=4h` | every 4h :05 | yes | 4h-bar refresh |
| `kraite:cron-fetch-klines --timeframe=6h` | every 6h :05 | yes | 6h-bar refresh |
| `kraite:cron-fetch-klines --timeframe=12h` | every 12h :05 | yes | 12h-bar refresh |
| `kraite:cron-store-accounts-balances` | 5 min | yes | Snapshot account balances per exchange |
| `kraite:cron-upsert-pnls` | 5 min | yes | Backfill exchange-reported PnL |
| `kraite:cron-refresh-exchange-symbols` | hourly :15 | yes | Per-symbol leverage-bracket fan-out |
| `kraite:cron-conclude-symbols-direction` | hourly :30 | yes | TAAPI indicator → direction |
| `kraite:cron-renew-subscriptions` | daily 00:00 | yes | Process monthly renewals |
| `kraite:cron-compute-market-regime` | hourly :50 | yes | Compute BSCS |
| `kraite:cron-analyse-bscs` | hourly :55 | yes | Apply the BSCS cooldown state machine |
| `kraite:cron-detect-market-shock` | 1 min | yes | Fast cascade detector |
| `backup:run --only-db` | every 3h :07 | no | Encrypted database snapshot to B2; two whole-command attempts |
| `backup:monitor` | every 6h :15 | no | Alert on stale/unhealthy B2 backups |
| `kraite:purge-candles` | daily 03:00 | yes | Retention sweep on candle data |
| `kraite:cron-purge-position-trails` | daily 03:20 | yes | Reclaim expired clean-close breadcrumbs |
| `kraite:cron-purge-failed-backtested-klines` | hourly :00 | yes | Drop rejected-symbol candles |
| `kraite:purge-old-data ...` | daily 03:30 | yes | API/model log retention |
| `steps:archive` (default + trading) | daily 04:00 / 04:05 | yes | Archive resolved step trees |
| `steps:purge --only-archive` (default + trading) | daily 04:30 / 04:35 | yes | Keep five days of archived steps |
| `kraite:cron-optimize-breadcrumb-tables` | Sundays 03:00–04:36 | yes | Staggered weekly compaction |

The hourly direction-conclusion command also owns an application lock,
so a manual run and the scheduled run cannot overlap. Its destructive
`--clean` mode is accepted only in local or testing; production refuses
the flag before deleting any indicator or direction data.

---

## What "cooldown-gated" means

`routes/console.php` registers step-producing commands only while the
Kraite singleton reports `is_cooling_down=false`. During a release those
entries disappear from the schedule, so they cannot create fresh work while
queues drain. Recovery, listen-key maintenance, health, and backups stay
registered. `withoutOverlapping()` is a separate Laravel mutex that prevents
two instances of one command from running concurrently.

```
                tick fires
                    │
                    ▼
            ┌────────────────────┐
            │ System cooling down?│── yes ─► entry not registered
            └─────────┬──────────┘
                    no
                    ▼
            ┌────────────────────┐
            │ withoutOverlapping │── busy ► skip this tick
            │       mutex        │
            └─────────┬──────────┘
                    ok
                    ▼
              run command
                    │
                    ▼
             release mutex
```

---

## Maintenance mode silences everything — and its sentinel

The scheduler skips every event while the application is in maintenance mode. That is by design during a deploy (cooldown parks each box in maintenance; warmup lifts it) — but it means a box accidentally *left* in maintenance loses its entire cron table silently: listenKey keepalive, sync fallback, database backups, and every watchdog, all at once, while supervisors and Horizon still look healthy.

{% callout type="warning" title="Incident — 2026-07-02" %}
An interrupted release warmup left Athena in maintenance mode for 53 hours. The only external symptom was Binance's own `listenKeyExpired` push every 70 minutes — the keepalive cron that would have prevented it was itself paused, and so was the health watchdog that should have paged. Zero money impact (no open positions), but database backups were silently dead for two days.
{% /callout %}

Since then, the health watchdog (`kraite:cron-check-system-health`) is the one scheduled command that runs **even in maintenance mode**. While the box is down it performs a single check — "has this box been in maintenance longer than the threshold" (default 45 minutes, sized above a full cooldown → deploy → warmup span) — and pages CRITICAL on breach, re-paging every 30 minutes until an operator brings the box up. The full check pass stays skipped during maintenance, so normal deploy windows never produce transient alerts. The release runbooks carry the matching gates: warmup hard-verifies the box answers "UP" after warming, and the fleet health grid renders a **Maint** column that fails on any leftover maintenance marker.

### Recovery after warmup

Athena resumes dispatch only after the workers are online. Warmup then starts
a 10-minute recovery grace for the two health signals produced through the
default dispatcher: account-balance history and indicators. Those timestamps
can still describe the pre-deploy state until the first producer jobs finish.

The grace does not mute mark prices, queues, Redis, the database, daemons,
scheduler liveness, or fleet heartbeats. Indicator freshness also checks the
exact symbol's producer workflow: a recent query or conclusion in progress is
an active repair, while terminal work or an abandoned old step cannot suppress
a real alert.

{% callout title="Why the grace is narrow" %}
On 2026-07-16 the balance watchdog ran seconds before the first post-warmup
balance write. Later, BNB, ATOM, and GRT paged as stale while their indicator
workflows were visibly executing. Both alerts described old timestamps, but
neither needed operator action. The recovery rule removes those races without
creating a general post-deploy blind spot.
{% /callout %}

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
