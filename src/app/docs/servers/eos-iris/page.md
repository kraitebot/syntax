---
title: Eos + Iris + Nyx + Hemera + Palaemon + Aristaeus (workers)
---

Eos, Iris, Nyx, Hemera, Palaemon, and Aristaeus are Kraite's six **trading worker servers** — interchangeable Horizon queue consumers that execute the bulk of the position / order workload dispatched from athena. They are stateless, identically configured boxes competing on the same `positions` / `orders` / `priority` queues. **There is no per-account-to-box binding** — any worker picks up any dispatched job. The six distinct public IPs spread Binance API call load naturally across workers as work distributes. {% .lead %}

This is the **server lens** view of the position lifecycle. For the per-step flow these workers consume, jump to [position lifecycle](/docs/lifecycles/position-lifecycle).

---

## What runs on Eos, Iris, Nyx, Hemera, Palaemon, and Aristaeus

All six boxes run an identical Horizon supervisor footprint:

| Queue | Processes | What it consumes |
|---|---|---|
| `positions` | 5 | Position-open + close + WAP block atomics |
| `orders` | 8 | Every `Place*OrderJob` / `Cancel*Job` against an exchange |
| `priority` | 3 | Time-critical work (close cascades, drift fixes, replacement orders) |
| `<hostname>` | 1 | Server-pinned connectivity probes (account-onboarding flow) |

Anything that holds a position-blocking exchange round-trip lives here, not on athena. Athena dispatches and then is free to dispatch the next thing.

---

## Why six boxes, not one

| Box | Public IP | Status |
|---|---|---|
| **Eos** | 204.168.137.153 | Online — Binance per-IP weight bucket #1 |
| **Iris** | 204.168.138.83 | Online — Binance per-IP weight bucket #2 |
| **Nyx** | 204.168.129.189 | Joined 2026-05-24 — Binance per-IP weight bucket #3 |
| **Hemera** | 77.42.68.254 | Joined 2026-05-30 — Binance per-IP weight bucket #4 |
| **Palaemon** | 37.27.192.42 | Joined 2026-06-12 — Binance per-IP weight bucket #5 |
| **Aristaeus** | 37.27.196.99 | Joined 2026-06-12 — Binance per-IP weight bucket #6 |

{% callout title="Architectural decision" %}
Binance applies its REST + WebSocket rate-limit weight budget **per source IP**, not per account. With a single worker box, every account's order traffic competes for the same ceiling — and during a volatile window (many simultaneous SL triggers, a fan-out of fresh DCA fills) the box would saturate and exchange calls would start getting throttled or banned. Six boxes with six distinct public IPs give six times the available weight headroom without changing the code path. The naming stays poetic too: hemera (primordial day) joins nyx (primordial night); palaemon (sea-protector) and aristaeus (god of the practical arts) extend the lineage as the fifth and sixth trading workers.
{% /callout %}

{% callout title="No per-account binding" %}
There is **no per-account-to-box routing** in Kraite by design. Accounts live in the shared DB; athena (the ingestion server) creates step classes and dispatches them onto the `positions` / `orders` / `priority` queues; eos / iris / nyx / hemera / palaemon / aristaeus all consume from the same Redis queues and any of the six workers can process any account's jobs. Because each worker holds a distinct public IP, the SAME account's outbound Binance API calls flow through whichever IP the worker holding the current job has — naturally spreading the per-IP weight load across the six IPs without any explicit account-to-box mapping. The six workers are pure capacity expansion + IP diversity, not routing logic.
{% /callout %}

---

## Why workers and the indicator pool are split

{% callout title="Architectural decision" %}
TAAPI's 75 req / 15 s rate limit means the indicator queue spends a substantial fraction of its wall-clock time **waiting** for the next window slot. Running those waiters on the same Horizon process pool as position / order work would starve real-time trading whenever an indicator fan-out is in progress. Moving indicators onto their own dedicated box (tyche) means the throttler can park as long as it needs without ever delaying a position-close atomic. See [tyche](/docs/servers/tyche).
{% /callout %}

---

## Failure isolation

A worker crash takes down the steps mid-flight on that box. The orchestrator-level retry on athena re-dispatches the failed atomic to whichever worker is alive next tick. Because every order-placement atomic is **idempotent on `exchange_order_id`** ([decision documented in the open phase](/docs/lifecycles/position-lifecycle#decision-retry-idempotency-on-order-placements)), a worker swap mid-block does not produce duplicate orders on the exchange.

Loss of *all six* workers is the only mode that stalls trading. Athena keeps dispatching to a dead queue and the operator restores at least one worker. No exchange-side cleanup is required because nothing got placed in the dead window.

Loss of *one* worker reduces fleet capacity to five-sixths on positions / orders / priority, but the surviving workers absorb the dead box's account range (Binance is partitioned in the data model; the actual jobs just all land on the surviving IPs until the dead box returns). Loss of *three* workers reduces capacity to half but trading continues at degraded throughput.

---

## Horizon restart contract

The Horizon-restart-after-job-class-change rule (`php artisan horizon:terminate` after editing any class under `Jobs/`, `Listeners/`, queued classes) applies to **Eos, Iris, Nyx, Hemera, Palaemon, and Aristaeus**, plus tyche for indicator / cronjob classes — athena's `user-data-stream` supervisor is a separate pool and picks up changes on its own restart cycle, and the dispatch daemon is yet another supervisor entirely.

---

## Cross-lens links

- **[Position lifecycle](/docs/lifecycles/position-lifecycle)** — the step sequences these workers execute
- **[Athena (ingestion + web)](/docs/servers/athena)** — the box that dispatches workloads here
- **[Tyche (indicators + cronjobs)](/docs/servers/tyche)** — the sibling worker isolated from trading
- **[Horizon queues](/docs/subsystems/horizon-queues)** — queue assignment, balancing strategies, supervisor config
