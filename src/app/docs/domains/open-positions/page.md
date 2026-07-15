---
title: Open positions
---

A **Position** is the central business object Kraite manages. One row per attempt to enter the market on a given `(account_id, exchange_symbol_id, direction)` tuple. The row carries the position from selection to close (or to failure) and is the single source of truth that reconciles against the exchange. {% .lead %}

This is the **business-domain lens** view. For the step-by-step flow that drives every transition, jump to [position lifecycle](/docs/lifecycles/position-lifecycle).

---

## State machine

| Status | Meaning | Reached from | Reached how |
|---|---|---|---|
| `new` | Slot assigned, no on-exchange action yet | — (created by `AssignBestTokensToPositionSlotsJob`) | Selection picked this symbol for this slot |
| `opening` | Open block running on a worker | `new` | `PreparePositionData` step entry |
| `active` | Live on the exchange, fully wired (market + limits + TP + SL) | `opening`, `syncing`, `waping` | `ActivatePositionJob` |
| `syncing` | Reconciling DB orders against exchange (transient) | `active` | `PrepareSyncOrdersJob` (only if current = `active`) |
| `waping` | TP being recalculated against new weighted average entry (transient) | `active` | DCA LIMIT fill triggers `ApplyWapJob` |
| `closing` | Close block running | `active` | TP or SL reached FILLED |
| `closed` | Closed cleanly | `closing` | `UpdatePositionStatus` final step |
| `cancelling` | Cancel workflow running (failure path) | any open status | `CancelPositionJob` |
| `cancelled` | Failure cleanup completed and no exchange residual remains | `cancelling` | Final verified cancel step |
| `failed` | Cleanup could not prove a safe terminal state (or terminal exchange error like Binance `-2022`) | `cancelling`, `closing` (on `-2022`) | Side-effects: notification + auto-block of symbol |

Statuses `new`, `opening`, `active`, `syncing`, `waping`, `closing`, `cancelling` are **non-terminal** (treated as "open" for the duplicate-open guard). `closed`, `cancelled`, `failed` are terminal.

---

## Duplicate-open invariant

The product allows only one bot-owned position per account and trading pair, regardless of direction. Hedge mode can represent LONG and SHORT together at the exchange, but Kraite deliberately does not assign that shape. Enforcement is layered:

1. **Selection-level** — locally-open positions, exchange position snapshots, exchange open-order snapshots, and symbols already selected in the current batch are removed before either LONG or SHORT assignment.
2. **Pre-entry exchange check** — `VerifyTradingPairNotOpenJob` blocks the pair when any `LONG`, `SHORT`, or one-way `BOTH` position key exists, independent of the requested slot direction.
3. **DB-level** — virtual `is_open` is `1` for non-terminal statuses and `NULL` otherwise. Unique index `ux_positions_open_slot` rejects a second non-terminal row with the same `(account_id, exchange_symbol_id, direction)` tuple. This remains a final direction-aware storage guard beneath the stronger pair-level product rule.
4. **Orchestrator-level** — parent election and child creation commit together under a parent-row lock. A retry sees the populated child block and becomes a no-op instead of appending another opening chain.

All layers are intentional: selection prevents bad intent, the exchange check catches stale local state, the DB rejects duplicate storage, and orchestration prevents retry duplication.

---

## Slot caps

Each account carries `total_positions_long` and `total_positions_short` integers. The selection phase will not assign a position to a slot above the cap, even when the symbol-override priority-0 is configured (override does **not** raise caps). Live config on the main Binance account: `total_positions_long=6`, `total_positions_short=6` since 2026-04-23.

---

## Exchange-truth safety

Position existence is matched by exact symbol and logical direction. Hedge `LONG` / `SHORT` rows remain directional; one-way `BOTH` rows derive direction from signed quantity. A same-symbol opposite-side row therefore cannot stand in for the bot-owned exposure.

Before a REST response can drive replacement, WAP, quantity sync, drift follow-up, or recovery, its vendor envelope and normalized rows must validate. HTTP success with an exchange error is unknown state, not an empty account.

One valid missing result only schedules a 20-second high-priority confirmation. The second valid flat snapshot may cancel Kraite-owned opening LIMITs and let the owning workflow continue. Reappearance or invalid data preserves every order. A direct User Data Stream zero-quantity event remains immediate because it is exchange-pushed position truth rather than a REST absence inference.

---

## Selection priority order

When a slot is open, `HasTokenDiscovery::assignTokensToPositions` walks four priorities top-down and stops at the first hit:

| # | Priority | Notes |
|---|---|---|
| 0 | **Symbol override** (test-only) | Pin a specific symbol on a configured account, bypassing scoring, correlation, BTC-bias, and eligibility flags. Used for rehearsing WAP / close / drift flows on a known token. |
| 1 | **Fast-tracked symbols** | Recently-closed-and-profitable repeats; direction match only, no scoring |
| 2 | **BTC-bias scoring** | When BTC has a concluded direction: same timeframe, correlation-sign filter, score = `elasticity × |correlation| × S/R multiplier` |
| 3 | **Fallback scoring** | When BTC has no direction: iterate all configured timeframes, no correlation-sign filter, same score formula |

Priorities 2 and 3 also apply the [S/R proximity gate](/docs/domains/token-selection) as a soft penalty multiplier — never a hard filter.

---

## Failure semantics

An opening failure triggers the cancel workflow. When cleanup verifies
that no exchange exposure or open orders remain, the position ends
`cancelled` with no failure alert and no symbol block. Only cleanup that
cannot prove a safe terminal state ends `failed`, which triggers two
side effects ([decision detail](/docs/lifecycles/position-lifecycle#decision-failed-cleanup-side-effects-2026-04-23)):

- `position_opening_failed` Pushover notification fires (priority high)
- a separate automatic system block stops the next selection tick from re-picking the same broken symbol without changing the sysadmin-owned manual switch

A `-2022` from Binance during close → `status='failed'` with no retry, with the `position_residual_detected` notification routed to the operator since exchange state may diverge from DB.

---

## Cross-lens links

- **[Position lifecycle](/docs/lifecycles/position-lifecycle)** — the step-by-step flow that drives every transition above
- **[Orders](/docs/domains/orders)** — the rows owned by a Position (1 MARKET + N LIMITs + 1 TP + 1 SL)
- **[Token selection](/docs/domains/token-selection)** — the four-priority pipeline that decides which symbol fills a slot
