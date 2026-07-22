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
| `position_mode` | Exchange API mode: one-way or hedge. Kraite still owns at most one direction per trading pair |
| `quote_currency` | The settlement asset — USDT or USDC for Bitget futures |

The `(user_id, api_system_id)` pair is unique. A user has at most one account per exchange.

## Active exchange policy

Binance is the only active exchange in the private installation. Bybit,
KuCoin, and Bitget remain in the catalogue and keep historical records, but
the engine excludes their accounts, symbols, balances, brackets, streams,
market-data jobs, and new-position dispatch from current processing.

{% callout type="note" title="Disabled, not deleted" %}
Exchange support code and data remain available for a later deliberate
reactivation. The activation gate changes processing scope without rewriting
an account's own active or trading flags.
{% /callout %}

The first production seed creates only the configured sysadmin. It creates no
trader and no exchange account; personal Binance onboarding happens after
server health is proven.

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
error) and caches the answer on the account. All private reads and writes then
route to the correct generation. Classic accounts use v2; Unified accounts use
v3 for balances, positions, orders, strategy orders, fills, leverage,
modification, cancellation, and close.

{% callout title="All supported Bitget account combinations can trade" %}
Classic and Unified accounts support both one-way and hedge exchange modes.
The mode changes Bitget's request and response fields only. Kraite never opens
simultaneous LONG and SHORT positions on one pair.
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

Public self-registration is currently paused for the private beta. The public
site replaces trial-start actions with a private-beta invitation, and the
registration page opens a pre-addressed email to request access. All wizard
processing routes fail before creating a draft or contacting an exchange.
Setting `REGISTRATION_ENABLED=true` reopens the complete wizard without
changing existing traders.

When open, registration accepts Binance and Bitget. Bitget credentials include
a mandatory passphrase, and registration reads both its USDT and USDC futures
wallets before showing the quote choice. A registration trial starts with a
renewal anchor, preventing a completed trial from becoming permanently
unrenewable.

The final registration step requires three explicit acknowledgements: trading
can lose money, the trader will invest responsibly, and the Terms of Service
plus Privacy Policy are accepted. Missing acknowledgement keeps the draft user
and account inactive. New and retried registrations start with one LONG and
one SHORT slot from the centrally managed registration defaults; existing
accounts keep their configured caps when those defaults change.

Once public registration commits, Kraite sends one mail-only welcome to the
trader. It explains when automated trading starts, shows whether the exchange
already had positions or limit orders, and repeats the required risk and
financial-advice disclosures. A successful welcome is not repeated for another
account owned by the same trader; failed mail can be retried. Resuming an
existing account does not trigger this onboarding message. Activation also
queues the first balance snapshot immediately, so the dashboard does not wait
for the next scheduled balance cycle.

The wizard shows the minimum read and futures-trading permissions for the
selected exchange and tells users to leave withdrawals and transfers off.
The production server verifies connectivity and confirms that withdrawal
permission is disabled. Registration cannot activate the account when
withdrawals are enabled or the permission cannot be verified.

Balance discovery and the final existing-trade inspection run as
high-priority work on `kraite`, not inside the public web request. The
wizard waits for the session-bound result before continuing. A failed read is
never treated as an empty account, and a whitelist rejection names the exact
worker IP the trader must add before retrying.

The account screen tests credentials from the production server before
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
The position-mode flag is stored at account level because the exchange applies
it to the account. Kraite reads the live mode before money-changing Bitget
work and aligns stale local state. Binance mismatch responses trigger the same
safe correction and retry. The trading rule remains pair-level: an account
cannot have two Kraite positions on the same exchange symbol, regardless of
direction or exchange mode. See `02-features/dual-position-mode.md` in the raw
docs for the full contract.
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
- **[Kraite host](/docs/servers/kraite)** — where balance and drift work runs
- **[Components catalog](/docs/components-catalog)** — the `kraitebot/core` exchange clients that consume account credentials
