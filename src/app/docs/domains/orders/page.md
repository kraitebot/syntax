---
title: Orders
---

An **order** in Kraite is a single exchange-side instruction — a market entry, a limit-rung DCA, a take-profit, a stop-loss. Every order carries an `exchange_order_id` once placed, and that ID is the **idempotency anchor** for the whole position lifecycle: every retryable workflow short-circuits on a present `exchange_order_id` so a retry never produces a duplicate placement on the exchange. {% .lead %}

This is the **business-domain lens** view. For the placement / fill / cancel sequence end-to-end, see the [order lifecycle](/docs/lifecycles/order-lifecycle).

---

## Order types

| Type | Purpose |
|---|---|
| `MARKET` | Initial position entry — fills immediately at the current ask/bid |
| `LIMIT` | DCA rung — sits in the book at a target price; fills if the market moves to it |
| `PROFIT` (TP) | Take-profit — `STOP_MARKET` reduceOnly at a price above (LONG) / below (SHORT) entry. Re-priced on every DCA fill via `ApplyWapJob` |
| `STOP-MARKET` (SL) | Stop-loss — `STOP_MARKET` reduceOnly anchored to the last LIMIT rung's price. Placed FIRST during open (see invariant below) |

Bitget collapses TP + SL into a single `PlacePositionTpslJob` API call; the LONG ordering question doesn't apply there.

---

## The SL-before-TP invariant

```
   Open sequence within DispatchPositionJob block:
   ...
   8. DispatchLimitOrdersJob   (N LIMIT rungs placed in parallel)
   9. PlaceStopLossOrderJob    ◄── SL FIRST
   10. PlaceProfitOrderJob     ◄── TP SECOND
   11. ActivatePositionJob
```

SL is placed **before** TP so a fast-trade — a market move that would hit TP within milliseconds of entry — finds the protection layer already in place. If TP filled before SL was placed, the position would close in profit but unprotected for the brief window in between. The 2026-04-23 fast-trade incident is the rationale.

---

## Idempotency on placement

Every `Place*OrderJob` is **idempotent on `exchange_order_id`**:

```
   PlaceLimitOrderJob.compute()
       │
       ▼
   Order has exchange_order_id?  ─── yes ───► short-circuit (return)
       │ no
       ▼
   call exchange API
       │
       ▼
   persist exchange_order_id atomically
```

A worker crash between the API call and the DB persist is the dangerous window. Every exchange client that has it uses `clientOrderId` round-tripping to detect the half-placed case on retry: re-query by client ID, adopt the existing order if the exchange already accepted it, persist its server-side `exchange_order_id`. No duplicate.

---

## State changes — push vs polling

Order state changes flow into Kraite via two paths:

| Path | Cadence | Source |
|---|---|---|
| **Push** | <100 ms | Binance user-data WS daemon → `ProcessUserDataEventJob` → `Order::updateSaving` |
| **Polling** | 5 min | `kraite:cron-sync-orders` — safety net for dropped frames |

The push path is the primary fill driver since 2026-05-03. Polling exists only to catch missed frames in the rare WS-frame-loss / reconnect-race case.

---

## Why every order has its own idempotency anchor

{% callout title="Architectural decision" %}
The position record alone is not enough. A position with 6 LIMIT rungs + 1 TP + 1 SL = 8 orders, any of which can fail-and-retry independently. If retry semantics lived only at the position layer, every retry would re-attempt every order, and the only way to make that safe would be to delete-and-re-place the whole order set on every retry — operationally hostile and exchange-rate-limit-hostile. By making `exchange_order_id` the per-order anchor, retries become local: only the failed order is re-placed, the seven intact ones are untouched.
{% /callout %}

---

## Cross-lens links

- **[Order lifecycle](/docs/lifecycles/order-lifecycle)** — placement / fill / cancel end-to-end
- **[Position lifecycle](/docs/lifecycles/position-lifecycle)** — the parent flow that orchestrates order placement
- **[Open positions](/docs/domains/open-positions)** — the parent domain
- **[WebSocket streams](/docs/subsystems/websocket-streams)** — the push path that delivers fill events
