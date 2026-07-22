---
title: kraite-warmup
---

Returns the single production runtime from a verified cooled state to active
service in dependency order. {% .lead %}

## Order

1. Prove MySQL and Redis are healthy.
2. Start unified Horizon and verify every queue lane.
3. Start the dispatch daemon.
4. Start the Binance price stream.
5. Start the Binance user-data stream.
6. Seed the host-metrics loop.
7. Remove application maintenance.
8. Enable the scheduler last.

The first install may have zero Binance accounts. The user-data stream must
remain healthy with an empty account set.

## Stop conditions

Warmup stops on a missing dependency, mismatched topology, failed supervisor,
or fresh runtime error. It never opens trading permission or creates an
exchange account.

## Related

- [Kraite host](/docs/servers/kraite)
- [Horizon queues](/docs/subsystems/horizon-queues)
- [kraite-health](/docs/dynamic-commands/kraite-health)
