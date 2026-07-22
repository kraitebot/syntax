---
title: kraite-deploy
---

Deploys one exact tag to the destination selected by `kraite-profile`. Server
profiles connect as `kraite`; the mobile profile uses Apple tooling. {% .lead %}

## Universal gates

1. The exact tag exists on the remote repository.
2. Configured tests or builds pass.
3. The target path and working-tree scope are known.
4. Persistent environment and storage are preserved.
5. Schema changes run once from ingestion.
6. No development package version reaches production.

## Ingestion flow

The established-server sequence is cooldown, verified database backup, exact
tag checkout, production dependency install, one migration pass, topology
verification, diagnostics housekeeping, warmup, and health.

On first install, schema creation and the production seed happen before any
worker starts. The seed must leave one sysadmin and zero traders, accounts,
positions, and orders.

## Web and static profiles

Admin/API and the public website deploy their exact tags, build assets, and
reuse the local MySQL and Redis services. They do not start duplicate trading
Horizon instances. Syntax deploys an atomic static export.

## Failure behavior

A failed backup, migration, build, service, or health gate leaves the affected
application cooled. Data rollback is never automatic.

## Related

- [Kraite host](/docs/servers/kraite)
- [kraite-warmup](/docs/dynamic-commands/kraite-warmup)
- [kraite-health](/docs/dynamic-commands/kraite-health)
