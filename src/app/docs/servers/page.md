---
title: Servers
---

The **server lens** answers "where does this physically run?" Kraite's ten-box Hetzner topology is deliberately split: one stateful core for database and Redis, one ingestion brain, one dedicated web host, six interchangeable trading workers split by Binance per-IP weight, and one isolated worker for indicator throttling. Each box has a well-defined role; any one can be lost without dragging down the rest of the system. {% .lead %}

{% quick-links %}

{% quick-link title="Architecture overview" icon="installation" href="/docs/servers/architecture-overview" description="The full ten-box topology. Topology diagram, role split, failure semantics for each box, and the cross-references into per-server chapters." /%}

{% quick-link title="Hyperion (database + Redis)" icon="theming" href="/docs/servers/hyperion" description="The stateful core. MySQL 8.4.8 plus Redis 8.0.5 on a dedicated AMD-EPYC box. Tuned for the write-heavy step-dispatcher workload — 10 G buffer pool, 5000 IO capacity, non-blocking backups." /%}

{% quick-link title="Athena (ingestion)" icon="presets" href="/docs/servers/athena" description="The trading brain. Scheduler, dispatch daemon, both WebSocket daemons, user-data Horizon, and a secondary indicators pool. Web role moved to pheme on 2026-06-01." /%}

{% quick-link title="Pheme (web)" icon="presets" href="/docs/servers/pheme" description="Dedicated web host — nginx + php8.5-fpm serving admin.kraite.com + kraite.com + syntax.kraite.com. No exchange API calls, no step-router consumer. Smallest non-trivial blast radius in the fleet." /%}

{% quick-link title="Eos + Iris + Nyx + Hemera + Palaemon + Aristaeus (workers)" icon="plugins" href="/docs/servers/eos-iris" description="Six interchangeable trading workers — Horizon consumers competing on the same positions / orders / priority queues. No per-account-to-box binding by design. Six distinct public IPs spread Binance API call load naturally across workers as dispatched jobs distribute." /%}

{% quick-link title="Tyche (indicators + cronjobs)" icon="lightbulb" href="/docs/servers/tyche" description="Isolated worker. Runs 8 indicator, 6 cronjob, 3 priority, and 2 connectivity-probe processes. Kept off the trading boxes so TAAPI rate-limit waits never starve real-time position / order processing." /%}

{% /quick-links %}

---

## Cross-lens entry points

- **[Subsystems](/docs/subsystems/dispatch-daemon)** — *what* runs on each box (the daemon on athena, the workers on eos / iris / nyx).
- **[Business domains](/docs/domains/open-positions)** — *what* each box manipulates (positions, orders, indicators).
- **[Lifecycles](/docs/lifecycles/position-lifecycle)** — *how* a flow traverses the topology end-to-end.
