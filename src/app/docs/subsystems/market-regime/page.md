---
title: Market regime
---

The market regime subsystem watches BTC for **black-swan-class days** — cascading, correlated drawdowns where the market punishes one side of the book simultaneously — and gates new position opens accordingly. It is not a price predictor. It is a **circuit breaker**: when the score crosses a threshold, the system stops opening new positions until the danger has passed. Existing positions are not touched. {% .lead %}

This is the **subsystem lens** view. Existing positions ride out the regime through their own [position lifecycle](/docs/lifecycles/position-lifecycle) — regime gating only affects whether new opens are dispatched.

---

## What it produces

A regime computation produces a **score** (0–100) and a **band** (`Calm` / `Elevated` / `Fragile` / `Critical`). Score is persisted to `market_regime_snapshots`; the latest row is the system's view of "what does the market look like right now".

| Band | Score range | Behaviour |
|---|---|---|
| `Calm` | low | No gating; opens proceed normally |
| `Elevated` | moderate | No gating yet; sub-signals tracked, watched for escalation |
| `Fragile` | high | Margin multipliers tighten; opens still allowed but at reduced size |
| `Critical` | top | **Cooldown fired.** New opens blocked system-wide until cooldown expires |

The cooldown period (default 24 h) is configured via `kraite.market_regime.cooldown.hours`. The block threshold (default score ≥ 80) is `bscs_block_threshold` on the kraite singleton.

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
| `shouldBlockOpens()` | `bool` — **the gate signal**, used by `HasTradingGuards::canOpenPositions()` |
| `isCooldownActive()` | `bool` — system-set block currently in force |
| `isOverrideActive()` | `bool` — operator-set escape hatch in force |
| `isStale()` | `bool` — score older than `freshnessMaxSeconds()` (default 6900 s) |
| `toArray()` | Lossless dashboard payload — every field admin needs in one call |

---

## Override beats cooldown

{% callout title="Architectural decision" %}
The gate logic is `override > cooldown > none`. If an operator sets `bscs_override_until` to some future time, the system stops blocking opens even if a system-set cooldown is active. This is the manual escape hatch — the bot's regime compute can be wrong (sudden recovery, regime mis-read, news that the model hasn't internalised), and an operator who's looking at the market in real time can override it. The reverse — a system cooldown overriding an operator override — would make the override useless. The override always wins.
{% /callout %}

```
   override_until > now()  ──► block = false  (operator wins)
        │ no
        ▼
   cooldown_until > now()  ──► block = true   (system cooldown)
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
