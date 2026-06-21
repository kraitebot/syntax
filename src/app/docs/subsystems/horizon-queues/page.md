---
title: Horizon queues
---

Horizon is the consumer side of every workload Kraite dispatches. Where the [dispatch daemon](/docs/subsystems/dispatch-daemon) is the brain that decides what runs and when, Horizon queues are the muscle that does the actual exchange round-trips, indicator math, and DB writes. Horizon runs on **nine boxes** — athena (user-data-stream plus a secondary indicators pool), the seven dedicated workers eos, iris, nyx, hemera, palaemon, aristaeus, and tyche, and pheme (web-originated jobs only) — and each one consumes a deliberately different slice of the queue surface. {% .lead %}

This is the **subsystem lens** view. For the per-server worker counts in physical terms, see the [server architecture overview](/docs/servers/architecture-overview).

---

## The eight queues

Every job dispatched in Kraite lands in one of eight queues:

| Queue | What lives here |
|---|---|
| `cronjobs` | Top-level scheduled commands' job graph entry points (the `kraite:cron-*` tree) |
| `user-data-stream` | `ProcessUserDataEventJob` frames coming off the Binance user-data WebSocket daemon |
| `positions` | Position-block atomics — open / close / WAP / sync individual position state machines |
| `orders` | Per-exchange order-placement and cancel atomics (the chatty queue — every `Place*OrderJob` and `Cancel*Job`) |
| `priority` | Hot-path replacements when a position needs immediate re-orchestration (manual close detected, drift, etc.), plus stale tyche-bound steps promoted by `steps:recover-stale --recover-dispatched` |
| `indicators` | TAAPI-bound symbol indicator computation jobs (rate-limit-sensitive) |
| `pheme-web` | Web-originated background jobs from the pheme web stack — notifications, mail, billing webhooks, dispatched over Redis (logical name `web`; the `{hostname}-{logical}` convention composes the physical `pheme-web`) |
| `<hostname>` | Per-host queues for jobs that *must* run on the box that dispatched them (rare; supervisor stays warm) |

---

## Per-server worker layout

Worker counts per queue per server. Empty cells mean that server doesn't consume that queue at all:

| Queue | Athena | Eos | Iris | Nyx | Hemera | Palaemon | Aristaeus | Tyche | Pheme |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `user-data-stream` | 5 | — | — | — | — | — | — | — | — |
| `cronjobs` | — | — | — | — | — | — | — | 20 | — |
| `positions` | — | 5 | 5 | 5 | 5 | 5 | 5 | — | — |
| `orders` | — | 8 | 8 | 8 | 8 | 8 | 8 | — | — |
| `priority` | — | 3 | 3 | 3 | 3 | 3 | 3 | 5 | — |
| `indicators` | 10 | — | — | — | — | — | — | 20 | — |
| `pheme-web` | — | — | — | — | — | — | — | — | 2 |
| `<hostname>` | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 5 | 1 |

Fleet-wide process total: **171** — athena 16, eos 17, iris 17, nyx 17, hemera 17, palaemon 17, aristaeus 17, tyche 50, pheme 3. Horizon workers open MySQL + Redis connections per-job rather than each holding two for life, so connection pressure is far lower than the process count implies: hyperion runs `max_connections = 512`, and the historical peak (`Max_used_connections`) across the full active fleet is 88. The athena indicators pool (added 2026-06-07) lifts that peak by ~20 — ample headroom remains.

Eos, Iris, Nyx, Hemera, Palaemon, and Aristaeus are deliberately identical — interchangeable Horizon consumers competing on the same queues, with no per-account-to-box binding by design; the six distinct public IPs spread Binance's per-IP weight budget naturally as dispatched jobs distribute. Tyche carries the bulk of `indicators` (20 processes) and athena runs a secondary 10-process pool (added 2026-06-07). A second consumer does **not** raise the aggregate API rate: both the TAAPI throttler (`taapi_throttler`) and the per-exchange throttlers (e.g. `bybit_throttler`) are single global buckets coordinated through the shared hyperion Redis and keyed *without* the caller's IP, so they cap fleet-wide request volume regardless of how many boxes consume the lane. What the second box buys is two outbound public IPs on `indicators`: StepRouter spreads the per-IP exchange kline burst (the trigger behind Bybit's retCode 10006) across athena's and tyche's IPs, and can route the lane off whichever IP catches a temporary rate-limit ban. Pheme is the only consumer of `pheme-web` because that queue is the web stack's own private background-job lane — the web apps dispatch into it over Redis (`QUEUE_CONNECTION=redis`, per-app Horizon supervisors on pheme), and pheme drains it without ever touching the StepRouter candidate pool.

{% callout title="Why tyche subscribes to `priority`" %}
Tyche carries 5 processes on the `priority` queue since v1.53.1. Reason: stale tyche-bound steps promoted by `php artisan steps:recover-stale --recover-dispatched` get their queue rewritten to `priority`, and without a tyche subscription every promoted step would leak to a trading worker that has no business running an indicator or cronjob payload. The current scheme picks the priority candidate at random across the 7-supervisor pool (eos + iris + nyx + hemera + palaemon + aristaeus + tyche), so tyche-bound work still leaks 6/7 of the time. The tracked fix is a per-category split — `priority-trading` vs `priority-cron` — that pins each consumer to its own lane. Until then the leak is the known imperfection of the priority queue.
{% /callout %}

---

## Why athena consumes `user-data-stream` and a secondary `indicators` pool

{% callout title="Architectural decision" %}
Athena is the ingestion brain — it owns the scheduler, the dispatch daemon, both WebSocket daemons, and (historically) the public web vhosts. Its primary Horizon pool (`user-data-stream`, 5 processes) drains the push frames produced by the Binance user-data daemon running on the same box, so the frame-to-job-execution path stays inside one machine. The trading queues (positions / orders / priority) stay off athena entirely — a slow exchange round-trip must never compete with the scheduler or dispatch daemon for CPU.

The `indicators` pool (10 processes, added 2026-06-07) is the deliberate exception. Kline-fetch jobs on that lane were bursting Bybit's per-IP rate limit (retCode 10006) because tyche was the lane's only outbound IP. Adding athena as a second consumer gives StepRouter a second public IP to spread the burst across and to rotate to when one IP catches a temporary ban. It is safe to host here precisely because athena runs no trading queues — the isolation rule is "indicators never share a box with positions/orders," and athena honours it. The pool is sized at 10 (vs tyche's 20) so it can't starve the dispatch daemon on athena's 4 cores; the global throttlers cap the aggregate API rate regardless, so the extra processes cut queue wait without raising request volume. The previous fleet's "athena holds a small self-sufficiency footprint on every queue" pattern was retired with the 2026-05-24 fleet rebuild.
{% /callout %}

---

## Redis isolation

Every server runs Horizon against the **same Redis** (on hyperion), but each one sets a unique `HORIZON_PREFIX` so its supervisor key, metrics, and tags never collide with another server's. Horizon also uses `HORIZON_ENV` (not `APP_ENV`) to pick which supervisor block in `config/horizon.php` applies — every box runs `APP_ENV=production`, but `HORIZON_ENV=athena` / `eos` / `iris` / `nyx` / `tyche` selects a completely different worker layout.

```
APP_ENV        = production       (everywhere — picks DB, env behaviour)
HORIZON_ENV    = athena | eos | iris | nyx | hemera | palaemon | aristaeus | tyche | pheme  (supervisor block)
HORIZON_PREFIX = kraite_athena_horizon:        (per-host Redis key namespace)
```

Mixing these up is the most common cause of a "Horizon is up but no jobs are processing" report — usually `HORIZON_ENV` got left at a previous server's value during a hostname migration.

---

## What Horizon doesn't own

- **Scheduling.** The Laravel scheduler and the [dispatch daemon](/docs/subsystems/dispatch-daemon) are independent supervisors. Restarting Horizon does not interrupt either.
- **Stream daemons.** `kraite:stream-binance-user-data` and `kraite:stream-binance-prices` run under supervisor as long-lived processes — they *dispatch* into Horizon but are not Horizon-managed.
- **Step state machine.** Horizon executes the atomic `Job` payload; the step record's lifecycle (Pending / Dispatched / Running / Completed / Failed / …) is owned by the dispatch daemon and the step-dispatcher package.

---

## Cross-lens links

- **[Dispatch daemon](/docs/subsystems/dispatch-daemon)** — what feeds these queues
- **[Hyperion (database + Redis)](/docs/servers/hyperion)** — the box that hosts the Redis every consumer reads from
- **[Athena (ingestion + web)](/docs/servers/athena)** — the user-data-stream consumer + every other dispatcher
- **[Eos + Iris + Nyx + Hemera + Palaemon + Aristaeus (workers)](/docs/servers/eos-iris)** — the bulk position / order / priority workers
- **[Tyche (indicators + cronjobs)](/docs/servers/tyche)** — the isolated indicator + cronjob worker
- **[Pheme (web)](/docs/servers/pheme)** — the web stack and its private `pheme-web` background-job lane
- **[Position lifecycle](/docs/lifecycles/position-lifecycle)** — the canonical workload that flows through these queues
