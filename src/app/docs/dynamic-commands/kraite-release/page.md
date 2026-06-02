---
title: Kraite — release
---

`kraite-release` is the **end-to-end release pipeline** for the current Kraite project — docs (ingestion only), tests, tag, deploy, warmup, health check. Profile-aware: the pipeline auto-skips phases that don't apply to the active project. {% .lead %}

---

## Pipeline phases

The pipeline runs in this fixed order. Phases that don't apply to the profile are auto-skipped (not errors).

| Phase | ingestion | admin / console (web-app-with-queue) | syntax (static-site) | kraite (web-app) |
|---|---|---|---|---|
| 0 — Update docs | full | skip | skip | skip |
| 1 — Tests | step-dispatcher + project (mandatory) | run if suite exists | skip | run if suite exists |
| 2 — Tag | yes | yes | yes | yes |
| 3 — Deploy | multi-server (athena → workers) | pheme | pheme (atomic file swap) | pheme |
| 4 — Health check | full fleet | pheme web + Horizon | URL 200 | pheme web + DB |
| 5 — Cleanup | cancel session schedulers | same | same | same |

---

## Modifiers

| Modifier | Effect |
|---|---|
| `skip-ci` | Skip the CI wait — push still happens, CI still runs, just doesn't block the tag. **Ingestion only**; web profiles have no CI to skip. |
| `skip-tests` | Skip Phase 1 entirely. Dangerous — only for pure config/docs changes where no code path changed. |
| `skip-ci skip-tests` | Both. |

The modifier arrives as free-form text from the dispatcher; Bruno owns the consequences. The command does not refuse to apply them.

---

## Test gate semantics (Phase 1)

Universal rule across profiles: **detect first, then run unmasked**. The previous habit of guarding pest with `|| echo "no suite"` swallowed real failures. Detection cascade — pest binary present → `vendor/bin/pest --compact` with explicit 512M memory limit; phpunit config present → fall back to `php artisan test --compact`; nothing → emit "no test suite — skipped" and continue.

For ingestion, step-dispatcher tests run **first**: it's the foundation, if its tests fail nothing downstream is trustworthy.

{% callout title="Why vendor/bin/pest directly, not php artisan test" %}
The Laravel test runner wrapper triggers Pest's browser plugin `terminate()` hook at shutdown, which crashes against the default 128 MB PHP memory limit (`Allowed memory size of 134217728 bytes exhausted in vendor/symfony/console/Input/Input.php:40`). The fatal hits AFTER all tests pass, masking the real summary as a "failure". Invoking `vendor/bin/pest` directly with an explicit `memory_limit=512M` bypasses the wrapper and finishes cleanly. Discovered 2026-05-24 during the v1.49.8 release.
{% /callout %}

---

## Deploy ordering (ingestion)

Phase 3 on ingestion is decided centrally: **cool down ALL → deploy ALL → warmup WORKERS → warmup ATHENA**. The athena-last ordering is the structural fix for the v1.49.8 scheduler-race incident — see [`kraite-deploy`](/docs/dynamic-commands/kraite-deploy) for the full rationale.

---

## Hard rules

- **Profile decided by CWD.** Don't pass hostname args here.
- **Tests are the first hard gate.** No tests pass = no release. Period.
- **Tag BEFORE deploy** — universal across profiles.
- **CI gate is ingestion-only.** Web profiles short-circuit; `skip-ci` is a no-op on them.
- **No dev-master on production** — the deploy aborts if detected (PHP profiles).
- **Cancel all scheduled tasks when done** — no stale CI polls left running between releases.
- **If any phase fails → STOP.** Report what failed and where. Don't continue.

---

## Related

- [Kraite — tag](/docs/dynamic-commands/kraite-tag) — Phase 2 entry point (also runs standalone)
- [Kraite — deploy](/docs/dynamic-commands/kraite-deploy) — Phase 3 entry point
- [Kraite — warmup](/docs/dynamic-commands/kraite-warmup) — Phase 3 finisher
- [Kraite — health](/docs/dynamic-commands/kraite-health) — Phase 4 entry point
- [Kraite — update-docs](/docs/dynamic-commands/kraite-update-docs) — Phase 0 entry point (ingestion only)
