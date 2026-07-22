---
title: kraite-reboot
---

Performs a controlled reboot of the single all-in-one server and proves the
whole product returns. {% .lead %}

## Flow

1. Verify the target is exactly `kraite`.
2. Cool ingestion and stop every application writer.
3. Confirm database and filesystem work is quiescent.
4. Reboot through sudo from the `kraite` SSH session.
5. Reconnect using the pinned host key.
6. Verify storage, MySQL, Redis, PHP-FPM, Nginx, and Supervisor.
7. Run warmup and the full health contract.

Root public-key access remains available if routine access fails. A reboot
never disables that recovery path.

## Related

- [Kraite host](/docs/servers/kraite)
- [kraite-warmup](/docs/dynamic-commands/kraite-warmup)
- [kraite-health](/docs/dynamic-commands/kraite-health)
