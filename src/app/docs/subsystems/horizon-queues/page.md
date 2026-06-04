---
title: Horizon queues
---

Horizon is the consumer side of every workload Kraite dispatches. Where the [dispatch daemon](/docs/subsystems/dispatch-daemon) is the brain that decides what runs and when, Horizon queues are the muscle that does the actual exchange round-trips, indicator math, and DB writes. Horizon runs on **seven boxes** — athena (single-purpose user-data-stream supervisor only), the five dedicated workers eos, iris, nyx, hemera, and tyche, and pheme (web-originated jobs only) — and each one consumes a deliberately different slice of the queue surface. {% .lead %}

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

| Queue | Athena | Eos | Iris | Nyx | Hemera | Tyche | Pheme |
|---|---:|---:|---:|---:|---:|---:|---:|
| `user-data-stream` | 5 | — | — | — | — | — | — |
| `cronjobs` | — | — | — | — | — | 20 | — |
| `positions` | — | 5 | 5 | 5 | 5 | — | — |
| `orders` | — | 8 | 8 | 8 | 8 | — | — |
| `priority` | — | 3 | 3 | 3 | 3 | 5 | — |
| `indicators` | — | — | — | — | — | 20 | — |
| `pheme-web` | — | — | — | — | — | — | 2 |
| `<hostname>` | 1 | 1 | 1 | 1 | 1 | 5 | 1 |

Fleet-wide process total: **127** — athena 6, eos 17, iris 17, nyx 17, hemera 17, tyche 50, pheme 3. Each process holds two persistent connections (MySQL + Redis); the hyperion-side ceiling is `max_connections = 256`. The current footprint sits at ~254 sustained — the next pool bump or fifth trading box needs that ceiling raised first.

Eos, Iris, Nyx, and Hemera are deliberately identical — interchangeable Horizon consumers competing on the same queues, with no per-account-to-box binding by design; the four distinct public IPs spread Binance's per-IP weight budget naturally as dispatched jobs distribute. Tyche is the only consumer of `indicators` because TAAPI rate-limit accounting lives in one place; adding a second consumer would silently double the request rate. Pheme is the only consumer of `pheme-web` because that queue is the web stack's own private background-job lane — the web apps dispatch into it over Redis (`QUEUE_CONNECTION=redis`, per-app Horizon supervisors on pheme), and pheme drains it without ever touching the StepRouter candidate pool.

{% callout title="Why tyche subscribes to `priority`" %}
Tyche carries 5 processes on the `priority` queue since v1.53.1. Reason: stale tyche-bound steps promoted by `php artisan steps:recover-stale --recover-dispatched` get their queue rewritten to `priority`, and without a tyche subscription every promoted step would leak to a trading worker that has no business running an indicator or cronjob payload. The current scheme picks the priority candidate at random across the 5-supervisor pool (eos + iris + nyx + hemera + tyche), so tyche-bound work still leaks 4/5 of the time. The tracked fix is a per-category split — `priority-trading` vs `priority-cron` — that pins each consumer to its own lane. Until then the leak is the known imperfection of the priority queue.
{% /callout %}

---

## Why athena only consumes `user-data-stream`

{% callout title="Architectural decision" %}
Athena is the ingestion brain — it owns the scheduler, the dispatch daemon, both WebSocket daemons, and the public web vhosts. The one Horizon pool it hosts (`user-data-stream`, 5 processes) drains the push frames produced by the Binance user-data daemon running on the same box, so the frame-to-job-execution path stays inside one machine. Every other queue (positions / orders / priority / indicators / cronjobs) lives on a dedicated worker box so a slow exchange round-trip or a TAAPI rate-limit wait never competes with the scheduler or the dispatch daemon for CPU. The previous fleet's "athena holds a small self-sufficiency footprint on every queue" pattern was retired with the 2026-05-24 fleet rebuild — workers being briefly offline during a deploy now degrades capacity rather than triggering a self-rescue path that was never load-tested.
{% /callout %}

---

## Redis isolation

Every server runs Horizon against the **same Redis** (on hyperion), but each one sets a unique `HORIZON_PREFIX` so its supervisor key, metrics, and tags never collide with another server's. Horizon also uses `HORIZON_ENV` (not `APP_ENV`) to pick which supervisor block in `config/horizon.php` applies — every box runs `APP_ENV=production`, but `HORIZON_ENV=athena` / `eos` / `iris` / `nyx` / `tyche` selects a completely different worker layout.

```
APP_ENV        = production       (everywhere — picks DB, env behaviour)
HORIZON_ENV    = athena | eos | iris | nyx | hemera | tyche | pheme  (supervisor block)
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
- **[Eos + Iris + Nyx + Hemera (workers)](/docs/servers/eos-iris)** — the bulk position / order / priority workers
- **[Tyche (indicators + cronjobs)](/docs/servers/tyche)** — the isolated indicator + cronjob worker
- **[Pheme (web)](/docs/servers/pheme)** — the web stack and its private `pheme-web` background-job lane
- **[Position lifecycle](/docs/lifecycles/position-lifecycle)** — the canonical workload that flows through these queues
