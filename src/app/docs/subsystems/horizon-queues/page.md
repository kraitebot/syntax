---
title: Horizon queues
---

Horizon is the consumer side of every workload Kraite dispatches. Where the [dispatch daemon](/docs/subsystems/dispatch-daemon) is the brain that decides what runs and when, Horizon queues are the muscle that does the actual exchange round-trips, indicator math, and DB writes. Horizon runs on **all four ingestion-class servers** (athena, apollo, ares, artemis) and each one consumes a deliberately different slice of the queue surface. {% .lead %}

This is the **subsystem lens** view. For the per-server worker counts in physical terms, see the [server architecture overview](/docs/servers/architecture-overview).

---

## The seven queues

Every job dispatched in Kraite lands in one of seven queues:

| Queue | What lives here |
|---|---|
| `cronjobs` | Top-level scheduled commands' job graph entry points (the `kraite:cron-*` tree) |
| `user-data-stream` | `ProcessUserDataEventJob` frames coming off the Binance user-data WebSocket daemon |
| `positions` | Position-block atomics — open / close / WAP / sync individual position state machines |
| `orders` | Per-exchange order-placement and cancel atomics (the chatty queue — every `Place*OrderJob` and `Cancel*Job`) |
| `priority` | Hot-path replacements when a position needs immediate re-orchestration (manual close detected, drift, etc.) |
| `indicators` | TAAPI-bound symbol indicator computation jobs (rate-limit-sensitive) |
| `<hostname>` | Per-host queues for jobs that *must* run on the box that dispatched them (rare; supervisor stays warm) |

---

## Per-server worker layout

Worker counts per queue per server. Empty cells mean that server doesn't consume that queue at all:

| Queue | Athena | Apollo | Ares | Artemis |
|---|---:|---:|---:|---:|
| `cronjobs` | 5 | — | — | — |
| `user-data-stream` | 5 | — | — | — |
| `positions` | 2 | 10 | 10 | — |
| `orders` | 2 | 15 | 15 | — |
| `priority` | 2 | 5 | 5 | — |
| `indicators` | — | — | — | 20 |
| `<hostname>` | 2 | 2 | 2 | 2 |

```
       Redis (single instance, hosted on Athena)
  ┌──────────────────────────────────────────────────┐
  │ cronjobs  user-data  positions  orders  priority │
  └────┬─────────┬──────────┬──────────┬──────────┬──┘
       ▼         ▼          ▼          ▼          ▼
   ┌──────┐ ┌──────┐ ┌──────────┐ ┌──────────┐ ┌──────┐
   │Athena│ │Athena│ │ Apollo + │ │ Apollo + │ │Artem.│
   │ x5   │ │ x5   │ │ Ares     │ │ Ares     │ │ x20  │
   └──────┘ └──────┘ │ x10 each │ │ x15 each │ └──────┘
                     └──────────┘ └──────────┘
```

Apollo and Ares are deliberately identical so a single one going down halves capacity but never breaks a queue. Artemis is the only consumer of `indicators` because TAAPI rate-limit accounting lives in one place — adding a second consumer would silently double the request rate.

---

## Why Athena holds small `positions` / `orders` / `priority` counts

{% callout title="Architectural decision" %}
Athena is the ingestion brain — it owns the scheduler, the dispatch daemon, the WebSocket streams, and the cron entry-point queue. It does **not** need to consume position / order / priority traffic in normal operation. The 2-worker allocation on each is a self-sufficiency hedge: during a deploy on Apollo + Ares (Horizon restart cycle, ~30 s where neither worker is consuming), Athena can keep the position state machines moving end-to-end at reduced capacity rather than letting the queue back up. Outside of deploys, those Athena workers sit nearly idle.
{% /callout %}

---

## Redis isolation

Every server runs Horizon against the **same Redis** (on athena), but each one sets a unique `HORIZON_PREFIX` so its supervisor key, metrics, and tags never collide with another server's. Horizon also uses `HORIZON_ENV` (not `APP_ENV`) to pick which supervisor block in `config/horizon.php` applies — every box runs `APP_ENV=production`, but `HORIZON_ENV=athena` / `apollo` / `ares` / `artemis` selects a completely different worker layout.

```
APP_ENV        = production       (everywhere — picks DB, env behaviour)
HORIZON_ENV    = athena | apollo | ares | artemis  (supervisor block)
HORIZON_PREFIX = horizon-athena   (etc — Redis key namespace)
```

Mixing these up is the most common cause of a "Horizon is up but no jobs are processing" report — usually `HORIZON_ENV` got left at a previous server's value during a hostname migration.

---

## What Horizon doesn't own

- **Scheduling.** The Laravel scheduler and the [dispatch daemon](/docs/subsystems/dispatch-daemon) are independent supervisors. Restarting Horizon does not interrupt either.
- **Stream daemons.** `kraite:stream-binance-user-data` and `kraite:stream-binance-prices` run under supervisor as long-lived processes — they *dispatch* into Horizon but are not Horizon-managed.
- **Step state machine.** Horizon executes the atomic `Job` payload; the step record's lifecycle (Pending / Dispatched / Running / Completed / Failed / …) is owned by the dispatch daemon and the step-dispatcher package.

---

## Cross-lens links

- **[Dispatch daemon](/docs/subsystems/dispatch-daemon)** — what feeds these queues
- **[Athena (ingestion)](/docs/servers/athena)** — Redis host + cron / user-data consumers
- **[Apollo + Ares (workers)](/docs/servers/apollo-ares)** — the bulk position / order / priority workers
- **[Position lifecycle](/docs/lifecycles/position-lifecycle)** — the canonical workload that flows through these queues
