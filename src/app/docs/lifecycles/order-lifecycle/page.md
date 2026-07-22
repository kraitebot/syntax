---
title: Order lifecycle
---

The order lifecycle is the **per-order state machine** that runs underneath the [position lifecycle](/docs/lifecycles/position-lifecycle). Each order — market, limit rung, take-profit, stop-loss — has its own placement / fill / cancel sequence with its own idempotency anchor (`exchange_order_id`). The position-level orchestration coordinates these orders, but the per-order state changes themselves are owned at this layer. {% .lead %}

This is the **lifecycle lens** for the order-level flow. For the per-order business rules, see the [Orders](/docs/domains/orders) chapter.

---

## States

```
                  ┌──────────┐
                  │  NEW     │  (Order row created in DB, not yet at exchange)
                  └────┬─────┘
                       │ Place*OrderJob
                       ▼
                  ┌──────────┐
                  │ PLACED   │  (exchange accepted; exchange_order_id set)
                  └────┬─────┘
            ┌──────────┼──────────┐
            ▼          ▼          ▼
       FILLED     CANCELED    EXPIRED
            │          │          │
            ▼          ▼          ▼
       observer    observer    observer
       updates     updates     updates
       Position    Position    Position
```

`FILLED` triggers different downstream workflows depending on the order type.
`CANCELED`, `EXPIRED`, and `REJECTED` are shape-equivalent for replacement:
the order is no longer live at the exchange.

---

## The placement step

Every `Place*OrderJob` follows the same idempotent shape:

1. **Idempotency check** — if the local `Order` row already has an `exchange_order_id`, short-circuit and return.
2. **Pre-flight validation** — notional check (rejects below exchange `min_notional` for the symbol), leverage bracket check.
3. **Exchange API call** with a deterministic `clientOrderId`.
4. **Persist `exchange_order_id`** atomically.

If the worker crashes between steps 3 and 4, the next retry uses the `clientOrderId` to query the exchange, finds the half-placed order, and adopts it (writes the `exchange_order_id` from the exchange's response). No duplicate.

On Bitget, regular and plan orders carry the account's selected crossed or
isolated margin mode. Position TP/SL requests identify hedge exposure as long
or short and one-way exposure as buy or sell. An HTTP-success response counts
as accepted only when Bitget's vendor envelope also reports success; otherwise
the order remains unconfirmed and the workflow follows its failure path.

Classic accounts use the v2 order surface and Unified accounts use v3. Kraite
normalizes both regular and strategy orders before sync, correction, or
recovery. Deterministic client identities survive retries on both surfaces.
Unified full-position TP and SL are one remote strategy represented by two
local logical rows. One cancellation or replacement acts on the shared remote
object and reconciles both rows together.

---

## The fill path

```
   Binance fill   ──►  user-data WS daemon
                          │
                          ▼ ProcessUserDataEventJob
                       api_data_stream  (raw audit row)
                          │
                          ▼
                   Order::updateSaving(status='FILLED', filled_qty, ...)
                          │
                          ▼
                   OrderObserver::updated()
                          │
                ┌─────────┼─────────────┐
                ▼         ▼             ▼
              LIMIT     PROFIT       STOP-MARKET
              FILLED    FILLED       FILLED
                │         │             │
                ▼         ▼             ▼
            ApplyWap   ClosePosition   ClosePosition
              Job        Job              Job
```

Three observer arms, three downstream block dispatches. Each block is itself a step-dispatcher orchestration with its own idempotency hooks (see [position lifecycle](/docs/lifecycles/position-lifecycle)).

---

## The cancel / expire path

`CANCELED` / `EXPIRED` / `REJECTED` arrive through exchange synchronization.
On an active position, a DCA LIMIT, TP, or SL routes to
`PreparePositionReplacementJob`, which verifies the position still exists and
rebuilds the missing order set. Concurrent terminal events share one live
replacement workflow, so they cannot create duplicate rungs.

An active order whose price or quantity differs from its stored reference follows the separate `PrepareOrderCorrectionJob` path. That workflow restores intent and is deduplicated per order, including the exchange-specific Bitget correction class.

A specific high-frequency case: **manual close detection.** When a reduce-only FILL arrives for an order Kraite *doesn't own* against a position Kraite *does* own, the daemon dispatches `PreparePositionReplacementJob` immediately — not waiting for polling to catch the EXPIRED legs of the Kraite-owned orders. That workflow remains the authority for deciding whether the position is flat or still has residual exposure.

The following flat `ACCOUNT_UPDATE` adds a separate risk action. Once exchange quantity is zero, `CancelPositionOpenOrdersJob` is created as a high-priority root and cancels only live DCA LIMIT orders for that position. It does not wait behind the replacement tree and does not cancel TP or SL protection. Hedge updates match the local direction; a one-way `BOTH` update derives the logical side from signed quantity. Duplicate frames collapse into the same live cancellation.

REST-only absence uses the same opening-order selector but not the same timing.
The first valid flat snapshot schedules a high-priority confirmation after 20
seconds. The second valid flat snapshot cancels the opening ladder and starts
`ClosePositionJob` with confirmed-flat truth. The lifecycle reconciles TP, SL,
and remaining orders, then records `closed` without sending another exchange
close. Vendor errors, malformed snapshots, reappearance, and opposite-side
rows leave all orders intact.

---

## Polling reconciliation

The five-minute fallback polls only exchange-backed working orders: `NEW` and
`PARTIALLY_FILLED`. `FILLED`, `CANCELLED`, `EXPIRED`, and `REJECTED` are final
local facts and never return to the polling lane. This keeps exchange traffic
focused on orders whose state can still change and avoids treating a vendor's
short terminal-order retention as a live failure.

Every signed network attempt receives fresh authentication. If an exchange
asks the client to retry after a delay, Kraite rebuilds the timestamp and
signature immediately before the retry instead of reusing credentials that
may already be outside the receive window. This applies consistently across
Binance, Bitget, Bybit, and KuCoin.

{% callout type="warning" title="Why terminal orders stop here" %}
On 2026-07-20, the old structural filter kept polling a cancelled Binance
order after Binance had removed it from live lookup. The internal retry waited
10 seconds and reused the original signature, hiding the useful not-found
response behind a receive-window error. Terminal status filtering removes the
pointless request; fresh retry authentication preserves the real error when a
working order genuinely needs reconciliation.
{% /callout %}

---

## Why orders carry their own anchor

{% callout title="Architectural decision" %}
A position with 6 LIMIT rungs + 1 TP + 1 SL is 8 orders. If retry semantics lived only at the position layer, every retry would re-attempt every order — and the only way to make that safe would be to delete-and-re-place the whole order set on every retry. Operationally hostile, exchange-rate-limit hostile. By making `exchange_order_id` the per-order anchor, retries become local: only the failed order is re-placed, the seven intact ones are untouched. This is what makes the open / close blocks tolerant to partial failures.
{% /callout %}

---

## Cross-lens links

- **[Position lifecycle](/docs/lifecycles/position-lifecycle)** — the parent flow that orchestrates these orders
- **[Orders](/docs/domains/orders)** — the domain rules for each order type
- **[WebSocket streams](/docs/subsystems/websocket-streams)** — the push path that delivers fill events
- **[Kraite host](/docs/servers/kraite)** — where every `Place*OrderJob` runs
