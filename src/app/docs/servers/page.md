---
title: Servers
---

The **server lens** answers "where does this physically run?" Kraite's six-server topology is deliberately split: one ingestion brain, two interchangeable position workers, one indicator worker, one database, one web edge. Each box has a single, well-defined role; any one can be lost without dragging down the rest of the system. {% .lead %}

{% quick-links %}

{% quick-link title="Architecture overview" icon="installation" href="/docs/servers/architecture-overview" description="The full six-server topology. Topology diagram, role split, failure semantics for each box, and the cross-references into per-server chapters." /%}

{% quick-link title="Athena (ingestion)" icon="presets" href="/docs/servers/athena" description="The brain. Scheduler, dispatch daemon, Redis, two WebSocket daemons, plus a small self-sufficiency Horizon footprint for deploy windows." /%}

{% quick-link title="Apollo + Ares (workers)" icon="plugins" href="/docs/servers/apollo-ares" description="Two interchangeable worker boxes. Where positions / orders / priority queue traffic actually executes. Hot-spare for each other; identical config." /%}

{% quick-link title="Zeus (database)" icon="theming" href="/docs/servers/zeus" description="MySQL only. Tuned for the write-heavy step-dispatcher workload — 10 G buffer pool, 5000 IO capacity, non-blocking backups. The single point of failure." /%}

{% quick-link title="Hermes (web)" icon="lightbulb" href="/docs/servers/hermes" description="The web edge — kraite.com (public marketing) plus admin.kraite.com (operator UI). Runs no Horizon, no scheduler, no exchange code. Loss does not interrupt trading." /%}

{% /quick-links %}

---

## Cross-lens entry points

- **[Subsystems](/docs/subsystems/dispatch-daemon)** — *what* runs on each box (the daemon on Athena, the workers on Apollo / Ares).
- **[Business domains](/docs/domains/open-positions)** — *what* each box manipulates (positions, orders, indicators).
- **[Lifecycles](/docs/lifecycles/position-lifecycle)** — *how* a flow traverses the topology end-to-end.
