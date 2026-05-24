---
title: Tyche (indicators + cronjobs)
---

Tyche is Kraite's **isolated worker** — a dedicated CX23 box that runs only the indicator and cronjob Horizon queues. It exists for one reason: the TAAPI throttler waits long enough on the rate-limit window that running it alongside trading work would starve real-time positions and orders. Tyche absorbs that wait so eos and iris never have to. {% .lead %}

This is the **server lens** view. For the indicator math itself, see [Indicators](/docs/domains/indicators).

---

## What runs on Tyche

| Queue | Processes | What it consumes |
|---|---|---|
| `indicators` | 20 | TAAPI fan-out — per-symbol per-timeframe indicator calculations |
| `cronjobs` | 5 | Scheduler-triggered work that's safe to run anywhere with DB + Redis |
| `tyche` | 2 | Server-pinned connectivity probes |

The 20-process indicator pool is the **largest single pool in the fleet** — bigger than eos's or iris's `orders` pool. Indicators fan out hardest (every active symbol × every timeframe × every cron tick), and the throttler turns wall-clock time into a constraint that scales linearly with concurrency.

---

## Why isolation matters here

{% callout title="Architectural decision" %}
TAAPI's Expert plan caps requests at 75 per 15-second window. A single Kraite symbol consumes ~12 calculations per query, so the effective ceiling is roughly 6 symbols per second across the whole fleet. During an HH:30 indicator fan-out the throttler routinely makes workers wait 1–2 seconds for the next window slot. If those waiting workers were on eos or iris (alongside `positions` and `orders`), they'd be holding process slots that real-time trading needs. Moving the entire indicator + cronjob workload onto a dedicated box makes the wait invisible to trading.
{% /callout %}

The cronjob queue is co-located with indicators because cron-triggered work is the same shape — predictable, fan-out-heavy, latency-tolerant. None of it needs to share a process pool with order placement.

---

## Why tyche doesn't carry positions / orders

Trading queues stay off tyche even though its 2 vCPU could in principle run a small worker. The cost of letting indicator throttler waits ever block a position-close atomic is far higher than the cost of paying for a dedicated box. The split is permanent.

---

## Failure isolation

A tyche crash stops indicator computation and cronjob execution. Existing positions are unaffected — trading continues on eos / iris from the data they already have. The next scheduler tick on athena keeps dispatching to a dead `indicators` queue; jobs accumulate in Redis and drain as soon as tyche returns.

Token selection (which depends on fresh indicator output) silently stops finding new candidates while tyche is offline. The system continues to operate on existing positions; it just stops opening new ones.

---

## Cross-lens links

- **[Indicators](/docs/domains/indicators)** — the actual computation Tyche consumes for
- **[Athena (ingestion + web)](/docs/servers/athena)** — the box that dispatches into Tyche's queues
- **[Eos + Iris (workers)](/docs/servers/eos-iris)** — the sibling workers Tyche stays out of the way of
- **[Horizon queues](/docs/subsystems/horizon-queues)** — queue assignment, balancing strategies, supervisor config
