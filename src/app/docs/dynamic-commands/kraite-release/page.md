---
title: kraite-release
---

Runs documentation, deferred coverage, tests, review, tags, deployment,
warmup, and health for the active Kraite profile. {% .lead %}

## Pipeline

1. Refresh functional docs and the syntax site.
2. Add any regression coverage deferred during implementation.
3. Run the profile's full configured suite or build checks.
4. Review and simplify every release diff.
5. Commit, push, pass required CI, and create exact tags.
6. Deploy the active profile to its configured destination.
7. Warm and verify the product.

The ingestion profile also tags changed owned packages before the application.
Web profiles deploy to `kraite`; mobile follows its device or Apple
distribution path; an unconfigured profile stops safely.

## First-install modifier

A first release provisions dependencies before deployment and adds the hard
data invariant: one sysadmin, no traders, no accounts, no positions, no orders.
No worker starts until that state is proven.

## Related

- [kraite-profile](/docs/dynamic-commands/kraite-profile)
- [kraite-deploy](/docs/dynamic-commands/kraite-deploy)
- [kraite-health](/docs/dynamic-commands/kraite-health)
