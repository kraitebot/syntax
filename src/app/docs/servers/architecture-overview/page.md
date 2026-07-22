---
title: Server architecture overview
---

Kraite runs on one Hetzner CPX32 named `kraite`. It hosts MySQL, Redis,
ingestion, queues, daemons, the admin/API application, the public website,
and this static documentation site. The iPhone app remains a separate client.
{% .lead %}

This is the **server lens** map. The former ten-box fleet was deleted on
2026-07-22 and is not a current deployment target.

---

## The production host

| Host | Capacity | Responsibilities |
|---|---|---|
| `kraite` | 4 vCPU, 8 GB RAM, 160 GB | Database, queues, trading runtime, web, API, docs |

The host uses one non-root Linux owner, `kraite`, for application commands and
files. Root public-key access remains available only for recovery.

## Request and work flow

```text
iPhone / browser -> nginx -> admin or public PHP app
                              |
                              v
                      local MySQL + Redis
                              ^
                              |
schedule -> dispatch -> unified Horizon -> Binance / data providers
```

The admin and mobile API remain separate public route boundaries, but both
execute from the admin Laravel checkout. Trading jobs never depend on a public
request: the scheduler and dispatcher create work in the ingestion checkout,
and one Horizon instance consumes every physical queue.

## Runtime phases

1. The scheduler creates lifecycle entry points.
2. `DispatchDaemonCommand` advances runnable steps.
3. `StepRouter` maps each logical lane to the `kraite-*` queue.
4. Unified Horizon executes the job with the tagged core package.
5. Binance streams feed mark prices and account events back into Redis jobs.
6. MySQL records durable trading and operational state.

## Why one server

{% callout title="Private-use architecture" %}
Kraite is now Bruno's private bot. The former fleet optimized per-IP exchange
capacity and multi-user availability; that cost and operational surface are no
longer justified. One CPX32 is cheaper and easier to reason about, while its
four cores and 8 GB are adequate for one user when Horizon is capped at
fourteen workers.
{% /callout %}

## Exchange scope

Binance is the only active exchange. Bybit, KuCoin, and Bitget remain in the
catalogue and historical records, but active processing excludes them. This is
a reversible data gate, not code deletion.

The first production seed creates one sysadmin and no trader or exchange
account. Workers can be healthy without having any eligible trading work.

## Failure semantics

| Failure | Product effect |
|---|---|
| Host unavailable | Trading, database, queues, admin, API, public site, and docs stop together |
| MySQL unavailable | Durable reads and writes stop; workers must remain cooled |
| Redis unavailable | Queues, locks, cache, and Horizon stop; workers must remain cooled |
| Horizon unavailable | New and queued lifecycle work stops; web can still answer simple reads |
| Nginx or PHP-FPM unavailable | Public surfaces stop; ingestion may continue |

This wider blast radius is accepted for private use. Exact tags, encrypted
off-host backups, and a reproducible rebuild are the compensating controls.

## Mobile path

```text
kraite.app -> api.kraite.com/v1 -> admin app on kraite -> local data stores
```

The token is read-only and account-scoped. The mobile app cannot place orders,
change engine state, or cross user ownership boundaries.

## Cross-lens links

- **[Kraite host](/docs/servers/kraite)** — services and operational boundaries
- **[Horizon queues](/docs/subsystems/horizon-queues)** — worker allocation
- **[Dispatch daemon](/docs/subsystems/dispatch-daemon)** — runnable-step flow
- **[Accounts](/docs/domains/accounts)** — exchange activation and readiness
- **[Position lifecycle](/docs/lifecycles/position-lifecycle)** — end-to-end work
