---
title: Eos + Iris (workers)
---

Eos and Iris are Kraite's two **trading worker servers** — Horizon queue consumers that execute the bulk of the position / order workload dispatched from athena. They are stateless, identically configured boxes split only by which Binance accounts they're assigned to. The split exists to carve Binance's per-IP weight budget in two; otherwise they're hot-spare for each other. {% .lead %}

This is the **server lens** view of the position lifecycle. For the per-step flow these workers consume, jump to [position lifecycle](/docs/lifecycles/position-lifecycle).

---

## What runs on Eos and Iris

Both boxes run an identical Horizon supervisor footprint:

| Queue | Processes | What it consumes |
|---|---|---|
| `positions` | 10 | Position-open + close + WAP block atomics |
| `orders` | 15 | Every `Place*OrderJob` / `Cancel*Job` against an exchange |
| `priority` | 5 | Time-critical work (close cascades, drift fixes, replacement orders) |
| `<hostname>` | 2 | Server-pinned connectivity probes |

Anything that holds a position-blocking exchange round-trip lives here, not on athena. Athena dispatches and then is free to dispatch the next thing.

---

## Why the split is by account range, not by queue

| Box | Public IP | Account assignment |
|---|---|---|
| **Eos** | 204.168.137.153 | Binance accounts 1 – 25 |
| **Iris** | 204.168.138.83 | Binance accounts 26 – 50 + every Bitget account |

{% callout title="Architectural decision" %}
Binance applies its REST + WebSocket rate-limit weight budget **per source IP**, not per account. With one worker box, every account's order traffic competes for the same ceiling — and during a volatile window (many simultaneous SL triggers, a fan-out of fresh DCA fills) the box would saturate and exchange calls would start getting throttled or banned. Splitting accounts across two boxes with two distinct public IPs doubles the available weight headroom without changing the code path. The assignment cutoff (1–25 / 26–50) is just a deterministic hash on `account_id`; nothing about an account is special to either box.
{% /callout %}

Bitget lives entirely on Iris because Bitget's per-IP ceiling is lower than Binance's, and concentrating Bitget on one box keeps its weight accounting simple. KuCoin and Bybit accounts (none active today) would follow the same pattern.

---

## Why workers and the indicator pool are split

{% callout title="Architectural decision" %}
TAAPI's 75 req / 15 s rate limit means the indicator queue spends a substantial fraction of its wall-clock time **waiting** for the next window slot. Running those waiters on the same Horizon process pool as position / order work would starve real-time trading whenever an indicator fan-out is in progress. Moving indicators onto their own dedicated box (tyche) means the throttler can park as long as it needs without ever delaying a position-close atomic. See [tyche](/docs/servers/tyche).
{% /callout %}

---

## Failure isolation

A worker crash takes down the steps mid-flight on that box. The orchestrator-level retry on athena re-dispatches the failed atomic to whichever worker is alive next tick. Because every order-placement atomic is **idempotent on `exchange_order_id`** ([decision documented in the open phase](/docs/lifecycles/position-lifecycle#decision-retry-idempotency-on-order-placements)), a worker swap mid-block does not produce duplicate orders on the exchange.

Loss of *both* workers is the only mode that stalls trading. Athena keeps dispatching to a dead queue and the operator restores at least one worker. No exchange-side cleanup is required because nothing got placed in the dead window.

Loss of *one* worker reduces fleet capacity by half on positions / orders / priority, but the surviving worker absorbs both account ranges (Binance is still partitioned in the data model; the actual jobs just all land on one IP until the dead box returns).

---

## Horizon restart contract

The Horizon-restart-after-job-class-change rule (`php artisan horizon:terminate` after editing any class under `Jobs/`, `Listeners/`, queued classes) applies to **Eos and Iris**, plus tyche for indicator / cronjob classes — athena's `user-data-stream` supervisor is a separate pool and picks up changes on its own restart cycle, and the dispatch daemon is yet another supervisor entirely.

---

## Cross-lens links

- **[Position lifecycle](/docs/lifecycles/position-lifecycle)** — the step sequences these workers execute
- **[Athena (ingestion + web)](/docs/servers/athena)** — the box that dispatches workloads here
- **[Tyche (indicators + cronjobs)](/docs/servers/tyche)** — the sibling worker isolated from trading
- **[Horizon queues](/docs/subsystems/horizon-queues)** — queue assignment, balancing strategies, supervisor config
