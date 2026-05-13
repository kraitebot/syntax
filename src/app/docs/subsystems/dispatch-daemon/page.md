---
title: Dispatch daemon
---

The dispatch daemon is a persistent single-process step orchestrator that replaced the old scheduler-fork model. It runs on **Athena** (ingestion) under supervisor and is the entry point for every queued workload that originates from cron — including the entire position-open and position-close blocks. {% .lead %}

This is the **subsystem lens** view. For the full per-step ordering of the position flow it dispatches, jump to [position lifecycle](/docs/lifecycles/position-lifecycle).

---

## Why a daemon and not scheduler forks

The pre-daemon model spawned one PHP process per scheduled command per tick. At Kraite's cadence — sub-minute scheduling on multiple commands, several per second once `kraite:cron-create-positions` and `kraite:cron-sync-orders` were both active — the fork rate became the dominant OS-level cost. A long-lived daemon owns warm Eloquent state, an open Redis connection, and a step-execution loop, eliminating per-tick fork/boot overhead.

{% callout title="Decision rationale" %}
The daemon also gives us a single chokepoint for orchestrator-level concerns (idempotency guards, dedup, retry semantics) that were previously scattered across each job class. New workflows like the position-open block plug into the daemon's step model and inherit those guards for free.
{% /callout %}

---

## Position-lifecycle workload

Three workload entry points in the position lifecycle hit the daemon:

| Entry point | What the daemon dispatches | Canonical chapter |
|---|---|---|
| `kraite:cron-create-positions` (every 3 min) | `AssignBestTokensToPositionSlotsJob` → `DispatchPositionSlotsJob` → N × `DispatchPositionJob` blocks | [Open phase](/docs/lifecycles/position-lifecycle#open) |
| `OrderObserver::updated()` on `LIMIT FILLED` | `ApplyWapJob` block | [WAP phase](/docs/lifecycles/position-lifecycle#wap-weighted-average-price) |
| `OrderObserver::updated()` on `PROFIT-* / STOP-MARKET FILLED` | `ClosePositionJob` block | [Close phase](/docs/lifecycles/position-lifecycle#close) |

The daemon doesn't *know* about position semantics — it dispatches the block and lets the steps inside the block enforce status transitions, idempotency, and the SL-before-TP invariant. Each step class name ordering belongs in the canonical lifecycle chapter, not here.

---

## Guarantees the daemon provides

- **Single-process execution** — no two scheduler ticks ever race on the same workload, eliminating the duplicate-block class of bugs that motivated the rewrite
- **Step-level retry semantics** — failed atomics route through `resolve-exception` rather than crashing the daemon
- **Orchestrator idempotency hooks** — `compute()` short-circuits on retry if any child step already exists in the block (the position-open flow uses this directly via `PreparePositionsOpeningJob`)
- **Survives Horizon restarts** — daemon and Horizon are independent supervisors; restarting workers on Apollo/Ares does not interrupt the dispatch loop on Athena

---

## Cross-lens links

- **[Position lifecycle](/docs/lifecycles/position-lifecycle)** — full step-by-step flow this daemon dispatches
- **[Athena (ingestion)](/docs/servers/athena)** — the box this daemon runs on
- **[Horizon queues](/docs/subsystems/horizon-queues)** — where the dispatched jobs are consumed
