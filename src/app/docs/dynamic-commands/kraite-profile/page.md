---
title: kraite-profile
---

Resolves the current Kraite repository into its release and health profile.
Every server-backed profile targets the single `kraite` VPS. {% .lead %}

## Profile map

| Project | Profile | Destination |
|---|---|---|
| ingestion | trading runtime | `/home/kraite/ingestion.kraite.com` |
| admin | web app with API | `/home/kraite/admin.kraite.com` |
| syntax | static site | `/home/kraite/syntax.kraite.com` |
| public Kraite | web app | `/home/kraite/kraite.com` |
| social | local-only scaffold | no production target |
| mobile | iPhone app | Apple device or distribution path |

The command reads the server registry for the address, SSH user, key, and
paths. Deleted fleet hostnames are invalid.

## Operating boundary

Routine SSH uses the `kraite` user. Root key login remains recovery access.
Mobile never deploys to the VPS, and an unconfigured profile stops before any
production mutation.

Pest 5 projects run local tests through a coverage driver and TIA. A full
release rebuilds the graph from the entire suite; everyday runs select only
tests affected by local changes. Production uses a separate runtime-only
manifest and exact lock, so no test runner, TIA graph, factory autoload, or
development command is installed there.

## Related

- [Kraite host](/docs/servers/kraite)
- [kraite-deploy](/docs/dynamic-commands/kraite-deploy)
- [kraite-release](/docs/dynamic-commands/kraite-release)
