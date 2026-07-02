---
title: WebSocket streams
---

Two long-lived WebSocket daemons run on **Athena** under supervisor: the **user-data stream** (per-account private channel — order fills, cancellations, account state) and the **mark-price stream** (public channel — ~1 Hz price updates for every Binance-listed symbol). Both are PHP processes built on `Ratchet/Pawl` + `React\EventLoop`, both are designed to run for days at a time, both push exchange events into the system in <100 ms — far ahead of any cron polling tick. {% .lead %}

This is the **subsystem lens** view. For the box that hosts these daemons, see [Athena](/docs/servers/athena).

---

## The two streams

| Daemon | Channel | What it produces |
|---|---|---|
| `kraite:stream-binance-user-data` | One authenticated WebSocket per Binance account (`wss://fstream.binance.com/ws/<listenKey>`) | `ProcessUserDataEventJob` per frame onto the `user-data-stream` queue. Order fills, cancels, replacements, account-state changes |
| `kraite:stream-binance-prices` | Public `!markPrice@arr@1s` subscription | Bulk UPDATE on `exchange_symbols.mark_price` + `mark_price_synced_at` for every Binance-listed symbol, ~1 Hz |

Both are **supervisor-managed** with `autostart=true` / `autorestart=true`. Neither is a cron — restarting them is a supervisor operation, not a scheduler concern.

---

## User-data stream — why push, not polling

The previous design polled order detail per open order on a 1-min cadence — ~36 Bitget HTTP calls per cycle for 6 positions × 6 orders. Linear fan-out: 200 accounts of equivalent shape would need ~1,200 calls/min against a 600/min per-IP private cap. Polling cannot scale past ~15 accounts per IP.

Push delivers each event in <100 ms with zero per-frame budget consumed against the rate-limit cap.

```
   ┌─────────────────┐         ┌──────────────┐
   │ Binance         │  push   │ user-data    │
   │ user-data WS    │────────►│ daemon (PHP) │
   │ (per account)   │ frames  │ on Athena    │
   └─────────────────┘         └──────┬───────┘
                                      │ dispatch
                                      ▼
                              ┌──────────────────┐
                              │ user-data-stream │  Horizon queue
                              │      (Redis)     │
                              └──────┬───────────┘
                                     │
                                     ▼
                          ProcessUserDataEventJob
                          → api_data_stream (raw)
                          → Order::updateSaving
                          → OrderObserver workflow
```

A 5-minute polling cron (`kraite:cron-sync-orders`) still runs as a **safety net** — catches missed frames in the rare WS-frame-loss / reconnect-race case.

### Selective dispatch

Not every WS frame triggers a downstream workflow. The execution-type allowlist is gated by `kraite.user_data_stream.<exchange>.dispatched_executions`. Empty list = pure shadow mode (every frame audited into `api_data_stream`, no `Order::updateSaving`). Each execution type is enabled via config flip after its OrderObserver workflow has been verified end-to-end against live frames.

Production allowlist (Binance, since 2026-05-03): `TRADE` / `AMENDMENT` / `CANCELED` / `EXPIRED` / `ALGO_NEW` / `ALGO_CANCELED` / `ALGO_EXPIRED` / `ALGO_FILLED`. `NEW` / `REJECTED` / `CALCULATED` deliberately stay off — `NEW` would create defensive drift-detection noise on every placement ack, `REJECTED` is already caught synchronously at placement time, liquidations are out of scope.

---

## Mark-price stream — chunked CASE/WHEN UPDATE

The mark-price daemon writes the same Binance tick to every matching exchange row in a **single bulk UPDATE** — Binance, Bybit, KuCoin, Bitget — using a chunked 500-row CASE/WHEN raw query that **bypasses Eloquent** entirely. 1 Hz × 568 symbols × 4 exchanges is too hot for the observer chain.

```
   Binance tick (1 Hz, all symbols) ──► UPDATE exchange_symbols
                                          SET mark_price = CASE id
                                              WHEN 1 THEN 27451.20
                                              WHEN 2 THEN  1842.55
                                              ... (500 rows / chunk)
                                          END
                                          WHERE id IN (...)
```

Replication across exchanges uses `(token + quote)` matching with `token_mappers` overrides for naming divergence (BTC→XBT on KuCoin, 1000SATS→10000SATS on KuCoin / Bybit, …).

`gc_collect_cycles()` runs after each batch — keeps the daemon's memory profile flat across multi-day uptime.

---

## Reconnect + isolation

{% callout title="Architectural decision" %}
Both daemons share a `BaseWebsocketClient` abstract: auto-pong, exponential-backoff reconnect (`2^attempt`, max 5), per-account error isolation. A single account's listenKey expiry, transient WS error, or malformed frame does not bring down the daemon or the other accounts' streams. This makes the user-data stream the *first* layer of fault containment, not the last.
{% /callout %}

### Reconnect-forever is availability, not recovery

Retrying forever keeps a daemon *alive* but does not guarantee it *recovers*. On 2026-07-02 a transient network blip wedged the mark-price daemon's DNS resolver inside its ReactPHP event loop; it reconnected ~46,000 times over four hours, every attempt failing, no prices landing — until a manual restart cleared it in seconds. A fresh connector per attempt does not clear a loop-level wedge; only a fresh **process** does.

{% callout type="warning" title="Sustained no-data self-exit" %}
The mark-price stream is *strict-data* — ~1 Hz frames are always expected. If no real price frame arrives for **5 minutes**, the daemon stops its loop so supervisor respawns a clean process, turning a multi-hour blackout into a ~10-second blip. It tracks time-since-last-*data*-frame separately from time-since-last-anything (a reconnect or a keepalive ping never resets it), so both failure shapes trip it: never-reconnects **and** connects-but-silent. The user-data stream is exempt — silence there is normal on a quiet account, so it never self-exits. A frozen mark price is what surfaces the operator-facing "Mark price stale" alert for any symbol the bot has skin in (open position or tradeable).
{% /callout %}

---

## Cross-lens links

- **[Athena (ingestion)](/docs/servers/athena)** — the box hosting both daemons
- **[Horizon queues](/docs/subsystems/horizon-queues)** — `user-data-stream` consumer side
- **[Order lifecycle](/docs/lifecycles/order-lifecycle)** — what happens after a frame turns into an `Order::updateSaving`
