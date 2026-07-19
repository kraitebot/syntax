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
| `can_trade` | Account-level permission for opening new positions |
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

## Trading readiness

Opening a new position requires every account, user, billing, and plan gate:

```
account active + can trade
user active + can trade
subscription active
designated account when the plan allows only one
```

Existing positions continue through protection, synchronization, WAP, and
close when a subscription lapses or opening is switched off. Those gates stop
new exposure; they do not abandon exposure that already exists.

## Registration and connectivity

Public registration accepts Binance and Bitget. Bitget credentials include a
mandatory passphrase, and registration reads both its USDT and USDC futures
wallets before showing the quote choice. A registration trial starts with a
renewal anchor, preventing a completed trial from becoming permanently
unrenewable.

The wizard shows the minimum read and futures-trading permissions for the
selected exchange and tells users to leave withdrawals and transfers off.
Every eligible fleet server verifies connectivity and confirms that withdrawal
permission is disabled. Registration cannot activate the account when
withdrawals are enabled or the permission cannot be verified.

The account screen tests credentials from every eligible Kraite server before
applying them. It reports connection health separately from final trading
readiness. A successful retest may reactivate an account that the engine
stopped after every safe route was blocked, and clears only that account's
connectivity bans.

Portfolio and trading quotes cannot change while the account has open
positions or while opening remains enabled. Other settings remain editable,
and stopping new openings never interrupts management of current positions.

{% callout type="warning" title="Connection is not trading permission" %}
A full-fleet connectivity pass proves that API traffic can reach the exchange.
The account, user, subscription, and designated-account gates still decide
whether Kraite may open a new position.
{% /callout %}

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
