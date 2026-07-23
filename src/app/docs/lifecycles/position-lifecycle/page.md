---
title: Position lifecycle
---

The end-to-end journey of a Kraite position: slot assignment → open → sync → WAP → close. This is the **canonical** chapter for this flow. Other lenses (subsystem, server, domain) reference back here for the full step ordering. {% .lead %}

---

## Phases at a glance

| Phase | Trigger | Outcome | Status transitions |
|---|---|---|---|
| **Open** | `kraite:cron-create-positions` (every 3 minutes) | Position activated on exchange with market entry, DCA limits, TP, SL | `new → opening → active` |
| **Sync** | WebSocket user-data event (primary) or 5-min poll (fallback) | DB orders mirror exchange state | `active` (transient `syncing`) |
| **WAP** | DCA LIMIT fills | TP price recalculated against new weighted average entry | `active → waping → active` |
| **Close** | TP or SL fills | Remaining orders cancelled, residual closed, position finalized | `active → closing → closed` |

Failure at any phase routes the position into the cancel workflow. A
verified cleanup finishes as `cancelled`; only a cleanup that cannot
prove the exchange is clear finishes as `failed`.

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
7. `PlaceMarketOrderJob` — repeats live trading readiness, then exchange API
8. `DispatchLimitOrdersJob` — creates N LIMIT Orders in DB and spawns N sibling `PlaceLimitOrderJob` steps
9. `PlaceStopLossOrderJob` — SL anchored to last limit rung. **Placed FIRST so the position is protected before the TP can fill on a fast-trade.** See "SL-before-TP invariant" below.
10. `PlaceProfitOrderJob` — initial TP based on `opening_price`
11. `ActivatePositionJob` — validates all orders placed, sets `status='active'`

Bitget uses a combined `PlacePositionTpslJob` that ships TP + SL in a single
API call, so the SL-before-TP ordering doesn't apply there. Market, limit, and
plan orders inherit the account's crossed or isolated margin mode. The
combined protection call identifies hedge positions as long or short and
one-way positions as buy or sell.

Before any Bitget opening mutation, `SyncPositionModeJob` reads the live mode
for the selected futures product. Hedge orders identify the relevant side;
one-way closing orders use reduce-only intent. Classic accounts use Bitget v2
and Unified accounts use v3, with both normalized into the same lifecycle.

`PlacePositionTpslJob` persists the TP and SL identities before sending the
combined request. Classic returns one exchange ID per leg. Unified returns one
strategy ID shared by the two local logical rows. Retries reconstruct those
same orders and avoid duplicate protection; sync, drift, recovery,
replacement, and cancellation still distinguish TP from SL.

Every Bitget round-trip carries the stablecoin product selected by the
account or exchange symbol. USDT uses `USDT-FUTURES` with USDT margin; USDC
uses `USDC-FUTURES` with USDC margin. This context follows the entire
lifecycle: balance and position reads, leverage and margin setup, entry and
protection placement, synchronization, modification, cancellation, recovery,
and close. Missing or unsupported quotes fail before an API call.

Bitget's HTTP status alone is not exchange truth. A placement or account read
advances only when the vendor envelope reports success. A non-success or
malformed envelope fails before response mapping, including after a retry, so
it cannot activate a position or masquerade as an empty account snapshot.

The same lifecycle supports Binance one-way and hedge accounts. Exchange mode
changes API fields and response parsing, never the pair-level rule: Kraite
does not open a LONG and SHORT together on one symbol.

{% callout type="warning" title="SL-before-TP invariant (2026-04-23 PM)" %}
Earlier on 2026-04-23 we hit realised losses on fast-trade tokens (LAB #107, BSB #109, LAB #121) where the TP LIMIT filled within milliseconds of the market entry, then the follow-up SL placement arrived at Binance after the position was already closed. Binance rejected with `-4509 "Time in Force GTE can only be used with open positions"`. The cascade ran `CancelPositionJob`, the forced MARKET-CANCEL closed the position at a worse price than entry.

An initial fix inserted a `VerifyPositionStillOpenJob` atomic pre-gate between TP and SL. It halved the race window but didn't close it — LAB #121 still failed with a ~1-second gap. Any check-first-act-second design has this TOCTOU window.

**Production fix: place the SL before the TP, not after.** SL on Binance / Bybit / KuCoin is a conditional algo — placing it doesn't fire anything. Once it's on the book the position is protected; the TP can then fire instantly with no downside (SL becomes an orphan algo on a closed position, cleaned up by the existing cancel-orphan-algos workflow). The race is no longer timing-dependent — it's structurally impossible. `VerifyPositionStillOpenJob` remains as a reusable building block but is no longer wired into any `DispatchPositionJob` override.
{% /callout %}

### Decision: pre-placement ladder simulation (2026-04-23)

The ladder min-notional check used to fire AFTER the market had already placed on the exchange — `DispatchLimitOrdersJob` was the first step that computed rungs, and by then `PlaceMarketOrderJob` had filled. Position #64 on USELESS hit this exactly: market SHORT @ 0.04078, rung #1 notional came in at $3.71 (below `min_notional` 5), MARKET-CANCEL closed at 0.04080 → realized ~0.04 % loss.

`VerifyOrderNotionalForMarketOrderJob` now runs the full ladder simulation (same `HasOrderCalculations::calculateLimitOrdersData` calculator, with freshly-fetched mark price and projected market quantity) **before** the market places. An infeasible ladder aborts the workflow with no exchange-side state to unwind.

### Decision: an empty pre-entry cleanup is not a failure (2026-07-14)

{% callout type="warning" title="Incident — position #763 ETCUSDT" %}
The projected ETC market slice was 17.4346 USDT against a 20 USDT
minimum. The notional gate correctly stopped before market placement:
zero orders and zero exchange exposure. Cleanup then tried to sync an
empty order set and treated "nothing exists to sync" as a failure,
which incorrectly disabled ETC and paged the operator.

An empty sync skips only after the workflow has entered `cancelling`.
The cancel workflow continues through residual verification and ends
`cancelled`. Active/opening positions without syncable protection still
fail loud, as do existing orders that all fail to sync.
{% /callout %}

### Decision: retry idempotency on order placements

`PlaceMarketOrderJob` always resumed from a pre-existing `exchange_order_id` rather than abandoning the retry. Before 2026-04-23 PM, `PlaceLimitOrderJob` did NOT — a retry triggered by recover-stale, a transient `doubleCheck` blip, or a worker restart would bail with "already placed" semantics and cascade to the cancel workflow. LAB #107 burned on this exactly.

All order-placement atomics now follow the same contract:

- `startOrFail` gates on status only
- `computeApiable` short-circuits the `apiPlace` call when the order already carries an `exchange_order_id`
- `doubleCheck` + `complete` verify against the confirmed exchange state

Any retry trigger is safe — reconciling against the exchange instead of abandoning confirmed work.

### Decision: immediate account stop at market entry (2026-07-23)

Turning account trading off is an immediate new-exposure stop. The account
screen persists only that permission, so unrelated unsaved configuration does
not leak into the action.

The scheduler and slot dispatcher already checked account, user, billing,
plan, and exchange readiness. A queued per-position workflow could still
outlive those earlier checks. `PlaceMarketOrderJob` therefore repeats the full
readiness decision at the last lifecycle boundary before market placement. A
refusal follows the existing no-exposure cancellation path.

An entry already accepted by the exchange is different: reconciliation must
continue even after opening permission is removed. This keeps the rule
one-directional — stop new exposure immediately, never abandon exposure that
already exists.

### Decision: ghost algo order guard on cancellation

When `PlaceStopLossOrderJob` failed mid-flight (e.g. on the `-4509` class before the SL-first reorder), the local `Order` row was already created via `Order::create` before `apiPlace` hit the exchange. The row persisted with `is_algo=1` and `exchange_order_id=NULL` — a ghost.

`CancelAlgoOpenOrdersJob` used to pick up ghosts via its `is_algo + not-terminal-status` filter and call `apiCancel` on them, which threw `ValidationException: options.algo id field is required` and masked the original upstream error in the step log.

Both the select query and the pre-update query now filter `whereNotNull('exchange_order_id')`. Ghosts are silently skipped — there's nothing on the exchange to cancel. The real upstream error stays in the step log as the primary failure cause.

### Decision: failed-cleanup side-effects (2026-04-23)

On the transition into `status='failed'` (guarded so retries can't
double-fire), two side effects run in tandem. A clean `cancelled`
transition does neither:

- `position_opening_failed` Pushover notification (priority high) fires to the position's user with token / pair / direction / reason / and whether the symbol was auto-blocked.
- A separate automatic system block stops the opening scheduler from selecting the same broken token next tick. Automation never changes the sysadmin-owned manual switch.

The automatic block records whether it came from an opening failure or the token allow-list. Clearing that block is separate from backtesting approval and the sysadmin-owned manual enablement control.

**Rationale:** notifying without blocking would let the scheduler keep retrying the same broken token seconds later. Blocking without notifying would hide the rotation silently dropping a symbol.

### Guards against duplicate open

- **DB unique constraint** `ux_positions_open_slot` — virtual `is_open` column is `1` for non-terminal statuses (`new`, `opening`, `active`, `syncing`, `waping`, `closing`, `cancelling`) and `NULL` otherwise. Unique index on `(account_id, exchange_symbol_id, direction, is_open)` rejects any second non-terminal position with the same tuple. NULL rows (closed / cancelled / failed) never collide.
- **Pair-level selection guard** — token discovery excludes any trading pair already represented by a locally-open position or by the exchange position/open-order snapshots. This applies across LONG and SHORT; Kraite does not open both directions on one symbol even when the account is in hedge mode.
- **Pre-entry exchange guard** — `VerifyTradingPairNotOpenJob` repeats the pair-only check immediately before placement. `PAIR:LONG`, `PAIR:SHORT`, and one-way `PAIR:BOTH` all block either slot direction.
- **Orchestrator idempotency** — child-block election and child creation commit atomically under a lock on the parent. A retry after commit sees the populated block and no-ops; a mid-build failure leaves no partial chain.

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
2. **Fallback (polling)** — `kraite:cron-sync-orders` runs every 5 minutes as a 100 % reconciliation safety net.

A manual close has an additional push-side guard. A zero-quantity account update starts `CancelPositionOpenOrdersJob` independently on the priority queue, removing only the position's live DCA LIMIT orders while `PreparePositionReplacementJob` continues the normal flat-versus-residual decision. This separation removes immediate re-entry risk without replacing lifecycle ownership.

### Decision: REST absence requires confirmed exchange truth (2026-07-15)

Every REST workflow that can act on a missing exchange position now uses the same validated snapshot contract across Binance, Bitget, Bybit, and KuCoin. Vendor errors hidden inside HTTP 200, malformed rows, and raw-versus-normalized count mismatches are unknown state; they cannot overwrite the last trusted account snapshot or prove that a position is flat.

Matching is exact on symbol plus logical direction. Hedge `LONG` and `SHORT` remain distinct. One-way `BOTH` rows derive direction from signed quantity, so a same-symbol opposite-side row cannot satisfy the check.

The first valid flat result schedules a high-priority confirmation after 20 seconds. Replacement reruns its normal exchange query through `PreparePositionReplacementJob`; WAP, quantity sync, and drift use `ConfirmPositionFlatAndCancelOpeningOrdersJob`. Only a second valid flat snapshot may cancel Kraite-owned live opening LIMITs and dispatch `ClosePositionJob` with confirmed-flat truth. The close workflow reconciles every remaining order and records `closed`, but skips a redundant exchange close. A reappearing position, invalid response, or opposite-side row leaves orders untouched.

{% callout type="warning" title="Why two REST reads?" %}
Exchange REST responses can be stale or can carry vendor errors inside successful HTTP envelopes. Acting on one apparent absence could cancel the DCA ladder while exposure still exists. The direct User Data Stream zero-quantity event remains immediate because it is already an exchange position event; REST absence pays a 20-second confirmation delay to avoid destructive false-flat action.
{% /callout %}

### Observer-driven side effects

`OrderObserver::updated()` reacts to status drift:

- `LIMIT` / `STOP-MARKET` / `PROFIT-*` CANCELLED, EXPIRED, or REJECTED → `PreparePositionReplacementJob` (recreate the missing DCA / TP / SL order); deduped by pending step check
- `PROFIT-*` or `STOP-MARKET` FILLED → `ClosePositionJob`; deduped (added 2026-04-21; double-fire was previously possible when TP and SL filled in the same sync cycle)
- `LIMIT` FILLED → `ApplyWapJob`; deduped

### Decision: status guard on sync entry (2026-04-21)

`PrepareSyncOrdersJob` flips position to `syncing` only when current status is exactly `active`. Previous behavior could clobber `opening` / `closing` / `cancelling` mid-workflow and prematurely promote a half-opened position to `active`.

### Decision: formatter normalization on sync write (2026-04-23)

All four `apiSync*` paths (default / algo / stop-order / plan-order) now route incoming price through `api_format_price` and incoming quantity through `api_format_quantity` before persisting. Outbound placement always applied these formatters; the sync write didn't, so exchange echoes that weren't tick-aligned (or carried non-lot quantities) could land in the DB as slightly drifted values. New contract keeps DB values on the same tick / lot grid at all times. Zero / null echo preserves the stored value (cancelled Binance algo orders respond with `price=0`, which would otherwise erase the audit trail).

Polling writes only attributes that changed. An unchanged exchange echo does
not refresh the order timestamp, allowing the drift checker's quiet window to
inspect stable orders. Real changes still pass through the observer and keep
replacement, correction, WAP, and close reactions active.

### Decision: NOT_FOUND handling (2026-04-21)

Bybit and KuCoin return `status='NOT_FOUND'` when an order is no longer on the active-orders list (typically because it filled or cancelled and moved to history). Previously the literal string was written to `orders.status`, leaving the order in permanent limbo since the observer has no mapping for it. Now skipped with a warning log.

### Decision: empty sync skips, existing-order failure retries

Order synchronization distinguishes an empty `cancelling` cleanup from
missing protection during normal position management. Only the former
is a no-op. Active/opening positions with no syncable orders and syncs
where every exchange query fails remain failed attempts, keeping retry
and alerting active.

Only working orders (`NEW` or `PARTIALLY_FILLED`) are eligible for polling.
Once a local order is terminal, its exchange state cannot change and the
exchange may stop returning it from live-order lookup. The 2026-07-20 incident
repeatedly queried a cancelled Binance order until the retry authentication
expired. Kraite now excludes terminal rows and regenerates signed-request
timestamps and signatures immediately before every network attempt.

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

WAP also requires the exact symbol + logical-side row from a validated snapshot. Missing, flat, or opposite-side data cannot resize the TP and instead enters the confirmed-flat safety path. Directional one-way rows remain valid even if the stored hedge-mode flag is stale.

### Decision: strict doubleCheck (2026-04-21)

Verifies profit order's actual price matches intended (±1 tick) and quantity matches intended (exact). Catches silent no-op modifies.

### Decision: sequential fill race fix (2026-04-21)

The observer's `reference_status` ack was moved to **after** the dedup check. Previous ordering (ack before dedup) meant a LIMIT fill arriving while another LIMIT's WAP was running got silently acked even though no WAP ran for it — its quantity never made it into the TP.

Additionally, `CalculateWap::complete()` now scans for LIMIT orders with `status=FILLED` but `reference_status != FILLED` and self-dispatches a follow-up `ApplyWapJob` (3 s delay so the current step's Completed transition has settled). Covers the window where L2 fills while L1's WAP is running.

### Decision: stuck-WAP self-heal, drift spotter Scope 2b (2026-07-14)

{% callout type="warning" title="Incident — position #394 FILUSDT, 2026-07-13" %}
Binance omits `avgPrice` on modify responses for never-filled orders. The unguarded read crashed the TP resize AFTER Binance had already accepted it; the failed step never committed `was_waped` or the reference values, so the order observer treated the exchange-side change as unexplained and dispatched a correction that reverted the resize. Net: exchange position 141.9, TP covering 47.3 — permanently, because failed steps never retry and the triggering fill was already acked. No alarm fired: the drift spotter's quiet-window filter never inspects busy positions, the WAP pushover fires at chain end (never reached), and 4 failed steps sit far below the 25-in-20-min storm threshold.
{% /callout %}

Two-layer fix. The crash class is closed at the source: every Binance order-response mapper (cancel, modify, query) now tolerates a missing `avgPrice`. And a self-heal safety net catches any future variant of a lost WAP:

- Every 5 minutes, the drift spotter audits each **`active`** position DB-only: summed FILLED entry ladder (MARKET + DCA LIMITs, at the symbol's quantity precision) vs the resting NEW take-profit quantity.
- Under-coverage with at least one FILLED DCA LIMIT → re-dispatch `ApplyWapJob` with the observer's exact dedupe (position row lock; skip when a WAP step is pending/dispatched/running; **terminal Failed steps do not block — they are the wound**).
- Mid-flight statuses (`syncing` / `waping` / `closing` …) are skipped — a workflow owns the row. No quiet window (that gate is what blinded Scope 1 to FILUSDT). The heal runs even while the bot is cooled: existing positions keep trading and must stay protected.
- One `position_wap_self_healed` pushover per heal; re-fires every 5 minutes while under-coverage persists — a repeating ping means the heal chain itself is failing. Kill switch: `--skip-wap-heal`.

---

## Close

Triggered when protection fills or when two independent exchange snapshots
confirm that the trader manually flattened the position.

### Flow (ClosePositionJob child block)

1. `UpdatePositionStatus` → `closing`
2. `CancelPositionOpenOrdersJob` — cancel remaining LIMITs
3. `CancelAlgoOpenOrdersJob` — cancel SL
4. `ClosePositionAtomicallyJob` — reduceOnly market close for any residual
   position; skipped when the workflow already has confirmed-flat truth
5. `SyncPositionOrdersJob` — reconcile
6. `QueryAccountPositionsJob` — verify
7. `VerifyPositionResidualAmountJob` — hard gate against partial closes or
   untrusted position evidence
8. `UpdateRemainingClosingDataJob` — closing_price, was_fast_traded, high-profit notification, **bulk** update `reference_status = status` for all orders (single transactional UPDATE, not per-order `updateSaving` — avoids half-updated state on mid-loop failure)
9. `UpdatePositionStatus` → `closed`

### Decision: Binance `-2022` requires confirmed flatness

Binance's `-2022 "ReduceOnly Order is rejected"` is ambiguous. It can mean
the position is already flat, but it can also mean the close conflicts with
another open order. The rejection alone cannot authorize terminal local state.

The close remains attempt-first because a positions preflight can lag exchange
trade truth. After `-2022`, `ClosePositionAtomicallyJob` requires two valid
account-position reads, 20 seconds apart, showing the exact symbol and logical
direction flat. Only then is the rejection treated as idempotent success.
Live exposure, reappearance, invalid evidence, or a failed query stops the
close lifecycle.

`VerifyPositionResidualAmountJob` is the final hard gate. Missing or malformed
position evidence fails the lifecycle. A matching residual sends the critical
operator notification and fails the step before `closed` can be written.
An opposite hedge side does not count as the bot-owned position.

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

`position_opened` / `position_closed` were muted on Bruno's call — too chatty on a 6×6 (12-slot) book. Their dormant dispatch paths have been removed. A future return must be an explicit digest or quiet-hours-aware feature rather than reactivating unused lifecycle methods.

---

## Readiness snapshot

| Capability | State |
|---|---|
| Open (create-positions) | scheduled every 3 minutes |
| Sync (reconciliation) | push primary + 5-min poll fallback |
| WAP (TP adjustment on DCA fill) | observer-driven, autonomous |
| Close (TP/SL fill detection) | observer-driven, autonomous |

Autonomy gate cleared on 2026-04-23. Live book runs up to 12 concurrent positions.

---

## See this lifecycle from another angle

- **[Dispatch daemon](/docs/subsystems/dispatch-daemon)** — what dispatches the open/close blocks and how the daemon survives restarts
- **[Kraite host](/docs/servers/kraite)** — where position queues run
- **[Open positions](/docs/domains/open-positions)** — what a Position row *is* and the state machine governing it
