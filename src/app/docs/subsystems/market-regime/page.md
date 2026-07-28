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

## One BSCS decision boundary

Every trading and dashboard consumer enters through the same BSCS boundary.
It loads one point-in-time market snapshot, then exposes account-specific
opening permission, position capacity, leverage, and margin decisions from
that shared truth. Consumers do not recompute score bands or multipliers.

| Decision | Result |
|---|---|
| Market state | Score, band, freshness, cooldown, and block state |
| Opening | Whether new exposure may begin |
| Position capacity | Effective LONG/SHORT caps versus saved account maximums |
| Leverage | Regime-adjusted leverage for the candidate position |
| Margin | Regime-adjusted margin allocation for the candidate position |

This boundary is deliberately account-scoped where account settings matter.
The same global score can therefore produce different absolute position caps
for two accounts while keeping identical risk ratios.

The account configuration screen explains this saved-versus-effective split
next to the form. Saved slot, leverage, and margin values remain the Calm-state
defaults and maximums; the current BSCS band may reduce what a new position
actually receives. Existing positions retain the values captured when they
opened.

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

A regime snapshot has a freshness budget (`freshnessMaxSeconds`, default 6900
s — just under 2 h). If the latest snapshot is older than the budget,
`isStale()` returns true. The intent: a stale snapshot should not gate trading
decisions in either direction. Stale → fall back to "no block, but flag
operator visibility". Liveness of the regime compute is itself a 3-tier signal
on the admin dashboard: fresh / aging / stale.

The sysadmin Runtime Settings page can replace that budget on the shared
singleton. The database value takes effect on the next BSCS decision without a
release. The score, band, sync time, and cooldown shown beside it remain
system-owned and read-only.

## Fast market-shock detector

The one-minute shock detector complements the hourly score with live
mark-price samples and a 15-minute-candle fallback. Candle evidence older than
30 minutes is unavailable, not a zero move. Missing metrics remain unavailable
in alerts instead of becoming reassuring zeros.

The correlation rule is downside-only: high cross-market correlation fires
only when BTC is also down by the configured magnitude. A correlated BTC rally
cannot arm a crash cooldown. Constant-price series have zero variance and are
excluded from the correlation mean rather than counted as zero-correlation
evidence.

---

## Trader visibility

The iPhone dashboard exposes the same global regime truth as one bounded,
read-only KPI tile: score, band, block state, freshness, and configured block
threshold on a continuous Calm→Critical scale that marks both the current
score and the threshold. It also shows effective versus configured LONG/SHORT
capacity for the selected account.

The tile narrates the current state in plain English rather than a terse
status code. Each pause source tells its own story — the fast shock breaker
("a sudden sharp market drop tripped the safety brake"), the slow score gate
("market stress climbed past the safety limit"), and the error-storm monitor
latch ("the exchange kept rejecting our requests") — always adding that open
positions keep managing themselves. A resume line promises when new trades
come back: the two cooldown sources carry the remaining countdown, while the
monitor latch points at connection health because it never expires on its own.

The tile also carries the assessment cadence: when the market was last
checked and a countdown to the next hourly recompute, served by the API as a
pre-phrased field so the phone never re-derives schedule facts. The
five-sub-signal breakdown unfolds when the market leaves Calm or opens are
paused — a calm board with every signal quiet is exactly what tells the
trader the pause came from Kraite's own side, not the market — and each row
opens a plain-English explanation sheet with the raw reading and fired state.
The tile collapses like the position cards: folded, it keeps the band, score,
story, and resume line; expanding reveals the cadence, caps, scale, and
signal rows.

---

## Cross-lens links

- **[Position lifecycle](/docs/lifecycles/position-lifecycle)** — open phase consults BSCS before dispatching
- **[Open positions](/docs/domains/open-positions)** — the domain whose creation is gated by this subsystem
- **[Components catalog](/docs/components-catalog)** — shared building blocks behind the BSCS boundary
- **[Kraite host](/docs/servers/kraite)** — serves the bounded mobile regime summary
