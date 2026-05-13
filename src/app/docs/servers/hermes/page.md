---
title: Hermes (web)
---

Hermes is Kraite's **web edge** — the single box that serves the public marketing site (`kraite.com`) and the operator UI (`admin.kraite.com`). It runs no Horizon, no scheduler, no daemons, and no exchange code. Hermes terminates HTTPS, serves Blade pages, and forwards every data request to MySQL on Zeus. {% .lead %}

This is the **server lens** view. The trading system runs entirely without Hermes — losing this box takes the public site and the operator UI offline, but does not interrupt trading.

---

## What runs on Hermes

| Workload | Notes |
|---|---|
| `kraite.com` (Laravel) | Public marketing site. Static-leaning — no exchange data, minimal DB traffic |
| `admin.kraite.com` (Laravel) | Operator UI. System dashboards, step browser, SQL query, commands runner, heartbeat, accounts drift view |
| Nginx + PHP-FPM | Standard web stack — no other tenants |

The two apps share the `brunocfalcao/hub-ui` Blade component library (sidebar, tabs, pager, data-table, live-header, badges).

---

## What does NOT run on Hermes

- **No Horizon.** Every job is consumed on Athena / Apollo / Ares / Artemis. Hermes never processes a queue frame.
- **No scheduler.** The Laravel scheduler runs on Athena.
- **No exchange code.** Hermes never opens a connection to Binance / Bybit / KuCoin / Bitget. Operators can *trigger* exchange-bound work from `admin.kraite.com` (the Commands runner, the SQL Query page), but the actual execution is dispatched into Redis on Athena and consumed by a worker.
- **No write to migrations.** Migration ownership is `ingestion.kraite.com` (on Athena). `admin.kraite.com` reads the schema; it never alters it.

---

## Why the operator UI is split off

{% callout title="Architectural decision" %}
`admin.kraite.com` lives on Hermes — not on Athena where the ingestion app runs — because the operator UI is a different reliability tier than the trading runtime. A bug in admin (a runaway query, a memory leak in a Blade page) cannot starve the dispatch daemon or the WebSocket streams of CPU. Conversely, a deploy of admin (which happens far more often than ingestion) doesn't risk dropping the daemon. Web restarts on Hermes are a non-event for trading.
{% /callout %}

---

## Failure semantics

Hermes can be lost without trading impact. Positions continue opening, syncing, and closing through the daemon-and-workers core; only the operator's *visibility* into them is offline. Recovery is a standard Laravel deploy onto a fresh box — Hermes carries no state of its own.

---

## Cross-lens links

- **[Architecture overview](/docs/servers/architecture-overview)** — Hermes' place in the six-server topology
- **[Athena (ingestion)](/docs/servers/athena)** — the box that *does* run the trading runtime
- **[Components catalog](/docs/components-catalog)** — `brunocfalcao/hub-ui`, the shared Blade library powering admin
