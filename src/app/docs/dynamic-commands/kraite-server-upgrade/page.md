---
title: kraite-server-upgrade
---

Applies operating-system updates to `kraite` without treating package success
as application success. {% .lead %}

## Contract

The command verifies access and recovery first, cools application writers,
applies supported package updates, reboots only when required, and finishes
with the same service and product health checks as a release.

Because one host owns database, queues, trading, and web, every upgrade is a
whole-product maintenance event. It must not run concurrently with a release.

## Recovery rules

- Never disable root key access.
- Never replace the pinned SSH host identity silently.
- Never resume the scheduler before database, Redis, and workers are healthy.
- Keep the application cooled when post-upgrade validation fails.

## Related

- [Kraite host](/docs/servers/kraite)
- [kraite-reboot](/docs/dynamic-commands/kraite-reboot)
- [kraite-health](/docs/dynamic-commands/kraite-health)
