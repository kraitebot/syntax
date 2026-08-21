---
title: Indicators
---

Indicators are the **per-symbol per-timeframe technical readouts** Kraite uses to conclude a trading direction. Production currently has seven active conclude indicators per evaluated timeframe: five directional checks and two validation gates. The indicator domain owns the data and freshness semantics; the [signal → direction lifecycle](/docs/lifecycles/signal-direction) owns the progressive `LONG` / `SHORT` / no-direction decision. {% .lead %}

This is the **business-domain lens** view. For the throttler that gates TAAPI calls, see the cross-link footer.

---

## The active timeframe set

The production Kraite singleton stores `["1h", "4h", "1d"]`. A symbol starts at `1h`; only an inconclusive result advances it to `4h`, then `1d`. It therefore consumes seven readouts when the first timeframe concludes and at most 21 when all three timeframes are exhausted.

{% callout title="Common provider ladder" %}
The ladder is limited to intervals accepted by every required indicator and candle endpoint. The `12h` interval was removed after TAAPI's direct candle endpoint rejected it, despite listing it in the broader provider specification. Full-universe kline refreshes now run for `1h`, `4h`, and `1d`; the separate market-shock reference set remains `15m`.
{% /callout %}

---

## TAAPI Expert plan budget

The indicator domain runs against a **finite per-window request budget** at TAAPI. The plan cap is 75 requests / 15 s; Kraite runs deliberately under it:

| Setting | Value |
|---|---|
| `TAAPI_THROTTLER_REQUESTS_PER_WINDOW` | 68 (nearest whole-request profile to 10% below the 75 plan cap) |
| `TAAPI_THROTTLER_WINDOW_SECONDS` | 15 |
| `TAAPI_THROTTLER_MIN_DELAY_MS` | 221 (self-imposed pacing) |
| `TAAPI_THROTTLER_SAFETY_THRESHOLD` | 1.0 |

Effective ceiling is 68 requests / 15 s, with each request held ≥ 221 ms behind
the last. The default profile is tracked in the application configuration and
applied through the production environment on Kraite's indicator lane.

{% callout title="Why 68 and 221 ms — the 429 story" %}
The indicator workers share **one** Redis throttle bucket on Kraite, and TAAPI
limits per API key. Each real TAAPI v2 request reserves its slot immediately
before it crosses the provider boundary. The 68-request profile leaves roughly
10% headroom and the 221 ms pace spreads the nominal allowance across the
window, including a controlled Futures-to-Spot fallback.

TAAPI v2 receives Binance market candles with one calculation request per
source attempt; the direction lifecycle still receives the established result
shape. A provider 429 may be recoverable for one job, but it is never a green
post-warmup health state. Release health requires a clean provider-error window
before the scheduler is declared safe.
{% /callout %}

### Provider timestamps are part of the signal contract

Every candle-comparison result must describe the latest market candle that was
actually observed. A response can be HTTP 200 and still be unusable when that
timestamp is missing, in the future, or older than the last closed candle for
the requested timeframe. The direction lifecycle treats that response as
inconclusive, clears any previous direction and pivots, stays silent to the
trader, and retries on the next scheduled refresh. The local processing time
does not make an old provider candle fresh.

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

### Freshness means unattended, not merely old

The health watchdog allows two hours for the hourly full-universe pass. A
symbol whose timestamp has crossed that boundary is still not paged while its
own recent `QuerySymbolIndicatorsJob` or
`ConcludeSymbolDirectionAtTimeframeJob` remains active. This distinguishes an
already-running repair from an unattended stale signal. Completed, failed, or
old abandoned steps do not suppress the alert.

After deployment, Kraite also gives this dispatcher-derived signal a bounded
10-minute recovery grace. Other health surfaces remain active throughout.

Disabled exchange rows are excluded from indicator dispatch and freshness
alerts. Binance remains the only active exchange and therefore the only live
direction source.

---

## Why only Binance accounts query TAAPI

TAAPI direction conclusions are produced from Binance data. If another exchange is explicitly re-enabled, `CopyDirectionToOtherExchangesJob` can share that Binance-derived result without duplicating TAAPI requests; while it remains disabled, it receives no live processing.

---

## Cross-lens links

- **[Signal → direction](/docs/lifecycles/signal-direction)** — how seven readouts at a time progressively conclude a direction
- **[Token selection](/docs/domains/token-selection)** — uses the per-timeframe correlation + elasticity readouts in the score
- **[Horizon queues](/docs/subsystems/horizon-queues)** — the bounded `indicators` lane on Kraite
