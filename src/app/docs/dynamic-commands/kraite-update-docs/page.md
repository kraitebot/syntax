---
title: Kraite — update-docs
---

`kraite-update-docs` keeps Kraite documentation current with infrastructure, architecture, and feature changes. It maintains **two surfaces** — the raw functional specs in `~/Herd/docs/kraite/` and this curated four-lens reader site at `~/Code/syntax.kraite.test/`. {% .lead %}

The canonical updater runs from the ingestion repository because that project owns the cross-Kraite documentation set. A release started from admin, Kraite, or Syntax switches to that ingestion context for its documentation phase, so cross-project changes are still captured before shipping.

---

## Documentation surfaces

| Location | Purpose | Update when... |
|---|---|---|
| `~/Herd/docs/kraite/00-context/` | Architecture, server prep, go-live | Infrastructure / new servers / arch decisions |
| `~/Herd/docs/kraite/02-features/` | Per-feature functional specs | Feature behaviour or new feature |
| `~/Herd/docs/kraite/04-admin/` | Operator UI / sysadmin specs | Admin behaviour change |
| `~/Herd/.credentials/kraite/servers.json` | Server IPs / roles / credentials | New server, IP change, role change |
| `~/Herd/.credentials/kraite/deploy-notes.md` | Deploy lessons (numbered, never renumbered) | Deploy incident, new gotcha |
| `~/Herd/.credentials/kraite/hardening.json` | Per-server hardening checklist | Security changes, new packages |
| `~/Herd/.dynamic-commands/<file>.md` | The library file itself | Its own behaviour changes |
| `~/Code/syntax.kraite.test/src/app/docs/<lens>/<chapter>/page.md` | This reader site, current state only | Any user-visible / functional change |

---

## Four-lens model (reader site)

The same change is documented from each angle that's affected — never duplicating canonical depth, always cross-linking back.

| Lens | Question it answers | Folder |
|---|---|---|
| **Subsystem** | "What does this piece of machinery do?" | `subsystems/` |
| **Server** | "Which box runs this and why?" | `servers/` |
| **Domain** | "What is this business object and what states can it be in?" | `domains/` |
| **Lifecycle** | "What's the full flow from start to finish?" | `lifecycles/` |

**Canonical-chapter rule:** the deep step-by-step flow (with step class names in order, decision points, rationale) lives in **one** chapter only — usually the lifecycle chapter for end-to-end flows, or the subsystem chapter for daemon-internal mechanics. Other lenses get short angle-specific views that **link back** to the canonical chapter. Never restate the full flow in multiple chapters.

---

## Depth contract per chapter

Every authored chapter (not stub) must carry:

1. Lead paragraph with `{% .lead %}`
2. Flow narrative — ordered phases / states
3. Step class names listed in order, in `inline code`, no class internals
4. Decision points and branching — what triggers what, retry / idempotency rules
5. Rationale — *why* each decision exists, with incident dates and concrete context (e.g. "LAB #121 race window", "Position #64 on USELESS hit min_notional below 5"). Multi-paragraph rationale → `{% callout %}`; one-liner → inline prose
6. Cross-lens links section

Banned content: class internals, method signatures, full code snippets, framework-feature explanations. Those belong on the future `api.kraite.com` reference site.

---

## "Major decision" threshold (wide net)

Surface in the chapter if the change is **any** of:

- Bruno-approved decision in conversation
- Anything that changes business behaviour (filter rules, branching, what gets traded / skipped)
- Incident-driven rule (past production incident → preventive rule)
- Architectural choice that constrains future work

Sub-thresholds (cosmetic refactors, pure renames, dependency bumps) → not worth a chapter mention.

---

## Code-change → chapter mapping

When deciding which chapters need touching for a given commit:

| Code area | Lens chapters typically touched |
|---|---|
| `app/Jobs/Position/**` | `lifecycles/position-lifecycle` (canonical) + `subsystems/dispatch-daemon` + `servers/kraite` + `domains/open-positions` |
| `app/Jobs/Order/**`, observers | `lifecycles/order-lifecycle` + `domains/orders` + relevant subsystem |
| `app/Console/Commands/Kraite*` (cron) | `subsystems/scheduler` + the lifecycle the command triggers |
| Horizon config / supervisor | `subsystems/horizon-queues` + the affected server chapter |
| `kraite:stream-*` daemons | `subsystems/websocket-streams` + the lifecycle they feed |
| Server topology / IP / role change | `servers/<server-name>` + `servers/architecture-overview` |
| New token-selection rule | `domains/token-selection` + `domains/open-positions` |
| New indicator or scoring change | `domains/indicators` + `domains/token-selection` |
| Market-regime / BTC bias logic | `subsystems/market-regime` + `domains/token-selection` |

When in doubt: update the canonical chapter for the flow + the most-specific lens. Never update more than necessary.

---

## When NOT to touch the syntax site

- Pure infra / hardening / deploy-notes changes with no functional surface for Bruno
- Test-only changes
- Pure refactors with no behaviour change
- Documentation-only edits inside `~/Herd/docs/kraite/` (this site is curated FROM raw specs — re-curating without behaviour change is busywork)

---

## Global guidelines routing — mandatory

Generic guidelines (PHP / Laravel / git / tests / debugging conventions) do NOT belong in Kraite docs. They live in `~/.claude/rules/*.md` (`laravel.md`, `ui.md`, `frontend.md`, `database.md`, `debugging.md`, `testing.md`, `git.md`). Detect generic content BEFORE writing into Kraite docs; route to the matching rule file.

---

## Hard rules

- **README first** — `~/Herd/docs/kraite/README.md` must be read before any feature doc is touched.
- **80-char line wrap** on raw spec edits.
- **Functional specs only.** Code details are BANNED from docs — no line-by-line code, no method signatures, no variable names. If it's in the code, don't duplicate it in docs.
- **Update `WhereAreWe.md`** in the current project root after any doc update.
- **`npm run build` + smoke-check** every refreshed chapter on the syntax site before declaring done.

---

## Related

- [Kraite — read-docs](/docs/dynamic-commands/kraite-read-docs) — the reader counterpart
- [Kraite — tag](/docs/dynamic-commands/kraite-tag) — the parent that calls update-docs as Step 1c
- [Kraite — release](/docs/dynamic-commands/kraite-release) — Phase 0 entry point for every profile
- [update-docs](/docs/dynamic-commands/update-docs) — generic version (`docs/<project>/` for any project)
