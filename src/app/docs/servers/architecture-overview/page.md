---
title: Server architecture overview
---

Kraite runs on a six-server topology, each box with a single, well-defined role: one ingestion brain, two interchangeable position workers, one indicator worker, one database, one web edge. Every server runs `APP_ENV=production` and pulls shared environment from `/home/waygou/.env.kraite`. Roles are cleanly separated so any single box can be lost (or redeployed) without dragging down the rest of the system. {% .lead %}

This is the **server lens** index. Each box has its own canonical chapter; this page is the map.

---

## The six servers

| Server | Role | HORIZON_ENV | Canonical chapter |
|---|---|---|---|
| **Athena** | Ingestion — scheduler, Redis, dispatch daemon, WS streams | `athena` | [Athena](/docs/servers/athena) |
| **Apollo** | Worker — positions / orders / priority | `apollo` | [Apollo + Ares](/docs/servers/apollo-ares) |
| **Ares** | Worker — identical to Apollo (hot spare + capacity doubling) | `ares` | [Apollo + Ares](/docs/servers/apollo-ares) |
| **Artemis** | Indicator worker — TAAPI fan-out, dedicated queue | `artemis` | (per-server chapter pending) |
| **Zeus** | Database — MySQL only | — | [Zeus](/docs/servers/zeus) |
| **Hermes** | Web — `kraite.com` + `admin.kraite.com` | — | [Hermes](/docs/servers/hermes) |

Hostnames map to public IPs in shared DNS; refer to the operator runbook for the live mapping.

---

## Topology at a glance

```
                       ┌──────────┐
                       │  Hermes  │  (kraite.com, admin.kraite.com)
                       │   web    │
                       └────┬─────┘
                            │ HTTPS
                            ▼
        ┌──────────────────────────────────────┐
        │             Athena (brain)           │
        │  scheduler · daemon · Redis · WS     │
        └─┬────────┬────────────┬───────────┬──┘
          │ Redis  │ Redis      │ Redis     │ Redis
          ▼        ▼            ▼           ▼
      ┌──────┐ ┌──────┐    ┌────────┐  ┌─────────┐
      │Apollo│ │ Ares │    │Artemis │  │  Zeus   │
      │workr │ │workr │    │ind-fan │  │ MySQL   │
      └──┬───┘ └──┬───┘    └───┬────┘  └────▲────┘
         └────────┴────────────┴────────────┘
                  all servers → MySQL on Zeus
```

Redis lives on Athena (one instance, shared by every Horizon worker). MySQL lives on Zeus (one instance, shared by every app and worker). The four ingestion-class boxes (Athena, Apollo, Ares, Artemis) run Horizon; Zeus and Hermes do not.

---

## Why the split

{% callout title="Architectural decision" %}
The brain (Athena) and the muscle (Apollo / Ares / Artemis) are split so a slow exchange round-trip on a worker never blocks the next dispatch on Athena. It also makes a worker restart a non-event: rolling out a job-class change cycles Horizon on Apollo / Ares without touching the scheduler, the daemon, or the WebSocket streams. Zeus is split off so a DB tuning change or a backup job has zero impact on application processes.
{% /callout %}

---

## Failure semantics

| Server lost | What stops |
|---|---|
| **Athena** | Scheduler + dispatch daemon + WS push paths. Workers continue draining what's already enqueued. Polling cron is gone, so re-orchestration stalls until Athena returns. |
| **Apollo** OR **Ares** | Capacity halves on `positions` / `orders` / `priority`. The remaining worker absorbs full load; nothing breaks. |
| **Apollo** AND **Ares** | Position state machines stall mid-flight. Athena's tiny self-sufficiency workers (2 each) keep the system inching forward at ~10 % capacity. |
| **Artemis** | Indicator pipeline halts. Position selection stops finding new candidates; existing positions are unaffected. |
| **Zeus** | Total system halt. Every app reads/writes here. |
| **Hermes** | Public site + operator UI offline. Trading continues uninterrupted. |

---

## Cross-lens links

- **[Horizon queues](/docs/subsystems/horizon-queues)** — the queue surface every ingestion-class server consumes
- **[Dispatch daemon](/docs/subsystems/dispatch-daemon)** — the brain on Athena
- **[Position lifecycle](/docs/lifecycles/position-lifecycle)** — what flows through this topology end-to-end
