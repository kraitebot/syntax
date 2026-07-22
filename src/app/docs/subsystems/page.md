---
title: Subsystems
---

The **subsystem lens** answers "what does this piece of machinery do?" — independently of where it runs (server lens), what it manipulates (domain lens), or how it threads through a flow (lifecycle lens). Five subsystems form Kraite's running infrastructure: a scheduler that owns time, a daemon that owns dispatch, two WebSocket streams that own real-time exchange events, a queue surface that owns concurrency, and a market-regime gate that owns whether new opens are allowed at all. {% .lead %}

{% quick-links %}

{% quick-link title="Dispatch daemon" icon="installation" href="/docs/subsystems/dispatch-daemon" description="The persistent supervisor process on Kraite that replaced scheduler forks with one long-lived loop. Every cron-originating workload flows through here." /%}

{% quick-link title="Scheduler" icon="presets" href="/docs/subsystems/scheduler" description="The Laravel scheduler — kline fetches, indicator computation, listenKey refreshes, balance snapshots. The time-driven entry point that hands off to the daemon and the queues." /%}

{% quick-link title="WebSocket streams" icon="plugins" href="/docs/subsystems/websocket-streams" description="Two long-lived daemons: per-account user-data WS for order events (push, <100 ms) and the public mark-price WS for ~1 Hz price refresh across all symbols and exchanges." /%}

{% quick-link title="Horizon queues" icon="theming" href="/docs/subsystems/horizon-queues" description="Eight bounded lanes on the single Kraite host. The consumer side of every trading, stream, indicator, scheduled, and web workload." /%}

{% quick-link title="Market regime" icon="lightbulb" href="/docs/subsystems/market-regime" description="The black-swan circuit breaker. Score 0–100, four bands (Calm / Elevated / Fragile / Critical), gates new opens at the Critical band. Override beats cooldown." /%}

{% /quick-links %}

---

## Cross-lens entry points

The subsystem lens is one of four. The same machinery shows up under three other angles:

- **[Servers](/docs/servers/architecture-overview)** — where every subsystem runs on the single production host.
- **[Business domains](/docs/domains/open-positions)** — *what* the subsystems manipulate (positions, orders, indicators, accounts, token selection).
- **[Lifecycles](/docs/lifecycles/position-lifecycle)** — *how* a single end-to-end flow threads through every subsystem in turn.
