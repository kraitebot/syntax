---
title: Signal → direction
---

The signal-to-direction lifecycle is how Kraite **progressively evaluates seven active indicators at one timeframe at a time**. It runs hourly at :30 via `kraite:cron-conclude-symbols-direction`, starts each Binance symbol at the first configured timeframe, advances only when inconclusive, and exposes the resulting `LONG` / `SHORT` / no-direction state to [token selection](/docs/domains/token-selection). {% .lead %}

This is the **lifecycle lens** view of the indicator pipeline. For the indicator inputs themselves, see [Indicators](/docs/domains/indicators).

---

## End-to-end flow

```
   :30 tick
      │
      ▼
   kraite:cron-conclude-symbols-direction
      │
      ▼
   for each tradeable Binance symbol:
      │
      ▼ (rate-limited via TAAPI throttler)
   QuerySymbolIndicatorsJob at 1h
   fetch 7 active indicators: 5 directional + 2 validation
      │
      ▼
   ConcludeSymbolDirectionAtTimeframeJob
      │
      ├─ conclusive → persist LONG / SHORT + timeframe
      ├─ inconclusive → repeat at 4h → 12h → 1d
      └─ all exhausted → clear direction and mark invalid
      │
      ▼
   ConfirmPriceAlignmentWithDirectionJob
      │
      ▼
   CopyDirectionToOtherExchangesJob + support/resistance persistence
      │
      ▼
   Bybit / KuCoin / Bitget exchange_symbols rows updated to match Binance
```

---

## Per-timeframe decision

Production has five active directional indicators (`candle-comparison`, three EMA checks, and `emas-same-direction`) plus two validation indicators (`chop` and `pivotpoints`). There is no majority weighting: every available directional conclusion must agree on the same `LONG` or `SHORT`, and both validation gates must pass. Mixed directions, no directional result, a failed validation, missing constructs, or mixed-run data makes that timeframe inconclusive.

---

## Progressive timeframe path

```
   1h: conclusive LONG  ─► stop at 1h, persist LONG

   1h: inconclusive
   4h: conclusive SHORT ─► stop at 4h, persist SHORT if change rules pass

   1h: inconclusive
   4h: inconclusive
   12h: inconclusive
   1d: inconclusive     ─► clear direction, mark invalid
```

The configured list is an ordered fallback path, not a multi-timeframe vote. A first-time or unchanged direction can conclude immediately. A direction change must reach the configured minimum timeframe index and keep a consistent path: earlier evaluated timeframes may be inconclusive or agree with the new direction, but cannot contradict it.

{% callout type="warning" title="Known timeframe configuration drift" %}
Production currently walks `1h → 4h → 12h → 1d`. A migration intended `4h → 6h → 12h → 1d`, while the seeder still restores the production list. The runtime conflict is documented; the intended product list remains unresolved.
{% /callout %}

---

## Cross-exchange propagation

{% callout title="Architectural decision" %}
Direction is concluded **once on Binance** and copied to every other exchange's matching `exchange_symbols` row. The reasoning: directionality is BTC-anchored, BTC moves the same way across exchanges to <0.1 % drift on liquid tokens, and TAAPI's rate-limit budget is finite. Duplicating the indicator query per exchange would burn the budget without changing the answer. `CopyDirectionToOtherExchangesJob` does the propagation as the last step of the conclude pipeline. Symbol-name divergences (BTC→XBT on KuCoin, 1000SATS→10000SATS on KuCoin / Bybit) are handled by the `token_mappers` table.
{% /callout %}

---

## Freshness

`indicators_synced_at` means the pipeline completed an end-to-end attempt, not necessarily that it produced a direction. A successful conclude stamps it, but so do unchanged indicator data, all-timeframe exhaustion, and a path-invalidated direction change. Transport or step failures that abort before those terminal paths remain visible as stale pipeline activity.

---

## What this lifecycle does NOT decide

- **Which symbol** to trade — that's [token selection](/docs/domains/token-selection)'s job, downstream.
- **Position size, leverage, entry price** — the position lifecycle's [open phase](/docs/lifecycles/position-lifecycle#open) decides these.
- **Whether to open at all** — gated by the [market regime](/docs/subsystems/market-regime)'s `shouldBlockOpens()`.

This pipeline answers **"if this symbol were to be opened right now, which way?"**. Nothing more.

---

## Cross-lens links

- **[Indicators](/docs/domains/indicators)** — the seven active checks evaluated at each visited timeframe
- **[Token selection](/docs/domains/token-selection)** — the next layer that picks which symbol to actually open
- **[Position lifecycle](/docs/lifecycles/position-lifecycle)** — the consumer of `symbol_direction`
- **[Market regime](/docs/subsystems/market-regime)** — the circuit breaker that can veto an open even with a clear direction
