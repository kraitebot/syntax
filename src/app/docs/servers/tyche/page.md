---
title: Tyche (indicators + cronjobs)
---

Tyche is Kraite's **isolated worker** — a dedicated CX23 box that runs
indicator, cronjob, priority, and connectivity-probe Horizon queues. It
exists so TAAPI-bound work never starves the six trading workers. {% .lead %}

This is the **server lens** view. For the indicator math itself, see [Indicators](/docs/domains/indicators).

---

## What runs on Tyche

| Queue | Processes | What it consumes |
|---|---|---|
| `indicators` | 8 | TAAPI fan-out — per-symbol per-timeframe indicator calculations |
| `cronjobs` | 6 | Scheduler-triggered fan-out work |
| `priority` | 3 | Promoted stale work plus Tyche's share of the general priority lane |
| `tyche` | 2 | Server-pinned connectivity probes during account onboarding |

Tyche was right-sized for its 2 vCPU because TAAPI throughput is governed
by the shared throttle, not raw worker count. The former 20-process
indicator and cronjob pools pinned CPU without increasing API throughput.

Since 2026-06-07 tyche is no longer the sole `indicators` consumer —
athena runs a 16-process pool so the lane has two outbound public IPs.
`cronjobs` remains tyche-only. The second consumer spreads per-IP exchange
calls and gives StepRouter an alternate IP without raising the global API
budget.

---

## Why isolation matters here

{% callout title="Architectural decision" %}
Production admits 65 TAAPI requests per 15-second window with a 200 ms minimum delay. A symbol/timeframe request currently contains seven active indicator constructs. During an HH:30 indicator fan-out the throttler routinely makes consumers wait for the next window slot. Keeping those waits in Tyche's pool and Athena's secondary pool prevents them from occupying the positions/orders process slots on the six trading workers.
{% /callout %}

The cronjob queue is co-located with indicators because cron-triggered work is the same shape — predictable, fan-out-heavy, latency-tolerant. None of it needs to share a process pool with order placement.

---

## Why tyche doesn't carry positions / orders

Trading queues stay off tyche even though its 2 vCPU could in principle run a small worker. The cost of letting indicator throttler waits ever block a position-close atomic is far higher than the cost of paying for a dedicated box. The split is permanent.

## Why tyche subscribes to `priority`

{% callout title="Architectural decision" %}
The recovery command `php artisan steps:recover-stale --recover-dispatched`
rewrites a stuck step's queue to `priority`. Tyche's 3 priority processes
keep it in the seven-host candidate pool, so promoted tyche-bound work has
a 1-in-7 chance of landing back home. The remaining 6-in-7 leak is the
known imperfection; separate `priority-trading` and `priority-cron` lanes
remain the tracked full fix.
{% /callout %}

---

## Failure isolation

A tyche crash stops cronjob execution and slows — but no longer stops — indicator computation: athena's secondary 16-process `indicators` pool keeps the lane partially draining, so throughput drops rather than halting. `cronjobs` is tyche-only, so scheduled fan-out work does accumulate in Redis until tyche returns. Existing positions are unaffected — trading continues on eos / iris / nyx / hemera / palaemon / aristaeus from the data they already have.

Token selection (which depends on fresh indicator output) silently stops finding new candidates while tyche is offline. The system continues to operate on existing positions; it just stops opening new ones.

---

## Cross-lens links

- **[Indicators](/docs/domains/indicators)** — the actual computation Tyche consumes for
- **[Athena (ingestion)](/docs/servers/athena)** — the box that dispatches into Tyche's queues
- **[Six trading workers](/docs/servers/eos-iris)** — the sibling workers Tyche stays out of the way of
- **[Horizon queues](/docs/subsystems/horizon-queues)** — queue assignment, balancing strategies, supervisor config
