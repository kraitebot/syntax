---
title: Position lifecycle
---

The end-to-end journey of a Kraite position: slot assignment → open → sync → WAP → close. This is the **canonical** chapter for this flow. Other lenses (subsystem, server, domain) reference back here for the full step ordering. {% .lead %}

---

## Phases at a glance

| Phase | Trigger | Outcome | Status transitions |
|---|---|---|---|
| **Open** | `kraite:cron-create-positions` (every 3 minutes) | Position activated on exchange with market entry, DCA limits, TP, SL | `new → opening → active` |
| **Sync** | WebSocket user-data event (primary) or 15-min poll (fallback) | DB orders mirror exchange state | `active` (transient `syncing`) |
| **WAP** | DCA LIMIT fills | TP price recalculated against new weighted average entry | `active → waping → active` |
| **Close** | TP or SL fills | Remaining orders cancelled, residual closed, position finalized | `active → closing → closed` |

Failure at any phase routes the position into the cancel workflow (`status='failed'`).

---

## Open

Triggered by `kraite:cron-create-positions`. Running autonomously since 2026-04-23 with `total_positions_long=6` and `total_positions_short=6` on the main Binance account — the live book runs up to 12 concurrent positions.

### Per-account preflight

1. Verify min balance (exchange API)
2. Query account positions + open orders in parallel (exchange API)
3. `AssignBestTokensToPositionSlotsJob` — creates `Position` rows with `status='new'`, picks top-ranked tradeable symbols per slot (long and short ranked independently)
4. `DispatchPositionSlotsJob` — spawns one `DispatchPositionJob` child block per assigned position

### Per-position sequence (DispatchPositionJob block)

1. `VerifyTradingPairNotOpen` — snapshot check against queried state
2. `SetMarginMode`
3. `PreparePositionData` — computes margin slice, sets `status='opening'`
4. `DetermineLeverage` — reads from leverage brackets
5. `SetLeverage` — exchange API
6. `VerifyOrderNotionalForMarketOrderJob` — pre-check; rejects if market slice falls below exchange `min_notional` for the symbol, **and** runs the full ladder simulation against fresh mark price (see "Pre-placement ladder simulation" below)
7. `PlaceMarketOrderJob` — exchange API
8. `DispatchLimitOrdersJob` — creates N LIMIT Orders in DB and spawns N sibling `PlaceLimitOrderJob` steps
9. `PlaceStopLossOrderJob` — SL anchored to last limit rung. **Placed FIRST so the position is protected before the TP can fill on a fast-trade.** See "SL-before-TP invariant" below.
10. `PlaceProfitOrderJob` — initial TP based on `opening_price`
11. `ActivatePositionJob` — validates all orders placed, sets `status='active'`

Bitget uses a combined `PlacePositionTpslJob` that ships TP + SL in a single API call, so the SL-before-TP ordering doesn't apply there.

{% callout type="warning" title="SL-before-TP invariant (2026-04-23 PM)" %}
Earlier on 2026-04-23 we hit realised losses on fast-trade tokens (LAB #107, BSB #109, LAB #121) where the TP LIMIT filled within milliseconds of the market entry, then the follow-up SL placement arrived at Binance after the position was already closed. Binance rejected with `-4509 "Time in Force GTE can only be used with open positions"`. The cascade ran `CancelPositionJob`, the forced MARKET-CANCEL closed the position at a worse price than entry.

An initial fix inserted a `VerifyPositionStillOpenJob` atomic pre-gate between TP and SL. It halved the race window but didn't close it — LAB #121 still failed with a ~1-second gap. Any check-first-act-second design has this TOCTOU window.

**Production fix: place the SL before the TP, not after.** SL on Binance / Bybit / KuCoin is a conditional algo — placing it doesn't fire anything. Once it's on the book the position is protected; the TP can then fire instantly with no downside (SL becomes an orphan algo on a closed position, cleaned up by the existing cancel-orphan-algos workflow). The race is no longer timing-dependent — it's structurally impossible. `VerifyPositionStillOpenJob` remains as a reusable building block but is no longer wired into any `DispatchPositionJob` override.
{% /callout %}

### Decision: pre-placement ladder simulation (2026-04-23)

The ladder min-notional check used to fire AFTER the market had already placed on the exchange — `DispatchLimitOrdersJob` was the first step that computed rungs, and by then `PlaceMarketOrderJob` had filled. Position #64 on USELESS hit this exactly: market SHORT @ 0.04078, rung #1 notional came in at $3.71 (below `min_notional` 5), MARKET-CANCEL closed at 0.04080 → realized ~0.04 % loss.

`VerifyOrderNotionalForMarketOrderJob` now runs the full ladder simulation (same `HasOrderCalculations::calculateLimitOrdersData` calculator, with freshly-fetched mark price and projected market quantity) **before** the market places. An infeasible ladder aborts the workflow with no exchange-side state to unwind.

### Decision: retry idempotency on order placements

`PlaceMarketOrderJob` always resumed from a pre-existing `exchange_order_id` rather than abandoning the retry. Before 2026-04-23 PM, `PlaceLimitOrderJob` did NOT — a retry triggered by recover-stale, a transient `doubleCheck` blip, or a worker restart would bail with "already placed" semantics and cascade to the cancel workflow. LAB #107 burned on this exactly.

All order-placement atomics now follow the same contract:

- `startOrFail` gates on status only
- `computeApiable` short-circuits the `apiPlace` call when the order already carries an `exchange_order_id`
- `doubleCheck` + `complete` verify against the confirmed exchange state

Any retry trigger is safe — reconciling against the exchange instead of abandoning confirmed work.

### Decision: ghost algo order guard on cancellation

When `PlaceStopLossOrderJob` failed mid-flight (e.g. on the `-4509` class before the SL-first reorder), the local `Order` row was already created via `Order::create` before `apiPlace` hit the exchange. The row persisted with `is_algo=1` and `exchange_order_id=NULL` — a ghost.

`CancelAlgoOpenOrdersJob` used to pick up ghosts via its `is_algo + not-terminal-status` filter and call `apiCancel` on them, which threw `ValidationException: options.algo id field is required` and masked the original upstream error in the step log.

Both the select query and the pre-update query now filter `whereNotNull('exchange_order_id')`. Ghosts are silently skipped — there's nothing on the exchange to cancel. The real upstream error stays in the step log as the primary failure cause.

### Decision: failure side-effects (2026-04-23)

On the transition into `status='failed'` (guarded so retries can't double-fire), two side effects run in tandem:

- `position_opening_failed` Pushover notification (priority high) fires to the position's user with token / pair / direction / reason / and whether the symbol was auto-blocked.
- `exchange_symbol.is_manually_enabled` flips to `false` if it wasn't already, so the opening scheduler stops selecting the same broken token next tick.

Re-enabling is an explicit operator action — the hourly `kraite:disable-volatile-tokens` sweep will re-disable it if the token is also on the curated deny-list. Approving via `/system/backtesting` flips `is_manually_enabled=true` in the same write that sets `was_backtesting_approved=true`. Rejection leaves the flag alone; even an enabled token won't be selected while `was_backtesting_approved=false`.

**Rationale:** notifying without blocking would let the scheduler keep retrying the same broken token seconds later. Blocking without notifying would hide the rotation silently dropping a symbol.

### Guards against duplicate open

- **DB unique constraint** `ux_positions_open_slot` — virtual `is_open` column is `1` for non-terminal statuses (`new`, `opening`, `active`, `syncing`, `closing`, `cancelling`) and `NULL` otherwise. Unique index on `(account_id, exchange_symbol_id, direction, is_open)` rejects any second non-terminal position with the same tuple. NULL rows (closed / cancelled / failed) never collide.
- **Orchestrator idempotency** — `PreparePositionsOpeningJob::compute()` is a no-op on retry if any child step already exists in its block.

### Limit ladder math

`HasOrderCalculations::calculateLimitOrdersData`:

```
for rung i in 0..N-1:
    prev *= multiplier[i]   # default multipliers = [2, 2, 2, 2]
    price = ref_price * (1 ± (i+1) * gap_percent/100)
    qty   = prev, formatted per symbol precision
```

Direction flips the sign: LONG puts limits below entry (BUY further down); SHORT puts them above (SELL further up). Quantities double by default — martingale pattern.

---

## Sync

As of 2026-04-30, sync runs in two layers:

1. **Primary (push)** — `kraite:stream-binance-user-data` supervised daemon receives order/account events in real time over Binance's private WebSocket and updates `Order` rows directly. Reaction path for partial fills, full fills, cancellations, expirations, replacements.
2. **Fallback (polling)** — `kraite:cron-sync-orders` runs every 15 minutes as a 100 % reconciliation safety net. Reduced from every-minute on 2026-04-30 once the push path became authoritative.

### Observer-driven side effects

`OrderObserver::updated()` reacts to status drift:

- `LIMIT` / `STOP-MARKET` / `PROFIT-*` CANCELLED or EXPIRED → `PreparePositionReplacementJob` (recreate the missing DCA / TP / SL order); deduped by pending step check
- `PROFIT-*` or `STOP-MARKET` FILLED → `ClosePositionJob`; deduped (added 2026-04-21; double-fire was previously possible when TP and SL filled in the same sync cycle)
- `LIMIT` FILLED → `ApplyWapJob`; deduped

### Decision: status guard on sync entry (2026-04-21)

`PrepareSyncOrdersJob` flips position to `syncing` only when current status is exactly `active`. Previous behavior could clobber `opening` / `closing` / `cancelling` mid-workflow and prematurely promote a half-opened position to `active`.

### Decision: formatter normalization on sync write (2026-04-23)

All four `apiSync*` paths (default / algo / stop-order / plan-order) now route incoming price through `api_format_price` and incoming quantity through `api_format_quantity` before persisting. Outbound placement always applied these formatters; the sync write didn't, so exchange echoes that weren't tick-aligned (or carried non-lot quantities) could land in the DB as slightly drifted values. New contract keeps DB values on the same tick / lot grid at all times. Zero / null echo preserves the stored value (cancelled Binance algo orders respond with `price=0`, which would otherwise erase the audit trail).

### Decision: NOT_FOUND handling (2026-04-21)

Bybit and KuCoin return `status='NOT_FOUND'` when an order is no longer on the active-orders list (typically because it filled or cancelled and moved to history). Previously the literal string was written to `orders.status`, leaving the order in permanent limbo since the observer has no mapping for it. Now skipped with a warning log.

---

## WAP (Weighted Average Price)

Triggered when a DCA LIMIT order fills. Purpose: recalculate the TP price using the exchange's `breakEvenPrice` (weighted average entry after the new fill) and modify the existing profit order accordingly.

### Flow (ApplyWapJob child block)

1. `UpdatePositionStatus` → `waping`
2. `VerifyIfTPIsFilledJob` — queries exchange; if TP is already FILLED, throws `NonNotifiableException` and the resolve-exception step fires (letting the close workflow handle it instead)
3. `QueryAccountPositions` — fresh snapshot with `breakEvenPrice`
4. `CalculateWapAndModifyProfitOrderJob` — math + `apiModify` + `apiSync`
5. `UpdatePositionStatus` → `active`

Resolve-exception on any step → `UpdatePositionStatus` → `active`.

### Math

`CalculateWap::computeApiable`:

```
target_price = breakEvenPrice * (1 ± profit_percentage / 100)
target_qty   = |positionAmt|   # absolute; SHORT is negative on Binance
```

Sign depends on direction. Then `apiModify(target_qty, target_price)` on the existing profit order. Binance's `PUT /fapi/v1/order` is a true in-place modify (same orderId, atomic at matching engine); no cancel-and-replace window.

### Decision: consistency gate (2026-04-21)

Throws if exchange `positionAmt` < local sum of MARKET + FILLED LIMIT quantities. Means Binance hasn't yet committed the triggering fill into `breakEvenPrice`. Step retries with a fresh snapshot rather than computing TP against stale breakeven.

### Decision: strict doubleCheck (2026-04-21)

Verifies profit order's actual price matches intended (±1 tick) and quantity matches intended (exact). Catches silent no-op modifies.

### Decision: sequential fill race fix (2026-04-21)

The observer's `reference_status` ack was moved to **after** the dedup check. Previous ordering (ack before dedup) meant a LIMIT fill arriving while another LIMIT's WAP was running got silently acked even though no WAP ran for it — its quantity never made it into the TP.

Additionally, `CalculateWap::complete()` now scans for LIMIT orders with `status=FILLED` but `reference_status != FILLED` and self-dispatches a follow-up `ApplyWapJob` (3 s delay so the current step's Completed transition has settled). Covers the window where L2 fills while L1's WAP is running.

---

## Close

Triggered by observer when `PROFIT-*` or `STOP-MARKET` reaches FILLED.

### Flow (ClosePositionJob child block)

1. `UpdatePositionStatus` → `closing`
2. `CancelPositionOpenOrdersJob` — cancel remaining LIMITs
3. `CancelAlgoOpenOrdersJob` — cancel SL
4. `ClosePositionAtomicallyJob` — reduceOnly market close for any residual position
5. `SyncPositionOrdersJob` — reconcile
6. `QueryAccountPositionsJob` — verify
7. `VerifyPositionResidualAmountJob` — catch partial closes
8. `UpdateRemainingClosingDataJob` — closing_price, was_fast_traded, high-profit notification, **bulk** update `reference_status = status` for all orders (single transactional UPDATE, not per-order `updateSaving` — avoids half-updated state on mid-loop failure)
9. `UpdatePositionStatus` → `closed`

### Decision: Binance `-2022` is terminal

Binance's matching engine can reject a reduceOnly close when the position ledger hasn't yet reflected a fresh entry fill (TOC/TOU race), or when hedge-mode `positionSide` doesn't match actual exposure.

`ClosePositionAtomicallyJob` catches `ClientException` containing `-2022`, rethrows as `NonNotifiableException` with a clear message flagging *"exchange may still be open — operator must reconcile manually"*. **No retry.** Position transitions to `failed` via the usual cancel-workflow fallback path.

---

## Notification routing

Canonicals dispatched during the lifecycle, each cache-throttled per position to prevent duplicates on retries:

| Canonical | Trigger | Priority | Status |
|---|---|---|---|
| `position_opened` | `ActivatePositionJob` success | low | **muted** 2026-04-23 |
| `position_closed` | close workflow complete | low | **muted** 2026-04-23 |
| `position_wap_applied` | `CalculateWap` success | high | active |
| `position_high_profit_closed` | close + N filled limits hit | info | active |
| `position_opening_failed` | status transition to `failed` | high | active (2026-04-23) |
| `position_pump_cooldown_triggered` | spike detected on close | high | active |
| `position_residual_detected` | residual on exchange post-close | critical | active |

`position_opened` / `position_closed` were muted on Bruno's call — too chatty on a 6×6 (12-slot) book. Re-enable by uncommenting the dispatch one-liners in `ActivatePositionJob::complete` and `UpdateRemainingClosingDataJob::computeApiable` once a digest / quiet-hours filter lands.

---

## Readiness snapshot

| Capability | State |
|---|---|
| Open (create-positions) | scheduled every 3 minutes |
| Sync (reconciliation) | push primary + 15-min poll fallback |
| WAP (TP adjustment on DCA fill) | observer-driven, autonomous |
| Close (TP/SL fill detection) | observer-driven, autonomous |

Autonomy gate cleared on 2026-04-23. Live book runs up to 12 concurrent positions.

---

## See this lifecycle from another angle

- **[Dispatch daemon](/docs/subsystems/dispatch-daemon)** — what dispatches the open/close blocks and how the daemon survives restarts
- **[Eos + Iris + Nyx](/docs/servers/eos-iris)** — which workers consume position-lifecycle queues
- **[Open positions](/docs/domains/open-positions)** — what a Position row *is* and the state machine governing it
