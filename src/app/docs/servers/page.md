---
title: Servers
---

The **server lens** answers where Kraite physically runs. Production is one
private-use Hetzner server named `kraite`; the iPhone app remains outside the
VPS. {% .lead %}

{% quick-links %}

{% quick-link title="Architecture overview" icon="installation" href="/docs/servers/architecture-overview" description="The one-server topology, product paths, accepted blast radius, and mobile boundary." /%}

{% quick-link title="Kraite (all-in-one production)" icon="presets" href="/docs/servers/kraite" description="MySQL, Redis, ingestion, queues, daemons, web applications, worker budget, startup order, and release behavior." /%}

{% /quick-links %}

---

## Cross-lens entry points

- **[Subsystems](/docs/subsystems)** — what runs on the server
- **[Business domains](/docs/domains)** — what the runtime manipulates
- **[Lifecycles](/docs/lifecycles)** — how work travels through the host
