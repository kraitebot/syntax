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

`FILLED` triggers different downstream workflows depending on the order type. `CANCELED` and `EXPIRED` are shape-equivalent — both mean the order is no longer live at the exchange.

---

## The placement step

Every `Place*OrderJob` follows the same idempotent shape:

1. **Idempotency check** — if the local `Order` row already has an `exchange_order_id`, short-circuit and return.
2. **Pre-flight validation** — notional check (rejects below exchange `min_notional` for the symbol), leverage bracket check.
3. **Exchange API call** with a deterministic `clientOrderId`.
4. **Persist `exchange_order_id`** atomically.

If the worker crashes between steps 3 and 4, the next retry uses the `clientOrderId` to query the exchange, finds the half-placed order, and adopts it (writes the `exchange_order_id` from the exchange's response). No duplicate.

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

`CANCELED` / `EXPIRED` arrive via the same WS push (or the 5-min polling safety net). The observer routes them to `PrepareOrderCorrectionJob` if the order was load-bearing (TP / SL on an active position), or noops if it was a benign rung-cancel during a position close.

A specific high-frequency case: **manual close detection.** When a reduce-only FILL arrives for an order Kraite *doesn't own* against a position Kraite *does* own, the daemon dispatches `PreparePositionReplacementJob` immediately — not waiting for the polling sync to catch the EXPIRED legs of the kraite-owned TP / SL.

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
- **[Eos + Iris (workers)](/docs/servers/eos-iris)** — where every `Place*OrderJob` actually runs
