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

The indicator domain runs against a **finite per-window request budget** at TAAPI. The plan cap is 75 requests / 15 s; Kraite runs deliberately under it:

| Setting | Value |
|---|---|
| `TAAPI_THROTTLER_REQUESTS_PER_WINDOW` | 65 (tuned below the 75 plan cap) |
| `TAAPI_THROTTLER_WINDOW_SECONDS` | 15 |
| `TAAPI_THROTTLER_MIN_DELAY_MS` | 200 (self-imposed pacing) |
| `TAAPI_THROTTLER_SAFETY_THRESHOLD` | 1.0 |

Effective ceiling is 65 requests / 15 s, with each request held ≥ 200 ms behind the last. These are per-box `.env` values on the two indicator consumers (athena + tyche); they are not in version control.

{% callout title="Why 65 and 200 ms — the 429 story" %}
Both indicator consumers share **one** throttle bucket (cache key `taapi_throttler`, no IP, on hyperion Redis), and TAAPI limits per API key — so two boxes contend for one 75/15 s budget. Running the cap at exactly 75 with no min-delay produced a chronic **~20 % 429 reject rate**: the window counter is non-atomic (check-then-record), so concurrent workers slip past 75 in bursts, and with no spacing the batch fired in 2-3 s and clustered across TAAPI's real window boundary. The rejects predated athena joining as 2nd consumer (2026-06-07) — athena added throughput, not reject rate. Dropping the cap to 65 (headroom for the race) and the min-delay to 200 ms (spread the burst evenly) cut the live reject rate to a steady **~9-14 %** band — roughly a 40 % reduction. It does not reach zero: the non-atomic race and the fixed-window-vs-TAAPI-window phase mismatch remain. Eliminating it entirely would need atomic admission (Redis INCR/Lua), but 429s here are benign (auto-retried via the `is_throttled` reschedule, no ban), so the tuning is the proportionate fix.
{% /callout %}

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
