---
title: Signal → direction
---

The signal-to-direction lifecycle is how Kraite **collapses 36 indicator readouts per symbol into a single tradeable direction**. It runs hourly at :30 via `kraite:cron-conclude-symbols-direction`, computes `LONG` / `SHORT` / `none` per symbol, propagates the Binance-derived conclusion to the other exchanges, and exposes the result for the [token-selection](/docs/domains/token-selection) layer to rank against. {% .lead %}

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
   fetch 12 indicators × 3 timeframes (1h / 4h / 12h) = 36 readouts
      │
      ▼
   per-timeframe collapse → tf_direction[1h], tf_direction[4h], tf_direction[12h]
      │
      ▼
   cross-timeframe agreement → symbol_direction = LONG | SHORT | none
      │
      ▼
   persist to exchange_symbols.direction + indicators_synced_at
      │
      ▼
   CopyDirectionToOtherExchangesJob
      │
      ▼
   Bybit / KuCoin / Bitget exchange_symbols rows updated to match Binance
```

---

## Per-timeframe collapse

Twelve indicators per timeframe, each contributing a vote (`LONG` / `SHORT` / `neutral`) based on its threshold rules. The timeframe's direction is the majority vote, with neutrals discarded. A timeframe with no clear majority resolves to `none`.

The 12 indicators are not all equal weight — directional indicators (RSI, MACD signal cross, EMA stack) carry more weight than amplitude indicators (ATR, Bollinger band width). The exact weighting lives in `kraitebot/core` and is treated as tunable, not API-stable.

---

## Cross-timeframe agreement

```
   1h:  LONG    │
   4h:  LONG    │ ─►  symbol_direction = LONG   (full agreement)
   12h: LONG    │

   1h:  LONG    │
   4h:  none    │ ─►  symbol_direction = LONG   (4h neutral, the others agree)
   12h: LONG    │

   1h:  LONG    │
   4h:  SHORT   │ ─►  symbol_direction = none   (conflict on a primary anchor)
   12h: LONG    │

   1h:  SHORT   │
   4h:  none    │ ─►  symbol_direction = none   (no anchor majority)
   12h: none    │
```

The 4h and 12h timeframes are treated as **primary anchors**; conflict between them is fatal to the direction. The 1h timeframe is allowed to disagree with the anchors only if both anchors agree with each other.

---

## Cross-exchange propagation

{% callout title="Architectural decision" %}
Direction is concluded **once on Binance** and copied to every other exchange's matching `exchange_symbols` row. The reasoning: directionality is BTC-anchored, BTC moves the same way across exchanges to <0.1 % drift on liquid tokens, and TAAPI's rate-limit budget is finite. Duplicating the indicator query per exchange would burn the budget without changing the answer. `CopyDirectionToOtherExchangesJob` does the propagation as the last step of the conclude pipeline. Symbol-name divergences (BTC→XBT on KuCoin, 1000SATS→10000SATS on KuCoin / Bybit) are handled by the `token_mappers` table.
{% /callout %}

---

## Freshness

`indicators_synced_at` stamps every successful conclude. The token-selection layer treats a stale stamp (older than the configured freshness budget) as "skip this symbol" — better to leave a slot empty than to open against rotten signal. A symbol that fails to conclude (TAAPI failure, all neutrals, genuine `none`) does NOT get its `indicators_synced_at` advanced — that would mask the failure on the next tick.

---

## What this lifecycle does NOT decide

- **Which symbol** to trade — that's [token selection](/docs/domains/token-selection)'s job, downstream.
- **Position size, leverage, entry price** — the position lifecycle's [open phase](/docs/lifecycles/position-lifecycle#open) decides these.
- **Whether to open at all** — gated by the [market regime](/docs/subsystems/market-regime)'s `shouldBlockOpens()`.

This pipeline answers **"if this symbol were to be opened right now, which way?"**. Nothing more.

---

## Cross-lens links

- **[Indicators](/docs/domains/indicators)** — the 36 readouts this pipeline consumes
- **[Token selection](/docs/domains/token-selection)** — the next layer that picks which symbol to actually open
- **[Position lifecycle](/docs/lifecycles/position-lifecycle)** — the consumer of `symbol_direction`
- **[Market regime](/docs/subsystems/market-regime)** — the circuit breaker that can veto an open even with a clear direction
