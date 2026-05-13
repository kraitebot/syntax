---
title: How to read this site
---

This site is the **functional documentation of Kraite** — written for Bruno, refreshed at every `/kraite-tag`. It captures *what* each subsystem does, *how* business flows run, and *why* major decisions were made. Code-level reference (class internals, signatures) lives elsewhere on a future `api.kraite.com`. {% .lead %}

{% quick-links %}

{% quick-link title="Subsystems" icon="installation" href="/docs/subsystems/dispatch-daemon" description="Scheduler, dispatch daemon, WebSocket streams, queues, market regime — what each piece of Kraite's machinery does and the decisions baked into it." /%}

{% quick-link title="Servers" icon="presets" href="/docs/servers/architecture-overview" description="Athena, Apollo, Ares, Zeus, Hermes — the multi-server topology and what each box is responsible for." /%}

{% quick-link title="Business domains" icon="plugins" href="/docs/domains/open-positions" description="Positions, orders, indicators, accounts — the business objects Kraite manipulates and the rules that govern them." /%}

{% quick-link title="Lifecycles" icon="theming" href="/docs/lifecycles/position-lifecycle" description="End-to-end flows: signal becomes a direction, direction becomes a position, position closes. Step classes named in order, decision points called out, rationale preserved." /%}

{% /quick-links %}

---

## The four lenses

Same system, four viewpoints. Each chapter is written from one viewpoint — never duplicating the full picture, always linking to the canonical chapter on the other lenses for depth.

| Lens | Question it answers | Example chapter |
|---|---|---|
| **Subsystem** | "What does this piece of machinery do?" | Dispatch daemon |
| **Server** | "Which box runs this and why?" | Apollo + Ares |
| **Domain** | "What is this business object and what states can it be in?" | Open positions |
| **Lifecycle** | "What's the full flow from start to finish?" | Position lifecycle |

A single change — say, a new step class added to the open flow — surfaces in **every relevant lens** but written from that lens's own angle:

- The **lifecycle** chapter shows it as a new node in the flow.
- The **subsystem** chapter shows it as new workload on the dispatcher.
- The **server** chapter shows it as work scheduled to a worker.
- The **domain** chapter shows it as a new state transition rule.

---

## Refresh model

This site mirrors **current state**. There is no history, no journal, no "what changed in v1.42". Every `/kraite-tag` overwrites the chapters touched by the changes since the last tag. If a chapter says something, that's how Kraite works *today*.

Past incidents and rationale **are** preserved — but as the *reason a current rule exists*, not as a chronological log. "We place SL before TP" is current rule. The 2026-04-23 fast-trade incident appears as the rationale, not as history.

{% callout type="warning" title="This site is read-only documentation" %}
No live data, no metrics, no exchange state. For runtime observability check the operational dashboards. For code reference (class signatures, method-level detail), wait for `api.kraite.com`.
{% /callout %}

---

## Demo status

The demo chapter is **[Position lifecycle](/docs/lifecycles/position-lifecycle)** — the canonical deep chapter that defines the depth and tone for everything else. The other lens views of the same flow live at:

- [Dispatch daemon](/docs/subsystems/dispatch-daemon) — subsystem angle
- [Apollo + Ares](/docs/servers/apollo-ares) — server angle
- [Open positions](/docs/domains/open-positions) — domain angle

Other navigation entries are stubbed and will fill in as `/kraite-tag` runs touch them.
