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
| `cronjobs` | — | — | — | — | — | — | — | 6 | — |
| `positions` | — | 5 | 5 | 5 | 5 | 5 | 5 | — | — |
| `orders` | — | 8 | 8 | 8 | 8 | 8 | 8 | — | — |
| `priority` | — | 3 | 3 | 3 | 3 | 3 | 3 | 3 | — |
| `indicators` | 10 | — | — | — | — | — | — | 8 | — |
| `pheme-web` | — | — | — | — | — | — | — | — | 2 |
| `<hostname>` | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 1 |

Fleet-wide process total: **140** — athena 16, six trading workers at
17 each, tyche 19, and pheme 3. Hyperion runs
`max_connections = 512`; the verified production peak is 94.

Eos, Iris, Nyx, Hemera, Palaemon, and Aristaeus are identical,
interchangeable consumers. Athena carries 10 `indicators` processes and
tyche carries 8. Two consumers do **not** raise the aggregate API rate;
Redis-coordinated throttlers cap fleet-wide volume. Bitget reserves a slot
for every real HTTP attempt: public traffic is scoped by source IP, while
signed traffic uses both API-key and server-shared private endpoint budgets.
All traffic also shares Bitget's 6,000-request-per-minute source-IP ceiling.
Internal retries reserve again and are re-signed after waiting. A 429 pauses
that server's Bitget traffic for five minutes unless Bitget asks for longer.
The workers therefore add execution capacity without bypassing Bitget's
limits. Pheme alone consumes `pheme-web` for admin and kraite.com background
jobs.

{% callout title="Why tyche subscribes to `priority`" %}
Tyche carries 3 `priority` processes. Promoted stale work selects among
seven hostname candidates (six trading workers + tyche), so tyche-bound
work still leaks 6/7 of the time. Separate `priority-trading` and
`priority-cron` lanes remain the tracked full fix.
{% /callout %}

---

## Why athena consumes `user-data-stream` and a secondary `indicators` pool

{% callout title="Architectural decision" %}
Athena is the ingestion brain — it owns the scheduler, the dispatch daemon, both WebSocket daemons, and (historically) the public web vhosts. Its primary Horizon pool (`user-data-stream`, 5 processes) drains the push frames produced by the Binance user-data daemon running on the same box, so the frame-to-job-execution path stays inside one machine. The trading queues (positions / orders / priority) stay off athena entirely — a slow exchange round-trip must never compete with the scheduler or dispatch daemon for CPU.

The `indicators` pool (10 processes, added 2026-06-07) is the deliberate
exception. It gives StepRouter a second public IP for the lane while athena
still carries no trading queues. Tyche was later right-sized to 8 indicator
processes because the global throttle, not process count, controls API
throughput.
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

### Queue-depth health uses physical names

The health watchdog measures the `{hostname}-{logical}` Redis queues
that workers actually consume, then sums them back into each logical
lane. It does not read orphan logical keys such as `queues:positions`.
Thresholds stay lane-specific: positions and orders alert earliest,
while indicators has enough headroom for its normal hourly burst.

---

## What Horizon doesn't own

- **Scheduling.** The Laravel scheduler and the [dispatch daemon](/docs/subsystems/dispatch-daemon) are independent supervisors. Restarting Horizon does not interrupt either.
- **Stream daemons.** `kraite:stream-binance-user-data` and `kraite:stream-binance-prices` run under supervisor as long-lived processes — they *dispatch* into Horizon but are not Horizon-managed.
- **Step state machine.** Horizon executes the atomic `Job` payload; the step record's lifecycle (Pending / Dispatched / Running / Completed / Failed / …) is owned by the dispatch daemon and the step-dispatcher package.

---

## Cross-lens links

- **[Dispatch daemon](/docs/subsystems/dispatch-daemon)** — what feeds these queues
- **[Hyperion (database + Redis)](/docs/servers/hyperion)** — the box that hosts the Redis every consumer reads from
- **[Athena (ingestion)](/docs/servers/athena)** — the user-data-stream consumer + every other dispatcher
- **[Eos + Iris + Nyx + Hemera + Palaemon + Aristaeus (workers)](/docs/servers/eos-iris)** — the bulk position / order / priority workers
- **[Tyche (indicators + cronjobs)](/docs/servers/tyche)** — the isolated indicator + cronjob worker
- **[Pheme (web)](/docs/servers/pheme)** — the web stack and its private `pheme-web` background-job lane
- **[Position lifecycle](/docs/lifecycles/position-lifecycle)** — the canonical workload that flows through these queues
