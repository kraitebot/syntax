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
| `TAAPI_THROTTLER_REQUESTS_PER_WINDOW` | 68 (nearest whole-request profile to 10% below the 75 plan cap) |
| `TAAPI_THROTTLER_WINDOW_SECONDS` | 15 |
| `TAAPI_THROTTLER_MIN_DELAY_MS` | 221 (self-imposed pacing) |
| `TAAPI_THROTTLER_SAFETY_THRESHOLD` | 1.0 |

Effective ceiling is 68 requests / 15 s, with each request held ≥ 221 ms behind
the last. The default profile is tracked in the application configuration and
applied through the production environment on Kraite's indicator lane.

{% callout title="Why 68 and 221 ms — the 429 story" %}
The indicator workers share **one** Redis throttle bucket on Kraite, and TAAPI
limits per API key. Running at the full 75-request ceiling created recurring
429 responses during concurrent fan-out. The 68-request profile keeps the
existing throttler behavior while leaving roughly 10% headroom; 221 ms spreads
the nominal allowance across the window.

This tuning deliberately does not redesign admission. Some 429 responses may
still occur when concurrent workers cross TAAPI's differently aligned window.
They remain benign: the step reschedules without consuming its retry budget.
The goal is fewer rejected calls without materially reducing useful indicator
throughput.
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
