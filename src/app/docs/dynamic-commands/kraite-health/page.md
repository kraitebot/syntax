---
title: kraite-health
---

Proves the deployed product is usable, not merely that Linux processes exist.
Server-backed checks run once against `kraite`. {% .lead %}

## Ingestion checks

- MySQL and Redis answer locally.
- Maintenance is off after warmup.
- Unified Horizon has the expected supervisors and queue consumers.
- Scheduler, dispatcher, and Binance streams are running.
- Queue depth and failed-job diagnostics show no fresh release failure.
- Exact app and core tags match the release.
- Topology contains only the production hostname `kraite`.
- Zero accounts and positions are accepted on the first private install.

## Product checks

Admin/API, the public site, and syntax require valid HTTPS responses and fresh
content. Mobile requires a local build, device launch, and live API reachability.

## Safety boundary

Health reads bounded diagnostics. It does not repair data, clear audit state,
or warm a cooled application implicitly.

## Related

- [Server architecture](/docs/servers/architecture-overview)
- [Horizon queues](/docs/subsystems/horizon-queues)
- [kraite-warmup](/docs/dynamic-commands/kraite-warmup)
