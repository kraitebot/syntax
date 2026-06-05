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
- **Survives Horizon restarts** — daemon and Horizon are independent supervisors; restarting workers on eos / iris / nyx / hemera / tyche does not interrupt the dispatch loop on Athena

---

## Idle gating — DB truth, not flag files

When no work exists the daemon idles on a short sleep instead of ticking. The idle decision is made **per prefix** (default + trading) against the shared database — a sub-millisecond `EXISTS` over the non-terminal step states — and each prefix only ticks when it actually has active steps.

{% callout type="warning" title="Why not the activation flag files (incident 2026-06-05)" %}
The dispatcher framework keeps per-prefix activation flag files, touched whenever a step is created. The daemon originally gated its whole loop on the **default-prefix flag only** — so the moment default-prefix work drained, the daemon slept with trading steps still pending. Trading ladders crawled at one index hop per minute, woken only when the next scheduler cron recreated the flag. The flags are also per-machine: a child step created on a worker box touches the worker's filesystem, never Athena's — useless as a fleet-wide signal. The shared DB is correct on both axes, which is why the daemon's gate reads it directly. Caught during the first live trading smoke test; fixed in core v1.51.4.
{% /callout %}

---

## Cross-lens links

- **[Position lifecycle](/docs/lifecycles/position-lifecycle)** — full step-by-step flow this daemon dispatches
- **[Athena (ingestion)](/docs/servers/athena)** — the box this daemon runs on
- **[Horizon queues](/docs/subsystems/horizon-queues)** — where the dispatched jobs are consumed
