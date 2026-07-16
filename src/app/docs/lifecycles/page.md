---
title: Lifecycles
---

The **lifecycle lens** answers "what's the full flow from start to finish?" Lifecycles are end-to-end sequences that thread through multiple subsystems, multiple servers, and multiple business domains. Each lifecycle chapter is the canonical step-by-step ordering — every other chapter cross-links *into* a specific anchor here when describing what flows past it. {% .lead %}

{% quick-links %}

{% quick-link title="Position lifecycle" icon="installation" href="/docs/lifecycles/position-lifecycle" description="The deep canonical chapter. Slot assignment → open (11 steps) → sync → WAP on DCA fill → close (9 steps). SL-before-TP invariant, retry idempotency, fast-trade rationale all spelled out here." /%}

{% quick-link title="Order lifecycle" icon="presets" href="/docs/lifecycles/order-lifecycle" description="The per-order state machine running underneath the position flow. Placement / fill / cancel sequence, observer arms (LIMIT FILLED → WAP, TP/SL FILLED → close), idempotency on exchange_order_id." /%}

{% quick-link title="Signal → direction" icon="theming" href="/docs/lifecycles/signal-direction" description="How 36 indicator readouts per symbol collapse into LONG / SHORT / none. Hourly :30 cadence, per-timeframe vote, cross-timeframe agreement, Binance-to-everyone propagation." /%}

{% /quick-links %}

---

## Cross-lens entry points

- **[Subsystems](/docs/subsystems/dispatch-daemon)** — *what* machinery executes each step (the daemon dispatches, the queues consume).
- **[Servers](/docs/servers/architecture-overview)** — *where* each step physically runs (six interchangeable trading workers for execution, Athena for dispatch).
- **[Business domains](/docs/domains/open-positions)** — *what* each step changes (position state, order state, indicator readouts).
