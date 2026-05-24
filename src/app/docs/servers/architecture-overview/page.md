---
title: Server architecture overview
---

Kraite runs on a five-box Hetzner topology, each box with a well-defined role: one stateful core (database + Redis), one ingestion brain that also hosts the public web vhosts, two interchangeable trading workers split by Binance per-IP weight, and one isolated worker for indicator throttling. Every server runs `APP_ENV=production` and connects to the others over the private `kraite-net` (10.0.0.0/16) network. Roles are cleanly separated so any single box can be lost (or redeployed) without dragging down the rest of the system. {% .lead %}

This is the **server lens** index. Each box has its own canonical chapter; this page is the map.

---

## The five boxes

| Server | Role | HORIZON_ENV | Canonical chapter |
|---|---|---|---|
| **Hyperion** | Database (MySQL 8.4.8) + Redis (8.0.5) | — | [Hyperion](/docs/servers/hyperion) |
| **Athena** | Ingestion (scheduler, dispatch daemon, WS streams, user-data Horizon) + Web (admin, kraite.com, syntax) | `athena` | [Athena](/docs/servers/athena) |
| **Eos** | Trading worker — positions / orders / priority (Binance accounts 1–25) | `eos` | [Eos + Iris](/docs/servers/eos-iris) |
| **Iris** | Trading worker — positions / orders / priority (Binance accounts 26–50 + Bitget) | `iris` | [Eos + Iris](/docs/servers/eos-iris) |
| **Tyche** | Isolated worker — indicators (20) + cronjobs (5) | `tyche` | [Tyche](/docs/servers/tyche) |

Hostnames map to public IPs in the operator's credentials store; refer to the operator runbook for the live mapping.

---

## Topology at a glance

```
                       ┌───────────┐
                       │  Athena   │  (admin, kraite.com,
                       │  brain    │   syntax, scheduler,
                       │   + web   │   dispatch daemon, WS)
                       └──┬──────┬─┘
                          │      │ Redis ticks (private LAN)
                          │      ▼
                          │  ┌────────────┐
                          │  │  Hyperion  │  (MySQL + Redis)
                          │  └─▲─▲─▲──────┘
                          │    │ │ │
              dispatched  │    │ │ │  all servers read/write
              to Redis    │    │ │ │  here via 10.0.0.0/16
                          ▼    │ │ │
                ┌─────────┬────┴─┴─┴───────┐
                │         │                │
            ┌───┴──┐  ┌───┴──┐         ┌───┴───┐
            │ Eos  │  │ Iris │         │ Tyche │
            │ work │  │ work │         │ind+cr │
            └──────┘  └──────┘         └───────┘
            Binance   Binance          TAAPI fan-out,
            1–25      26–50 + Bitget   cronjobs
```

Redis and MySQL both live on Hyperion (the dedicated AMD-EPYC box). The three worker boxes (eos, iris, tyche) and athena all consume from that shared Redis; tyche stays out of the trading queue path so its TAAPI waits never starve eos / iris.

---

## Why the split

{% callout title="Architectural decision" %}
The fleet is split along **what blocks what**. Stateful storage (Hyperion) is on its own dedicated CPU because both MySQL and Redis are latency-sensitive for the whole fleet. The brain (athena) is on its own box because the scheduler, dispatch daemon, and WS streams all need predictable wall-clock cadence — they can't compete with arbitrary trading work for CPU. Trading workers (eos, iris) are split into two by Binance's per-IP weight ceiling, not by code role. The indicator worker (tyche) is split off because TAAPI rate-limit waits would otherwise hold process slots that real-time trading needs. Five boxes, four distinct splits, each driven by a real constraint observed in production.
{% /callout %}

---

## Failure semantics

| Box lost | What stops |
|---|---|
| **Hyperion** | Total system halt. Every app reads/writes MySQL here; every queue lives in Redis here. The recovery path is operational (B2 restore + DNS swap), not architectural. |
| **Athena** | Scheduler + dispatch daemon + WS push paths + every public vhost. Workers on eos / iris / tyche continue draining what's already enqueued; nothing new gets dispatched until athena is back. |
| **Eos** OR **Iris** | Capacity halves on `positions` / `orders` / `priority`. The surviving worker absorbs both account ranges (the partition is in the data model, not the queue) until the dead box returns. |
| **Eos** AND **Iris** | Position state machines stall mid-flight. Trading freezes; existing exchange-side orders continue per their own logic. |
| **Tyche** | Indicator pipeline + cronjobs halt. Position selection stops finding new candidates; existing positions are unaffected. |

---

## Cross-lens links

- **[Horizon queues](/docs/subsystems/horizon-queues)** — the queue surface every worker box consumes
- **[Dispatch daemon](/docs/subsystems/dispatch-daemon)** — the brain on athena
- **[Position lifecycle](/docs/lifecycles/position-lifecycle)** — what flows through this topology end-to-end
