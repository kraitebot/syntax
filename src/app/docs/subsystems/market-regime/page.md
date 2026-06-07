---
title: Market regime
---

The market regime subsystem watches BTC for **black-swan-class days** — cascading, correlated drawdowns where the market punishes one side of the book simultaneously — and gates new position opens accordingly. It is not a price predictor. It is a **circuit breaker**: when the score crosses a threshold, the system stops opening new positions until the danger has passed. Existing positions are not touched. {% .lead %}

This is the **subsystem lens** view. Existing positions ride out the regime through their own [position lifecycle](/docs/lifecycles/position-lifecycle) — regime gating only affects whether new opens are dispatched.

---

## What it produces

A regime computation produces a **score** (0–100) and a **band** (`Calm` / `Elevated` / `Fragile` / `Critical`). Score is persisted to `market_regime_snapshots`; the latest row is the system's view of "what does the market look like right now".

| Band | Score | Leverage ratio | Count cap | Margin slice | Opens |
|---|---|---|---|---|---|
| `Calm` | 0–39 | 100% | 100% | full | open normally |
| `Elevated` | 40–59 | 66% | 75% | full | open — reduced leverage + count |
| `Fragile` | 60–79 | 50% | 50% | 1.0→0.5 | open — reduced leverage + count + margin |
| `Critical` | 80–100 | — | 0% | — | **blocked — every account, un-overridable** |

As of **Phase 3 (2026-06-07)** each band drives three independent, stacking risk axes — all applied only when a *new* position opens, never to existing ones:

- **Leverage** scales down (`floor(base × ratio)`, min 1×) so the liquidation price sits further from entry as fragility climbs.
- **Position count** scales down (`floor(account_max × ratio)`) so fewer correlated stop-losses can fire together. Gate-only: an over-cap book freezes new opens and lets attrition catch up — it never force-closes existing positions.
- **Margin slice** shrinks across the Fragile band (the original linear 1.0→0.5 multiplier).

Smaller, further-from-liquidation, and fewer-at-once — three different ways to survive a correlated drawdown. The cooldown (default 24 h, `kraite.market_regime.cooldown.hours`) and block threshold (default ≥ 80, `bscs_block_threshold`) gate the Critical band. Every opened position records the band + direction it was born under (`positions.bscs_band`, e.g. `elevated-long`) and the raw `positions.bscs_score`.

---

## The public read API

Every consumer reads regime state through a single façade:

```php
use Kraite\Core\Support\MarketRegime\BlackSwanIndex;

$index = BlackSwanIndex::current();

if ($index->shouldBlockOpens()) {
    // skip the open dispatch
}
```

`current()` is the only constructor — it loads the singleton + the latest snapshot in one go. The instance is immutable; every call returns the same point-in-time state. Key methods:

| Method | What it returns |
|---|---|
| `score()` | `?int` 0–100, `null` if no compute has landed yet |
| `band()` | `?RegimeBand` enum |
| `shouldBlockOpens()` | `bool` — **the gate signal**, used by `HasTradingGuards::canOpenPositions()`. Absolute — no override |
| `isCooldownActive()` | `bool` — system-set block currently in force |
| `isStale()` | `bool` — score older than `freshnessMaxSeconds()` (default 6900 s) |
| `toArray()` | Lossless dashboard payload — every field admin needs in one call |

---

## Critical is absolute

{% callout title="Architectural decision" %}
The gate logic is simply `cooldown > none`: while a Critical-armed cooldown is in the future, new opens are blocked for **every** account and nobody can bypass it. The per-account opt-out (`respect_bscs`) and the operator override (`bscs_override_until`) were both **removed in Phase 3 (2026-06-07)**. Earlier versions let an operator force opens through during a cooldown — but a manual escape hatch on a black-swan gate is exactly the wrong thing to trust under stress, and a per-account opt-out defeats a portfolio-level protection. BSCS still computes hourly and the system reacts off the coefficient automatically. The only fail-open path left is staleness: if the regime data is more than ~6 h old it can't be trusted, so the gate opens rather than lock the bot out on a broken signal.
{% /callout %}

```
   data stale > ~6h        ──► block = false  (fail open — data untrusted)
        │ no
        ▼
   cooldown_until > now()  ──► block = true   (Critical cooldown active)
        │ no
        ▼
                              block = false   (no gate)
```

---

## Staleness

A regime snapshot has a freshness budget (`freshnessMaxSeconds`, default 6900 s — just under 2 h). If the latest snapshot is older than the budget, `isStale()` returns true. The intent: a stale snapshot should not gate trading decisions in either direction. Stale → fall back to "no block, but flag operator visibility". Liveness of the regime compute is itself a 3-tier signal on the admin dashboard: fresh / aging / stale.

---

## Cross-lens links

- **[Position lifecycle](/docs/lifecycles/position-lifecycle)** — open phase reads `shouldBlockOpens()` before dispatching
- **[Open positions](/docs/domains/open-positions)** — the domain whose creation is gated by this subsystem
- **[Components catalog](/docs/components-catalog)** — `BlackSwanIndex` is the public façade in `kraitebot/core`
