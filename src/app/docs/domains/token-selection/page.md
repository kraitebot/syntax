---
title: Token selection
---

When a position slot opens up, **token selection** decides which symbol fills it. The decision is two-stage: first, *which selection algorithm runs* (override / fast-track / BTC-bias / fallback), and second, *how candidate symbols are ranked* by that algorithm. This chapter covers the ranking math; the selection-algorithm choice belongs to the open phase of the [position lifecycle](/docs/lifecycles/position-lifecycle#open). {% .lead %}

This is the **business-domain lens** view. Direction is decided upstream by the [signal → direction](/docs/lifecycles/signal-direction) pipeline; this layer ranks symbols of the matching direction.

---

## The four selection priorities

Before any score is computed, one of four priorities is chosen:

| Priority | When it runs | Uses scoring? |
|---|---|---|
| **Override** | Operator pinned a specific symbol → slot | No — bypasses scoring entirely |
| **Fast-track** | Recent quick `closed` position | No |
| **BTC-bias** | Default. Direction-bias mode where wrong-sign-correlation candidates are hard-rejected | Yes (with hard sign filter pre-score) |
| **Fallback** | BTC-bias produced no candidate | Yes (no sign filter — accept either direction's correlation) |

Only **BTC-bias** and **fallback** use the scoring formula below. Override and
fast-track route around it.

Fast-track accepts only the clean `closed` outcome. `cancelled` means the
opening or cleanup path exited without completing the intended trade, while
`failed` means exchange cleanup could not be proved. Neither outcome is valid
evidence for bypassing normal scoring on the next position slot.

---

## The score formula

```
   base       = log(1 + |elasticity[tf]|) × |correlation[tf]|
   multiplier = stability_weight × diversification_penalty × s_r_proximity
   score      = base × multiplier
```

`tf` is the symbol's own concluded timeframe in BTC-bias mode, or the best-scoring timeframe across the configured set in fallback mode. Direction is implicit: LONG uses `elasticity_long`, SHORT uses `elasticity_short`. Both inputs are absolute-valued — sign of either is irrelevant, direction-specific behaviour is upstream.

---

## Why log-compress the base

{% callout title="Architectural decision" %}
Raw `elasticity × |correlation|` over-weights freak high-elasticity outliers. A 100× elasticity / 0.4 correlation token scores 40 under raw multiplication, dwarfing a 5× / 0.9 token (4.5). The log compresses the gap to ~1.5× — strong correlation stays competitive with extreme amplitude. The intent: a *reliable*, well-correlated mover beats a wild, weakly-correlated one of similar net signal strength.
{% /callout %}

---

## The three multipliers

### Stability weight (`btc_correlation_stability`)

A 0.7 correlation that's *steady* across windows is a more reliable signal than a 0.9 that's *averaging* a jittery underlying series. Stability is the standard deviation of the sliding-window correlation series, persisted at correlation-compute time.

Rule: `max(0, 1 - 2 × stddev)`. So 0.05 stddev → 0.90 multiplier, 0.20 → 0.60, 0.50 → 0. Missing or non-positive stability → 1.0 (graceful degrade — never penalise for absence of data).

### Batch diversification penalty

Within a single open batch, picking the same direction repeatedly on highly-correlated symbols compounds risk on one side of the book. The penalty discounts a candidate proportionally to how many already-picked symbols in this batch share its direction *and* its correlation cluster. The intent: spread risk across uncorrelated movers within a batch, not pile six longs onto BTC, ETH, SOL, AVAX, NEAR, INJ at once.

### S/R proximity

A candidate near a major support / resistance is amplitude-rich (more room to move) but lower-probability — it has a clear barrier in the way. The proximity multiplier slightly downweights candidates pinned hard against an obvious S/R. Soft signal, not a hard reject.

---

## Hard sign filter (BTC-bias only)

Before scoring, BTC-bias mode hard-rejects any candidate whose correlation sign disagrees with the direction:

```
   LONG  + correlation < 0  ─► rejected
   SHORT + correlation > 0  ─► rejected
```

Fallback mode skips this — it accepts wrong-sign-correlation candidates because the alternative is no candidate at all.

---

## Who's in the candidate pool at all — the backtest approval gate

Everything above ranks symbols that are *already eligible*. Eligibility
itself is operator-curated: a symbol enters the tradeable pool only
after its historical backtest is reviewed and **approved** in the admin
backtesting console (`/system/backtesting`), which persists the tested
TP / SL / gap parameters and flips the approval + enablement flags the
live trader's tradeable scope requires. Rejected or unreviewed symbols
never reach this chapter's scoring, however good their correlation
looks.

The manual enablement switch belongs to the sysadmin. Opening failures
and hourly allow-list enforcement use a separate automatic system block;
price alignment is another independent eligibility gate. These automated
checks never rewrite the manual switch.

The approval proposal is stop-loss-count driven with an absolute rule:
fewer than 5 stops → approve, 5–10 → adjust, more than 10 → reject.

### Active Binance reference gate

Listing state has two stages. A delisting marker is an early warning and
new-opening gate. A delivery time at or before now is terminal exchange
removal. Missing rows from Binance or Bitget's full catalogues become
terminal immediately. Bitget's full catalogue is the atomic merge of its
USDT and USDC perpetual products; if either product request fails, neither
family is reconciled. Bybit and KuCoin expose active-only catalogues, so
absence there is warning-only until an explicit closed or invalid-symbol
response confirms terminal removal. If an active row returns, automatic
listing state and same-asset overlap recover.

A token's USDT and USDC contracts remain separate exchange symbols. Each
keeps its own quote, pair, precision, tick size, and minimum-notional rules,
so an account configured for USDC can select the USDC contract without
colliding with its USDT sibling.

Non-Binance ticker aliases are price-checked only against an active,
non-delisted Binance same-asset reference. If the only Binance sibling
is delisted or marked for delisting, the comparison skips and leaves
the target symbol unchanged. A retired ticker is not live evidence.

DATAUSDT exposed this on 2026-07-14: DATA is the 1:1 successor to IP,
while the only Binance same-asset row was delisted IPUSDT. The stale
reference produced recurring threshold alerts even though the mapping
was valid.

This is strictly a **new-opening eligibility** rule. Existing positions
are selected by their position/order state and remain covered by price
and kline monitoring, sync, WAP, protection, and close workflows even if
their symbol later becomes terminal or leaves the candidate pool.

That distinction also applies to operational price comparison. A
delisted Binance sibling is invalid evidence for selecting a new token,
but it may still be used to monitor an already-open same-asset position.
Delisting never switches off the duties attached to existing exposure.

{% callout title="Grade can't contradict the decision rule (core v1.61.0)" %}
The letter grade weighs stops as a percentage of resolved sims, so a
large sample diluted absolute failures — 16 stop-loss hits over ~1400
sims still graded "B — mostly fine to run" while the proposal banner
directly below said "recommend reject". The grade is now capped by the
decision band: more than 10 stops grades at best D, 5–10 at best C.
The score formula below the cap is unchanged — only the contradiction
is gone.
{% /callout %}

---

## Cross-lens links

- **[Signal → direction](/docs/lifecycles/signal-direction)** — decides the direction this layer ranks within
- **[Position lifecycle](/docs/lifecycles/position-lifecycle#open)** — where token selection runs (slot-assign step)
- **[Indicators](/docs/domains/indicators)** — the per-timeframe correlation + elasticity readouts the score consumes
