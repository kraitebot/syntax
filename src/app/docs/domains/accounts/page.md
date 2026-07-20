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

### Bitget account modes — classic vs unified

Bitget locks its API surface by account mode: classic accounts speak the
established v2 API, unified (UTA) accounts must speak the v3 API — no
compatibility layer exists on the exchange side. Kraite detects each
account's mode automatically on first private contact (a cheap classic
probe that unified accounts reject with a distinctive pre-authentication
error) and caches the answer on the account. All private reads — balance,
positions, open orders, key permissions — then route to the correct API
generation transparently.

{% callout type="warning" title="Unified accounts register, but do not trade yet" %}
The order lifecycle still speaks the classic API only. A unified Bitget
account passes registration, connectivity, and every read path, but the
trading-readiness gate refuses it until the v3 order surface ships. Classic
accounts trade exactly as before.
{% /callout %}

Unified API keys carry two scopes: trading (read/write) and management
(read-only). Management-read powers balance reads, so trader keys need both
— the registration checklist names the exact toggles per account type. The
withdrawal-safety check fail-closes on any scope outside the known-safe
pair.

## Own-activity protection

A trader may keep their own positions and orders on the same exchange
account Kraite trades. Two per-account flags (`allow_other_positions`,
`allow_other_orders`) always move together and are **evidence-driven** —
nobody flips them by hand:

| Evidence | Effect |
|---|---|
| User activity present on the exchange | Both flags ON: cleanup ignores unknown positions, cancels only provable Kraite leftovers (match-window keys), sizing forced onto **available balance** |
| No user activity, reliable tick | Both flags OFF: Kraite-exclusive cleanup and configured sizing basis return |

Three writers keep the flags aligned: the registration scan at wizard
completion, the system-health watchdog every five minutes (live exchange
query, before any cleanup decision), and the position-opening chain (fresh
snapshots, before sizing). Protection may tighten on any evidence; it only
loosens on a reliable tick. A standing user **limit order counts as
positions scope** — once it fills it becomes a position Kraite must never
touch. The Binance ghost-algo scrub is skipped entirely on shared accounts,
and Kraite refuses to open on any symbol where the exchange already shows a
position or order.

{% callout type="note" title="Why evidence-driven (2026-07-20)" %}
The flags were originally written once, at registration. A user who started
trading manually afterwards had their positions auto-closed as "orphans" by
the cleanup watchdog within minutes. The audit that caught this also found
the reverse leak: flags stuck ON forever kept sizing on available balance
after the user's positions were long gone. Canonical spec:
`02-features/own-activity-protection.md` in the raw docs.
{% /callout %}

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
