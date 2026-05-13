---
title: Indicators
---

Indicators are the **per-symbol per-timeframe technical readouts** Kraite uses to conclude a trading direction. Twelve indicators are computed per symbol per timeframe, sourced from TAAPI on the Expert plan. The indicator domain owns the math, the storage, and the freshness semantics; the [signal → direction lifecycle](/docs/lifecycles/signal-direction) owns how those readouts collapse into a `LONG` / `SHORT` / `none` decision. {% .lead %}

This is the **business-domain lens** view. For the throttler that gates TAAPI calls, see the cross-link footer.

---

## The active timeframe set

The active timeframe list is `["1h", "4h", "12h"]`. Each symbol gets the full 12-indicator set computed at each of those three timeframes — 36 readouts per symbol per refresh cycle.

Two timeframes were dropped from the original `[5m, 1h, 4h, 12h, 1d]` set:

| Timeframe | Why dropped |
|---|---|
| `5m` | Too noisy for direction conclusion — a 5m flip rarely survives the next 1h confirm |
| `1d` | Redundant with `12h + 4h` anchors — adds latency to direction-stale recovery without adding signal |

Seeder and factory both use the new set; nothing in the codebase still references `5m` or `1d` for direction.

---

## TAAPI Expert plan budget

The indicator domain runs against a **finite per-window request budget** at TAAPI:

| Setting | Value |
|---|---|
| `TAAPI_THROTTLER_REQUESTS_PER_WINDOW` | 75 (plan cap) |
| `TAAPI_THROTTLER_WINDOW_SECONDS` | 15 |
| `TAAPI_THROTTLER_MIN_DELAY_MS` | 200 (self-imposed) |
| `TAAPI_THROTTLER_SAFETY_THRESHOLD` | 0.85 (effective 63 / 15 s) |

Effective ceiling is 63 requests per 15 s — 85 % of the plan cap, leaving headroom for transient spikes without tripping a 429.

---

## Why batched Query is not on the table

{% callout title="Architectural decision" %}
TAAPI's bulk Query endpoint accepts multiple symbols in one POST, but a 20-calculation cap applies **per request**. One Kraite symbol already eats 12 calculations (12 indicators); only 0.66 of a second symbol fits in the leftover budget. Batching becomes meaningful only on a higher TAAPI plan or with a reduced indicator set. Until either changes, the throttler keeps requests serialised one-symbol-per-call with the per-window cap as the sole pacing mechanism.
{% /callout %}

---

## Cron cadence

Indicator computation is dispatched by the scheduler:

| Command | Cadence | What it does |
|---|---|---|
| `kraite:cron-conclude-symbols-direction` | hourly :30 | TAAPI indicator pipeline — fetches the 12 indicators per symbol per timeframe, persists, runs the direction conclusion |

Direction conclusion is a downstream concern — see [Signal → direction](/docs/lifecycles/signal-direction).

---

## Why only Binance accounts query TAAPI

A single direction conclusion is shared across exchanges via `CopyDirectionToOtherExchangesJob`. Bybit / KuCoin / Bitget use the Binance-derived direction directly. Duplicating the TAAPI query per exchange would burn the rate-limit budget without changing the answer — directionality is BTC-anchored, and BTC moves the same way across exchanges to <0.1 % drift on liquid tokens.

---

## Cross-lens links

- **[Signal → direction](/docs/lifecycles/signal-direction)** — how the 36 readouts collapse into a direction
- **[Token selection](/docs/domains/token-selection)** — uses the per-timeframe correlation + elasticity readouts in the score
- **[Artemis](/docs/servers/architecture-overview)** — the dedicated worker box that consumes the `indicators` Horizon queue
