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
