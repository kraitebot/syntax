---
title: Horizon queues
---

One Horizon instance in the ingestion application consumes every production
queue on `kraite`. It is the execution side of scheduled, trading, indicator,
stream, and web-originated work. {% .lead %}

This is the **subsystem lens**. See the
[Kraite host](/docs/servers/kraite) for the physical service boundary.

---

## Queue layout

| Logical lane | Physical queue | Processes | Purpose |
|---|---|---:|---|
| `positions` | `kraite-positions` | 2 | Position state machines |
| `orders` | `kraite-orders` | 3 | Exchange order round-trips |
| `priority` | `kraite-priority` | 1 | Urgent recovery work |
| `cronjobs` | `kraite-cronjobs` | 2 | Scheduled lifecycle entry points |
| `indicators` | `kraite-indicators` | 3 | Market-data and indicator work |
| `user-data-stream` | `kraite-user-data-stream` | 1 | Binance account events |
| `web` | `kraite-web` | 1 | Mail, notifications, and web jobs |
| `kraite` | `kraite` | 1 | Direct host-targeted work |

## Dispatch flow

1. A command or event creates a step on a logical lane.
2. `StepRouter` selects the production candidate `kraite`.
3. The router emits the physical `kraite-*` queue name.
4. Horizon executes the job and the step records its terminal or retry state.

An inactive exchange is filtered before this flow creates current work. A
permanent account or whitelist failure can deactivate the account before
dispatch; a temporary rate window waits and retries.

## Why one instance

{% callout title="Single runtime owner" %}
Admin and the public site share the core package but do not run duplicate
Horizon supervisors. Their background jobs use the `web` lane consumed by
ingestion. This prevents a web checkout from accidentally consuming trading
queues under different application configuration.
{% /callout %}

## Capacity rule

Fourteen workers are the starting private-use budget. Orders receive the
largest lane because their state machines are exchange-call heavy. Indicator
and cron work remain bounded so they cannot exhaust memory or starve position
protection on the four-core, 8 GB host.

Rate limits are still coordinated in Redis. Extra processes would add local
concurrency, not permission to exceed provider budgets.

## Isolation and naming

`APP_ENV=production` selects product behavior. `HORIZON_ENV=kraite` selects
the one production supervisor map. A unique Horizon prefix keeps its internal
metadata separate from ordinary cache and queue keys.

The deploy topology gate proves that configuration and the `servers` table
both name `kraite`. A mismatch aborts before long-running processes restart.

## What Horizon does not own

- The scheduler decides when commands create work.
- `DispatchDaemonCommand` decides which step becomes runnable.
- Binance stream commands receive live exchange events.
- The step-dispatcher package owns step state transitions.
- MySQL owns durable domain state; Redis owns transient queue state.

## Cross-lens links

- **[Architecture overview](/docs/servers/architecture-overview)**
- **[Kraite host](/docs/servers/kraite)**
- **[Dispatch daemon](/docs/subsystems/dispatch-daemon)**
- **[Accounts](/docs/domains/accounts)**
- **[Position lifecycle](/docs/lifecycles/position-lifecycle)**
