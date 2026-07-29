---
title: Kraite (all-in-one production)
---

`kraite` is the only production server. It owns every stateful dependency,
every trading process, and every server-backed user surface. {% .lead %}

---

## What runs here

| Layer | Services |
|---|---|
| State | MySQL and Redis on loopback |
| Trading | Scheduler, dispatch daemon, unified Horizon |
| Streams | Binance mark prices and user data |
| Web | Nginx and PHP-FPM for admin/API and public site |
| Static | Exported syntax documentation |

Application paths live below `/home/kraite`. Routine commands run as the
`kraite` Linux user. Sudo is limited to service, package, ownership, and other
operating-system work.

## Startup order

1. MySQL and Redis become healthy.
2. PHP-FPM and Nginx can serve the tagged web applications.
3. Unified Horizon starts with the `kraite` environment.
4. `DispatchDaemonCommand` starts.
5. `StreamBinancePricesCommand` starts.
6. `StreamBinanceUserDataCommand` starts.
7. The scheduler is enabled last.

On first install, migrations and the sysadmin-only seed complete before step
3. The database must contain zero accounts, positions, and orders.

## Worker budget

| Lane | Processes |
|---|---:|
| Positions | 2 |
| Orders | 3 |
| Priority | 1 |
| Cronjobs | 4 |
| Indicators | 12 |
| User data | 1 |
| Web jobs | 1 |
| Direct host work | 1 |

{% callout title="Resource boundary" %}
Twenty-five Horizon workers are the measured ceiling for the 8 GB host. MySQL,
Redis, PHP-FPM, and long-running daemons need reserved memory. Capacity
changes must follow observed memory and queue pressure, not the former fleet's
counts. Every physical lane also has a 60-second Horizon wait threshold.
{% /callout %}

## One address, one exchange budget

Every exchange call leaves from this box's single public address, and Binance
meters that address rather than the account behind it: 2,400 units of request
weight per minute, shared by everything. Placing an order, syncing a position,
protecting one, and backfilling last week's bookkeeping all draw from the same
pool. Endpoints are not priced alike — an earnings-history call costs thirty
times a plain order query — so a cheap-looking background sweep can drain the
pool that live trading needs.

Two gates protect it. Before a job starts, one asks whether the budget can
afford it and reschedules the job if not, which costs nothing. Before each
individual call leaves, a second pauses briefly when the budget is tight and
then lets the call through.

{% callout type="warning" title="Why the second gate exists" %}
On 2026-07-29 a diagnostic sweep asked for earnings history one symbol at a
time and spent the whole minute's budget in 83 seconds. The meter tracked it
exactly and nothing consulted the meter: the first gate runs once per job, so
a loop is checked for its opening call and unmetered afterwards, and anything
that is not a job — a scheduled command, a daemon, an operator running a
script — was never asked at all.

The second gate pauses rather than refuses. A job can be rescheduled for free,
but a call already in flight cannot, and refusing it would break work that
succeeds today — including the minute-by-minute refresh that keeps the Binance
live feed alive. A ban is the exception and stops calls outright, because
Binance bans last from two minutes to three days.
{% /callout %}

## Public and private boundaries

Nginx exposes SSH, HTTP, and HTTPS only. MySQL and Redis never bind publicly.
The ingestion application is not a general public API; mobile calls terminate
at the admin route boundary.

## Release behavior

Established releases cool the runtime, verify a backup, deploy exact tags,
migrate once from ingestion, clear deployment diagnostics, and warm in startup
order. Admin and the public site do not run duplicate Horizon instances.

## Cross-lens links

- **[Architecture overview](/docs/servers/architecture-overview)**
- **[Horizon queues](/docs/subsystems/horizon-queues)**
- **[Scheduler](/docs/subsystems/scheduler)**
- **[WebSocket streams](/docs/subsystems/websocket-streams)**
- **[Position lifecycle](/docs/lifecycles/position-lifecycle)**
