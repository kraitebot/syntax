---
title: Indicators
---

Indicators are the **per-symbol per-timeframe technical readouts** Kraite uses to conclude a trading direction. Production currently has seven active conclude indicators per evaluated timeframe: five directional checks and two validation gates. The indicator domain owns the data and freshness semantics; the [signal → direction lifecycle](/docs/lifecycles/signal-direction) owns the progressive `LONG` / `SHORT` / no-direction decision. {% .lead %}

This is the **business-domain lens** view. For the throttler that gates TAAPI calls, see the cross-link footer.

---

## The active timeframe set

The production Kraite singleton currently stores `["1h", "4h", "12h", "1d"]`. A symbol starts at `1h`; only an inconclusive result advances it to `4h`, then `12h`, then `1d`. It therefore consumes seven readouts when the first timeframe concludes and at most 28 when all four timeframes are exhausted.

{% callout type="warning" title="Known timeframe configuration drift" %}
The migration that introduced `6h` intended `["4h", "6h", "12h", "1d"]`, while the current production row and seeder still contain `1h` instead of `6h`. Separately, full-universe kline refreshes are scheduled for `4h`, `6h`, and `12h`, with a `15m` reference-set refresh. This page records verified runtime state; it does not choose which list is the intended product rule.
{% /callout %}

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
The old no-batching decision assumed 12 active indicator constructs per symbol. Production now has seven, so that arithmetic no longer supports the conclusion. The current job still sends one symbol for one timeframe per request; batching is an open optimisation decision rather than a proven plan-limit impossibility.
{% /callout %}

---

## Cron cadence

Indicator computation is dispatched by the scheduler:

| Command | Cadence | What it does |
|---|---|---|
| `kraite:cron-conclude-symbols-direction` | hourly :30 | Starts each Binance symbol at the first configured timeframe; inconclusive symbols progress through the remaining timeframes |

Direction conclusion is a downstream concern — see [Signal → direction](/docs/lifecycles/signal-direction).

---

## Why only Binance accounts query TAAPI

A single direction conclusion is shared across exchanges via `CopyDirectionToOtherExchangesJob`. Bybit / KuCoin / Bitget use the Binance-derived direction directly. Duplicating the TAAPI query per exchange would burn the rate-limit budget without changing the answer — directionality is BTC-anchored, and BTC moves the same way across exchanges to <0.1 % drift on liquid tokens.

---

## Cross-lens links

- **[Signal → direction](/docs/lifecycles/signal-direction)** — how seven readouts at a time progressively conclude a direction
- **[Token selection](/docs/domains/token-selection)** — uses the per-timeframe correlation + elasticity readouts in the score
- **[Athena and Tyche](/docs/subsystems/horizon-queues)** — the two hosts that consume the `indicators` Horizon queue
