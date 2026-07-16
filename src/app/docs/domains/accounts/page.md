---
title: Accounts
---

An **account** in Kraite is the binding between a user and a single exchange — one row per (user, exchange). It carries the API credentials, the position-mode flag, the `can_trade` toggle, and the operational metadata Kraite needs to dispatch any exchange round-trip on that user's behalf. Accounts are the unit of credential isolation: a Bitget outage doesn't affect Binance accounts; a permission flip on one account doesn't bleed into another. {% .lead %}

This is the **business-domain lens** view. For where account credentials are read on each round-trip, see the [Components catalog](/docs/components-catalog).

---

## Identity

| Column | Role |
|---|---|
| `user_id` | Owner |
| `api_system_id` | Which exchange (Binance / Bybit / KuCoin / Bitget) |
| `api_key` / `secret` / (optional `passphrase`) | Encrypted credentials — Laravel encrypted casts |
| `can_trade` | Master enable / disable. False = read-only — no order will ever be placed |
| `position_mode` | One-way (single net position per symbol) OR Hedge / Dual (LONG and SHORT positions per symbol coexist) |
| `quote_currency` | The settlement asset — USDT or USDC for Bitget futures |

The `(user_id, api_system_id)` pair is unique. A user has at most one account per exchange.

### Bitget product context

Bitget splits stablecoin perpetuals into separate products. An account-wide
read uses the account's configured quote: USDT selects `USDT-FUTURES` and
USDT margin; USDC selects `USDC-FUTURES` and USDC margin. Symbol, order, and
position operations use the related exchange symbol's quote instead. A
missing or unsupported quote stops before any exchange request, so Kraite
cannot silently query or trade the wrong Bitget wallet.

---

## The `can_trade` invariant

`can_trade=false` is enforced at multiple layers:

```
   ┌──────────────────────────────────────────────────┐
   │  cron-create-positions   → skips can_trade=false │
   │  DispatchPositionJob     → guards on entry       │
   │  Place*OrderJob          → guards before HTTP    │
   └──────────────────────────────────────────────────┘
```

At the time of writing, only one account is `can_trade=true` (Bruno's Binance). Every other seeded account is read-only — the system fetches balances and indicators for them but will never place an order. This makes onboarding a new user a deliberate, two-stage process: seed first (read-only), promote later (after operator review).

---

## Position mode

{% callout title="Architectural decision" %}
The position-mode flag (one-way vs hedge) is stored at the account level, not the position level, because the exchange enforces it at account level. Switching position mode while positions are open is rejected by every exchange we support. Kraite mirrors that constraint in the domain: changing `position_mode` requires zero open positions for that account, and the orchestration framework refuses to dispatch a hedge-mode-specific flow against a one-way-mode account (and vice versa). See `02-features/dual-position-mode.md` for the operator playbook.
{% /callout %}

---

## Indicator privilege

Only **Binance** accounts are allowed to make TAAPI indicator queries. Bybit / KuCoin / Bitget accounts trade off the *direction conclusion* propagated from Binance via `CopyDirectionToOtherExchangesJob`. The reasoning: TAAPI's rate-limit budget is finite, every exchange's directionality decision relies on the same BTC-anchored math, and duplicating the indicator query per exchange would burn the budget without changing the answer.

---

## Drift detection

The accounts drift view in `admin.kraite.com` reconciles every active account against the exchange:

- **Balance drift** — local snapshot vs live exchange balance
- **Position drift** — local positions vs exchange positions endpoint
- **Order drift** — local orders vs exchange open-orders endpoint

Drift is alert-only — it never auto-corrects. An operator decides whether the discrepancy is benign (a transient race during a fast-trade close) or pathological (a missed event from the WS daemon, a duplicate placement).

---

## Cross-lens links

- **[Open positions](/docs/domains/open-positions)** — every position belongs to exactly one account
- **[Orders](/docs/domains/orders)** — order rows carry `account_id`
- **[Athena (ingestion)](/docs/servers/athena)** — where balance / drift cron tasks run
- **[Components catalog](/docs/components-catalog)** — the `kraitebot/core` exchange clients that consume account credentials
