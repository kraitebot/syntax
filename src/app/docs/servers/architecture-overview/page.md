---
title: Server architecture overview
---

Kraite runs on a seven-box Hetzner topology, each box with a well-defined role: one stateful core (database + Redis), one ingestion brain that also hosts the public web vhosts, four interchangeable trading workers split by Binance per-IP weight, and one isolated worker for indicator throttling. Every server runs `APP_ENV=production` and connects to the others over the private `kraite-net` (10.0.0.0/16) network. Roles are cleanly separated so any single box can be lost (or redeployed) without dragging down the rest of the system. {% .lead %}

This is the **server lens** index. Each box has its own canonical chapter; this page is the map.

---

## The eight boxes

| Server | Role | HORIZON_ENV | Canonical chapter |
|---|---|---|---|
| **Hyperion** | Database (MySQL 8.4.8) + Redis (8.0.5) | — | [Hyperion](/docs/servers/hyperion) |
| **Athena** | Ingestion (scheduler, dispatch daemon, WS streams, user-data Horizon) | `athena` | [Athena](/docs/servers/athena) |
| **Pheme** | Web (admin, console, kraite.com, syntax) — nginx + php8.5-fpm | *(deferred — `pheme-web` supervisor not yet wired)* | [Pheme](/docs/servers/pheme) |
| **Eos** | Trading worker — positions / orders / priority | `eos` | [Eos + Iris + Nyx + Hemera](/docs/servers/eos-iris) |
| **Iris** | Trading worker — positions / orders / priority | `iris` | [Eos + Iris + Nyx + Hemera](/docs/servers/eos-iris) |
| **Nyx** | Trading worker — positions / orders / priority | `nyx` | [Eos + Iris + Nyx + Hemera](/docs/servers/eos-iris) |
| **Hemera** | Trading worker — positions / orders / priority | `hemera` | [Eos + Iris + Nyx + Hemera](/docs/servers/eos-iris) |
| **Tyche** | Isolated worker — indicators (10) + cronjobs (3) | `tyche` | [Tyche](/docs/servers/tyche) |

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
                             │  └─▲─▲─▲──▲───┘
                             │    │ │ │  │
                 dispatched  │    │ │ │  │  all servers read/write
                 to Redis    │    │ │ │  │  here via 10.0.0.0/16
                             ▼    │ │ │  │
         ┌───────┬────────┬──────┬─┴─┴─┴──┴─────────┐
         │       │        │      │                   │
      ┌──┴──┐ ┌──┴───┐ ┌──┴──┐ ┌─┴─────┐        ┌────┴──┐
      │ Eos │ │ Iris │ │ Nyx │ │Hemera │        │ Tyche │
      │work │ │ work │ │ work│ │ work  │        │ind+cr │
      └─────┘ └──────┘ └─────┘ └───────┘        └───────┘
      Binance Binance  Binance Binance          TAAPI fan-out,
      IP #1   IP #2    IP #3   IP #4            cronjobs
```

> **Architecture**: athena creates the step classes, dispatches them onto Redis queues, and hosts every account's WebSocket + user-data streams (hence the higher RAM). eos / iris / nyx / hemera are **interchangeable Horizon consumers** competing on the same `positions` / `orders` / `priority` queues — there is no per-account-to-box binding by design. Any worker picks up any dispatched job; the four distinct public IPs spread Binance API call load across workers as work distributes. Tyche stays separate so heavy / TAAPI-throttled indicator + cronjob work never starves real-time trading.

Redis and MySQL both live on Hyperion (the dedicated AMD-EPYC box). The five worker boxes (eos, iris, nyx, hemera, tyche) and athena all consume from that shared Redis; tyche stays out of the trading queue path so its TAAPI waits never starve eos / iris / nyx / hemera.

---

## Why the split

{% callout title="Architectural decision" %}
The fleet is split along **what blocks what**. Stateful storage (Hyperion) is on its own dedicated CPU because both MySQL and Redis are latency-sensitive for the whole fleet. The brain (athena) is on its own box because the scheduler, dispatch daemon, and WS streams all need predictable wall-clock cadence — they can't compete with arbitrary trading work for CPU. Trading workers (eos, iris, nyx, hemera) are split into four by Binance's per-IP weight ceiling, not by code role. The indicator worker (tyche) is split off because TAAPI rate-limit waits would otherwise hold process slots that real-time trading needs. Seven boxes, four distinct splits, each driven by a real constraint observed in production.
{% /callout %}

---

## Failure semantics

| Box lost | What stops |
|---|---|
| **Hyperion** | Total system halt. Every app reads/writes MySQL here; every queue lives in Redis here. The recovery path is operational (B2 restore + DNS swap), not architectural. |
| **Athena** | Scheduler + dispatch daemon + WS push paths. Workers on eos / iris / nyx / hemera / tyche continue draining what's already enqueued; nothing new gets dispatched until athena is back. Pheme (web) is **unaffected** — operator UI keeps serving. |
| **Pheme** | All four public vhosts (admin / console / kraite.com / syntax) return 5xx through Cloudflare for the duration. Trading is unaffected — athena, workers, and hyperion all stay online. Smallest non-trivial blast radius in the fleet. |
| **Eos** OR **Iris** OR **Nyx** OR **Hemera** | Capacity drops to three-quarters on `positions` / `orders` / `priority`. The surviving workers absorb all account ranges (the partition is in the data model, not the queue) until the dead box returns. |
| **Two of Eos/Iris/Nyx/Hemera** | Capacity drops to half. Trading continues at degraded throughput; surviving workers handle every account range. |
| **All four trading workers** | Position state machines stall mid-flight. Trading freezes; existing exchange-side orders continue per their own logic. |
| **Tyche** | Indicator pipeline + cronjobs halt. Position selection stops finding new candidates; existing positions are unaffected. |

---

## Cross-lens links

- **[Horizon queues](/docs/subsystems/horizon-queues)** — the queue surface every worker box consumes
- **[Dispatch daemon](/docs/subsystems/dispatch-daemon)** — the brain on athena
- **[Position lifecycle](/docs/lifecycles/position-lifecycle)** — what flows through this topology end-to-end
