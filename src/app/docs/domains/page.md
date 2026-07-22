---
title: Business domains
---

The **business-domain lens** answers "what is this business object and what states can it be in?" Domains are the things Kraite *manipulates* — positions, orders, accounts, indicators — and the rules that govern their state transitions. Domain chapters describe contracts, invariants, and ownership; the *flows* that move objects between states live in the lifecycle lens. {% .lead %}

{% quick-links %}

{% quick-link title="Open positions" icon="installation" href="/docs/domains/open-positions" description="The central domain. Slot-based opening (6 LONG + 6 SHORT seeded), status state machine, the SL-before-TP invariant, partial-fill and WAP semantics. Every other domain orbits this one." /%}

{% quick-link title="Orders" icon="presets" href="/docs/domains/orders" description="Per-order state machine — market entries, limit-rung DCAs, take-profits, stop-losses. Idempotency anchored to exchange_order_id. Push-fill via WS, polling-fill as safety net." /%}

{% quick-link title="Accounts" icon="plugins" href="/docs/domains/accounts" description="One row per (user, exchange). Credentials, position-mode flag, can_trade toggle. The unit of credential isolation — only Binance accounts query TAAPI; others receive direction by copy." /%}

{% quick-link title="Indicators" icon="theming" href="/docs/domains/indicators" description="Seven active TAAPI indicators per symbol and evaluated timeframe. The throttler-bound input layer that feeds the progressive signal-to-direction lifecycle." /%}

{% quick-link title="Token selection" icon="lightbulb" href="/docs/domains/token-selection" description="Which symbol fills a freed slot. Four selection priorities (override / fast-track / BTC-bias / fallback), log-compressed scoring, stability + diversification + S/R proximity multipliers." /%}

{% /quick-links %}

---

## Cross-lens entry points

- **[Subsystems](/docs/subsystems/dispatch-daemon)** — *what* runs the workflows that change domain state (the daemon, the queues, the streams).
- **[Servers](/docs/servers/architecture-overview)** — *where* MySQL and every workflow run on the single Kraite host.
- **[Lifecycles](/docs/lifecycles/position-lifecycle)** — *how* a domain object moves through its states end-to-end.
