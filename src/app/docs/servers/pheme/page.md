---
title: Pheme (web)
---

Pheme is Kraite's **dedicated web host** — the box that serves every public surface (admin, console, kraite.com, syntax) and nothing else. It does no exchange execution, no scheduler work, no step routing. It exists so that web traffic and trading runtime can fail independently. {% .lead %}

This is the **server lens** view. For the box that creates the trading steps pheme reads from the DB, see [athena](/docs/servers/athena).

---

## What runs on Pheme

| Vhost | Notes |
|---|---|
| `admin.kraite.com` | Operator UI — Laravel app reading from the shared `kraite` DB on hyperion |
| `console.kraite.com` | New admin-style panel — same Laravel stack as admin |
| `kraite.com` | Public marketing site (with `www.kraite.com` canonicalising to apex) |
| `syntax.kraite.com` | Public docs site (this site) — Next.js static export, no PHP |

Stack: **nginx 1.28.3** terminating TLS, **php8.5-fpm** for the three Laravel apps, **Let's Encrypt** certs issued via the Cloudflare DNS-01 plugin (so the cert path works even with Cloudflare proxy in front), **Cloudflare** Full (strict) SSL mode end-to-end.

Background jobs drain through **three per-app Horizon supervisors** — `kraite-horizon-admin`, `kraite-horizon-console`, `kraite-horizon-kraite` — one per Laravel checkout, each namespaced by its own Redis prefix. All three apps run `QUEUE_CONNECTION=redis`. Admin and kraite.com set `HORIZON_ENV=pheme` and get the fleet-config `pheme` block; console doesn't load kraitebot/core and runs its stock `production` block on the `default` queue.

| Queue | Processes | What it consumes |
|---|---|---|
| `pheme-web` (logical `web`) | 2 per app (admin, kraite.com) | Web-originated background jobs — notifications, mail, billing webhooks dispatched over Redis |
| `pheme` | 1 per app (admin, kraite.com) | Server-pinned connectivity probes (account-onboarding flow) |
| `default` | console's stock pool | Console's own dispatches |

Known latent gap: admin and kraite.com currently dispatch to their `default` Redis queue, which their `pheme`-block Horizon does not consume — `REDIS_QUEUE=pheme-web` in each app's `.env` is the pending fix. All web queues are empty today, so nothing is rotting.

---

## What does NOT run on Pheme

- No `positions` / `orders` / `priority` / `indicators` / `cronjobs` / `user-data-stream` consumer — Horizon on pheme only consumes the web lane (physical `pheme-web`), the hostname-keyed `pheme` probe queue, and console's `default` queue.
- No exchange API calls. No outbound trading traffic of any kind.
- No step-router consumer — the StepRouter explicitly excludes pheme from its candidate pool (per the `router-env-filter` rule), so trading work never lands here even by accident.
- No scheduler crontab (athena owns that).
- No WebSocket daemons (athena owns those).

---

## Connectivity model

Pheme reaches hyperion (MySQL + Redis) over the private network `kraite-net` (`10.0.0.0/16`) at `10.0.0.2`. The shared kraite DB user (`kraite@10.0.0.%`) already covers pheme's `10.0.0.9`; no GRANT changes were needed when pheme joined the fleet. Hyperion's UFW allows 3306 + 6379 from `10.0.0.0/16`.

For ops:

- Public SSH: `ssh -i ~/.ssh/id_ed25519_kraite pheme@62.238.38.113` (root SSH is `prohibit-password` — key-only — same as the rest of the fleet).
- Per-host user pattern: `pheme` (uid 1000, sudo NOPASSWD).

---

## Why web was split off from athena

{% callout title="Architectural decision" %}
The 2026-05-24 fleet rebuild briefly folded the web role into athena. In practice the web stack on athena never got fully wired — diagnosing `syntax.kraite.com` returning 522 from Cloudflare on 2026-06-01 surfaced that all four web hostnames pointed at hyperion (which serves no HTTP) and athena had no nginx vhosts at all. Rather than wire web onto a box that's already carrying the scheduler + dispatch daemon + two WS daemons + a Horizon supervisor, splitting web to its own host gives a clean cleanroom, smaller per-role blast radius (athena reboot doesn't take down operator UI, pheme reboot doesn't touch trading), and independent scaling for the web stack as `kraite.com` traffic grows.
{% /callout %}

---

## Failure isolation

A reboot of pheme takes down the four public vhosts for the duration of the reboot — Cloudflare absorbs the gap and visitors see the CF error page. Trading is **unaffected**: athena keeps dispatching, workers keep draining, the exchanges don't care. This is the smallest non-trivial blast radius in the fleet (after the workers).

A reboot of athena does **NOT** take pheme offline — pheme's Laravel apps read from hyperion directly and don't depend on athena for anything. Visitors hitting the operator UI during an athena reboot see the site, but underlying data may look stale (no new steps being created), and any artisan command on pheme that recurses into ingestion's SSH-bridged calls (admin's optional `KRAITE_INGESTION_SSH_*` path) will fail until athena returns.

---

## Cross-lens links

- **[Athena (ingestion)](/docs/servers/athena)** — the box that drives the trading runtime pheme's apps observe
- **[Hyperion (database + Redis)](/docs/servers/hyperion)** — the stateful core both athena and pheme depend on
- **[Eos + Iris + Nyx (workers)](/docs/servers/eos-iris)** — the trading worker pool (no relationship to pheme by design)
- **[Architecture overview](/docs/servers/architecture-overview)** — the full fleet map and per-role role assignments
