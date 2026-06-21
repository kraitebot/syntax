---
title: Kraite — profile
---

`kraite-profile` is the **profile-detection primitive** every other kraite-* command recurses into before branching. It maps the current working directory's basename to one of five Kraite project profiles and returns the row of the matrix the caller needs. {% .lead %}

Run standalone, it dumps the matched profile row for Bruno. Run recursively from another kraite-* command, it gives the parent the profile name and the columns relevant to that parent (deploy target, cooldown style, warmup shape, CI gate, docs phase, health scope).

---

## Profile matrix

| Folder | Profile | Deploy target | Tag? | CI gate? | Tests | Docs phase |
|---|---|---|---|---|---|---|
| `ingestion.kraite.test` | **ingestion** | athena + 7 workers (eos, iris, nyx, hemera, palaemon, aristaeus, tyche) | yes | hard gate | step-dispatcher + project, must pass | full (raw specs + syntax site) |
| `admin.kraite.test` | **web-app-with-queue** | pheme | yes | no | if suite exists | none |
| `console.kraite.test` | **web-app-with-queue** | pheme | yes | no | if suite exists | none |
| `kraite.test` | **web-app** | pheme | yes | no | if suite exists | none |
| `syntax.kraite.test` | **static-site** | pheme (atomic file swap) | yes | no | none | none |

If the CWD basename doesn't match any row, the command stops with: *"Not in a recognised Kraite project folder."*

---

## Universal rules surfaced here

- **Tag-before-deploy is a hard rule.** Every profile ships by tag, not branch.
- **Tests run when present, skipped silently when absent** — except ingestion, where the step-dispatcher + project suites are mandatory.
- **Web projects deploy to pheme.** Since 2026-06-01, athena no longer hosts the web stack.
- **Per-hostname user pattern.** Every server has a sudo user matching its hostname; all project commands (`artisan`, `composer`, `npm`) run as that user via `su - <hostname> -c '...'`. Root SSH is recovery-only.
- **`kraite-update-docs` is ingestion-only.** All other profiles get a polite no-op.

---

## Worker ordering (ingestion profile only)

The post-v1.49.8 release ordering: deploy ALL boxes first (no mixed-code window), then warm WORKERS before ATHENA. Athena warms last so its scheduler cron only resumes once consumers are online — otherwise the scheduler dispatches into queues that have no drainers, the cooldown gate trips, and the release wedges.

| Step | Boxes | Why |
|---|---|---|
| 1. Deploy code | athena + eos + iris + nyx + hemera + palaemon + aristaeus + tyche (parallel) | one tag fleet-wide before any warmup |
| 2. Warmup workers | eos + iris + nyx + hemera + palaemon + aristaeus + tyche (parallel) | consumers must be online before athena resumes |
| 3. Warmup athena | athena | scheduler cron + dispatch daemon + WS streams come back last |

---

## Horizon queue assignment

| Queue | athena | eos / iris / nyx / hemera / palaemon / aristaeus | tyche |
|---|---|---|---|
| `user-data-stream` | 5 | — | — |
| `positions` | — | 5 each | — |
| `orders` | — | 8 each | — |
| `priority` | — | 3 each | — |
| `indicators` | — | — | 10 |
| `cronjobs` | — | — | 3 |
| `<hostname>` (connectivity probe) | 1 | 1 each | 1 |

Each worker carries a single-process queue named after its hostname for the account-onboarding connectivity test (the bot dispatches a probe job to each per-host queue to verify each server can reach the user's exchange account). Hyperion doesn't run Horizon — pure DB + Redis.

---

## What the command reports

Standalone invocation prints:

> Detected Kraite profile: **`<profile-name>`** (folder `<basename>`, target `<deploy-target>`).

…followed by the matrix row. When the caller is a parent kraite-* command, the profile name is enough — the parent's per-profile section takes over.

---

## Cross-lens links

- **[Architecture overview](/docs/servers/architecture-overview)** — the 10-box fleet these profiles map onto
- **[Athena (ingestion)](/docs/servers/athena)** — the box ingestion-profile commands target first
- **[Pheme (web)](/docs/servers/pheme)** — the box all web profiles deploy to
- **[Kraite — release](/docs/dynamic-commands/kraite-release)** — the parent pipeline that branches off this profile
