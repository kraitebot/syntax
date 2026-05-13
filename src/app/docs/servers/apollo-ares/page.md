---
title: Apollo + Ares (workers)
---

Apollo and Ares are Kraite's two **worker servers** — Horizon queue consumers that execute the bulk of the trading workload dispatched from Athena. They are stateless, identical, horizontally scalable boxes. Adding a third worker (Hephaestus, Hera, etc.) is a matter of provisioning + supervisor config; no code change. {% .lead %}

This is the **server lens** view of the position lifecycle. For the per-step flow these workers consume, jump to [position lifecycle](/docs/lifecycles/position-lifecycle).

---

## What runs on Apollo / Ares

| Workload class | Notes |
|---|---|
| Position-open block (`DispatchPositionJob` children) | Entire 11-step open sequence executes here, atomic by atomic |
| Position-close block (`ClosePositionJob` children) | 9-step close sequence; Apollo/Ares is where the reduceOnly market close hits the exchange |
| WAP block (`ApplyWapJob` children) | The `apiModify` round-trip on TP price runs here on a DCA fill |
| Indicator computation jobs | Per-symbol per-timeframe indicator math |
| Order-placement atomics | Every `Place*OrderJob` / `Cancel*Job` against an exchange |

Anything that holds a position-blocking exchange round-trip lives here, not on Athena. Athena dispatches and then is free to dispatch the next thing.

---

## Why the split (Athena vs Apollo / Ares)

{% callout title="Architectural decision" %}
Athena owns dispatch, Apollo and Ares own execution. Splitting these meant a slow exchange round-trip on Apollo never blocks the next scheduled dispatch on Athena. It also means restarting Horizon workers (the standard way to roll out a job-class change) doesn't interrupt the scheduler / dispatch daemon on Athena.
{% /callout %}

---

## Failure isolation

A worker crash takes down the steps mid-flight on that worker. The orchestrator-level retry on Athena re-dispatches the failed atomic to whichever worker is alive next tick. Because every order-placement atomic is **idempotent on `exchange_order_id`** ([decision documented in the open phase](/docs/lifecycles/position-lifecycle#decision-retry-idempotency-on-order-placements)), a worker swap mid-block does not produce duplicate orders on the exchange.

Loss of *both* workers is the only mode that stalls the lifecycle. In that case Athena keeps dispatching to a dead queue and the operator restores at least one worker. No exchange-side cleanup is required because nothing got placed in the dead window.

---

## Horizon restart contract

The Horizon-restart-after-job-class-change rule (`php artisan horizon:terminate` after editing any class under `Jobs/`, `Listeners/`, queued classes) applies to **Apollo and Ares only** — Athena's dispatch daemon is a separate supervisor and picks up code changes on its own restart cycle.

---

## Cross-lens links

- **[Position lifecycle](/docs/lifecycles/position-lifecycle)** — the step sequences these workers execute
- **[Athena (ingestion)](/docs/servers/athena)** — the box that dispatches workloads here
- **[Horizon queues](/docs/subsystems/horizon-queues)** — queue assignment, balancing strategies, supervisor config
