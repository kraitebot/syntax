---
title: Tyche (indicators + cronjobs)
---

Tyche is Kraite's **isolated worker** — a dedicated CX23 box that runs only the indicator and cronjob Horizon queues. It exists for one reason: the TAAPI throttler waits long enough on the rate-limit window that running it alongside trading work would starve real-time positions and orders. Tyche absorbs that wait so eos, iris, and nyx never have to. {% .lead %}

This is the **server lens** view. For the indicator math itself, see [Indicators](/docs/domains/indicators).

---

## What runs on Tyche

| Queue | Processes | What it consumes |
|---|---|---|
| `indicators` | 20 | TAAPI fan-out — per-symbol per-timeframe indicator calculations |
| `cronjobs` | 20 | Scheduler-triggered work that's safe to run anywhere with DB + Redis |
| `priority` | 5 | Stale tyche-bound steps promoted by `steps:recover-stale --recover-dispatched`, plus its share of the general priority lane |
| `tyche` | 5 | Server-pinned connectivity probes (account-onboarding flow) — fan slightly wider here than the rest of the fleet because tyche is the box that drives the heaviest fan-out work |

The 20-process indicator and cronjob pools are the **two largest pools in the fleet** — each bigger than any single trading queue. Indicators fan out hardest (every active symbol × every timeframe × every cron tick), and the throttler turns wall-clock time into a constraint that scales linearly with concurrency. The capacity bump from 10 to 20 on indicators (and 3 to 20 on cronjobs) landed with v1.53.1 once the workload outgrew the original sizing.

Since 2026-06-07 tyche is no longer the sole `indicators` consumer — athena runs a secondary 10-process pool so the lane has two outbound public IPs (with only tyche's IP it was bursting Bybit's per-IP rate limit, retCode 10006). Tyche stays the primary at 20; `cronjobs` remains tyche-only. The second consumer does not raise the aggregate API rate — the throttlers are global Redis-coordinated buckets — it only spreads the per-IP exchange-call burst and gives StepRouter an IP to rotate to. See [Horizon queues](/docs/subsystems/horizon-queues) for the full rationale.

---

## Why isolation matters here

{% callout title="Architectural decision" %}
TAAPI's Expert plan caps requests at 75 per 15-second window. A single Kraite symbol consumes ~12 calculations per query, so the effective ceiling is roughly 6 symbols per second across the whole fleet. During an HH:30 indicator fan-out the throttler routinely makes workers wait 1–2 seconds for the next window slot. If those waiting workers were on eos / iris / nyx (alongside `positions` and `orders`), they'd be holding process slots that real-time trading needs. Moving the entire indicator + cronjob workload onto a dedicated box makes the wait invisible to trading.
{% /callout %}

The cronjob queue is co-located with indicators because cron-triggered work is the same shape — predictable, fan-out-heavy, latency-tolerant. None of it needs to share a process pool with order placement.

---

## Why tyche doesn't carry positions / orders

Trading queues stay off tyche even though its 2 vCPU could in principle run a small worker. The cost of letting indicator throttler waits ever block a position-close atomic is far higher than the cost of paying for a dedicated box. The split is permanent.

## Why tyche subscribes to `priority`

{% callout title="Architectural decision" %}
The recovery command `php artisan steps:recover-stale --recover-dispatched` rewrites a stuck step's queue to `priority` so it can be picked up immediately by whichever supervisor wins the race. Before v1.53.1, tyche was not in the priority candidate pool — so a tyche-bound indicator or cronjob step that went stale would land on a trading worker (eos / iris / nyx / hemera) that had no business running it. Adding 5 priority procs on tyche means a promoted tyche-bound step has a 1-in-5 chance of landing back home. The remaining 4-in-5 leak to trading workers is the known imperfection; the tracked fix is a per-category split (`priority-trading` vs `priority-cron`) that pins each consumer to its own lane. Until then this is the best available approximation.
{% /callout %}

---

## Failure isolation

A tyche crash stops cronjob execution and slows — but no longer stops — indicator computation: since 2026-06-07 athena's secondary 10-process `indicators` pool keeps the lane partially draining, so throughput drops rather than halting. `cronjobs` is tyche-only, so scheduled fan-out work does accumulate in Redis until tyche returns. Existing positions are unaffected — trading continues on eos / iris / nyx / hemera from the data they already have.

Token selection (which depends on fresh indicator output) silently stops finding new candidates while tyche is offline. The system continues to operate on existing positions; it just stops opening new ones.

---

## Cross-lens links

- **[Indicators](/docs/domains/indicators)** — the actual computation Tyche consumes for
- **[Athena (ingestion + web)](/docs/servers/athena)** — the box that dispatches into Tyche's queues
- **[Eos + Iris + Nyx (workers)](/docs/servers/eos-iris)** — the sibling workers Tyche stays out of the way of
- **[Horizon queues](/docs/subsystems/horizon-queues)** — queue assignment, balancing strategies, supervisor config
