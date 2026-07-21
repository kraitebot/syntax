# Changelog

## [0.6.0] — 2026-07-21

### Trading, registration, and mobile reference

- [IMPROVED] Position and order lifecycles document Bitget Unified's combined
  protection identity, rejected-order recovery, and confirmed-flat manual
  closure without a redundant exchange close.
- [IMPROVED] Account and architecture chapters document the mandatory
  registration acknowledgements, 6+6 slot defaults, and release-gated mobile
  passkey boundary.

## [0.5.3] — 2026-07-20

### Order synchronization reference

- [IMPROVED] Position and order lifecycle chapters document working-only
  polling and fresh authentication for every signed retry.

## [0.5.2] — 2026-07-20

### Fleet documentation

- [FIXED] Athena topology pages now match the deployed 16-process indicator
  pool instead of the former 10-process setting.

## [0.5.1] — 2026-07-20

### Deployment safety

- [FIXED] Deploy docs define leaf-only dual-prefix cooldown draining and the
  current Athena indicator pool of 16 processes.

## [0.5.0] — 2026-07-20

### Trading and operations reference

- [IMPROVED] Account and lifecycle chapters document Binance one-way/hedge and
  Bitget Classic/Unified one-way/hedge compatibility without changing Kraite's
  one-position-per-symbol strategy.
- [IMPROVED] Dispatcher, scheduler, indicators, and Horizon chapters document
  replay-safe recovery, atomic child workflows, six-hour bracket sweeps,
  priority connectivity, stale-copy suppression, and Athena's 16-worker pool.
- [IMPROVED] Open-position docs show the lifecycle rail ending at stop-loss.

## [0.3.9] — 2026-07-19

### Mobile API implementation

- [IMPROVED] Architecture and Pheme chapters now document the live read-only
  mobile API, revocable device tokens, trader-owned account data, throttling,
  and bounded cached dashboard responses.

## [0.3.8] — 2026-07-19

### Bitget opening and onboarding safety

- [IMPROVED] Position, account, and Horizon chapters now document live Bitget
  position-mode synchronization, retry-safe protection, shared request limits,
  and withdrawal-disabled registration.

## [0.3.7] — 2026-07-18

### Trading behavior refresh

- [IMPROVED] Token-selection and Horizon chapters now document closed-only
  fast-track history and Bitget's endpoint-, IP-, and API-key-scoped request
  pacing.

## [0.3.5] — 2026-07-17

### Account behavior refresh

- [IMPROVED] The account domain now documents Bitget registration, dual-product
  wallet reads, full-fleet connectivity recovery, subscription-aware trading
  readiness, and safe quote locking around open exposure.

## [0.3.4] — 2026-07-16

### Alert behavior refresh

- [IMPROVED] Scheduler, indicator, and notification chapters now document
  post-warmup freshness grace, active per-symbol repairs, and normal-priority
  WAP delivery.

## [0.3.3] — 2026-07-14

### Operational behavior refresh

- [IMPROVED] Position, order, token-selection, scheduler, and Horizon chapters now document atomic child-chain ownership, `waping` open-slot semantics, delisted active-exposure handling, correction/replacement flows, cooldown scheduling, command safety, and physical per-worker queue monitoring.

## [0.3.1] — 2026-06-05

### Chapter refresh — pheme / tyche / horizon-queues

- [IMPROVED] **Pheme server chapter** — per-app Horizon reality (three supervisors: admin / console / kraite, all `QUEUE_CONNECTION=redis`), `REDIS_QUEUE=pheme-web` wiring documented as live (gap closed 2026-06-05), queue table reworked (logical `web` → physical `pheme-web`).
- [IMPROVED] **Horizon-queues chapter** — `pheme-web` described via the `{hostname}-{logical}` composition, stale `QUEUE_CONNECTION=database` claim removed, interchangeable-worker framing restored (per-account-range claim was obsolete).
- [IMPROVED] **Tyche chapter** — 20/20/5/5 process counts + priority-lane callout (carried from the 06-02 pass, first published here).

## [0.3.0] — 2026-06-02

### New chapter — Dynamic Commands

- [NEW FEATURE] **New top-level chapter — Dynamic Commands** at `/docs/dynamic-commands/`. Sits after Lifecycles in the sidebar. Documents the `/do` dispatcher pattern (`~/Herd/.dynamic-commands/` shared library, recursive sub-skill dispatch, free-form modifier contract, tool-agnostic prose authoring rules) and every command currently in the library.
- [NEW FEATURE] **Landing page** — `/docs/dynamic-commands/page.md`. Covers the why-this-exists rationale (shared library across Claude + Codex, edit-once propagation), the invocation contract, recursion semantics, tool-agnostic authoring rules, and indexes every sub-page grouped by family (Kraite / Quanamo / Ralph / generic).
- [NEW FEATURE] **One sub-page per command — 55 in total:**
  - **Kraite (12):** `kraite-commit`, `kraite-deploy`, `kraite-health`, `kraite-profile`, `kraite-push`, `kraite-read-docs`, `kraite-reboot`, `kraite-release`, `kraite-server-upgrade`, `kraite-tag`, `kraite-update-docs`, `kraite-warmup`.
  - **Quanamo (7):** `quanamo-deploy`, `quanamo-health`, `quanamo-read-docs`, `quanamo-release`, `quanamo-tag`, `quanamo-update-docs`, `quanamo-warmup`.
  - **Ralph (9):** `ralph-archive`, `ralph-clean`, `ralph-convert`, `ralph-deploy`, `ralph-install`, `ralph-monitor`, `ralph-post-review`, `ralph-prepare`, `ralph-task`.
  - **Generic (27):** `brainstorm`, `code-review`, `code-safe`, `commit`, `confirm`, `cv`, `distill`, `elicitate`, `explain`, `fix`, `forget`, `learn`, `memorize`, `memory`, `pest`, `prd`, `pull`, `push`, `read-docs`, `refactor`, `screenshot`, `tag`, `tm`, `troubleshoot`, `update-docs`, `upset`, `xss-audit`.
- [IMPROVED] **`navigation.ts`** — adds the new `Dynamic Commands` section after `Lifecycles`, with one sidebar entry per command in family-grouped order.

## [0.2.0] — 2026-06-01

### Server lens — pheme web host split

- [NEW FEATURE] **New chapter — Pheme (web)** at `/docs/servers/pheme/`. Dedicated host (CPX22, `62.238.38.113`, `10.0.0.9`) that took `admin / console / kraite.com / syntax` off athena on 2026-06-01. Covers workload, connectivity model, what does NOT run there, the split rationale, and failure isolation vs. athena.
- [IMPROVED] **Athena chapter rewritten.** Title now `Athena (ingestion)`. Web subsection removed; replaced by an explicit "What does NOT run here (since 2026-06-01)" block pointing to pheme. Failure-isolation section updated to reflect that an athena reboot no longer touches the operator UI.
- [IMPROVED] **Architecture overview** now describes an eight-box layout. Server table + topology diagram + failure-semantics table all include pheme.
- [IMPROVED] **Server lens landing page** — quick-link card for pheme added; athena card retitled `(ingestion)`.
- [IMPROVED] **`navigation.ts`** — sidebar gains a `Pheme (web)` entry between Athena and the workers.

## [0.1.0] — 2026-05-13

### Brand
- Replaced template logomark with the Kraite snake (krait-500 `#22c55e`).
- Switched accent palette across the site from `sky-*` to `green-*` (Tailwind defaults map to brand greens).
- Recoloured Quick Link hover gradient and lightbulb icon gradient to the krait green ramp (`#4ade80 → #22c55e → #15803d`).
- Updated Prism code-block string token to the green palette.

---

## 2025-07-29

- Update to React 19 and Next.js 15.4

## 2025-05-22

- Fix bug with focus styles

## 2025-04-28

- Update template to Tailwind CSS v4.1.4

## 2025-04-10

- Update template to Tailwind CSS v4.1.3

## 2025-03-22

- Update template to Tailwind CSS v4.0.15

## 2025-03-18

- Fix heading spacing in callout component ([#1677](https://github.com/tailwindlabs/tailwind-plus-issues/issues/1677))

## 2025-02-10

- Update template to Tailwind CSS v4.0.6

## 2025-01-23

- Update template to Tailwind CSS v4.0

## 2024-06-21

- Bump Headless UI dependency to v2.1

## 2024-06-18

- Update `prettier` and `prettier-plugin-tailwindcss` dependencies

## 2024-05-31

- Fix `npm audit` warnings

## 2024-05-07

- Bump Headless UI dependency to v2.0

## 2024-01-17

- Fix `sharp` dependency issues ([#1549](https://github.com/tailwindlabs/tailwind-plus-issues/issues/1549))

## 2024-01-10

- Update Tailwind CSS, Next.js, Prettier, TypeScript, ESLint, and other dependencies
- Update Tailwind `darkMode` setting to new `selector` option

## 2023-10-23

- Bump Markdoc dependencies
- Remove unnecessary Markdoc configuration in `next.config.mjs` file

## 2023-09-07

- Added TypeScript version of template

## 2023-09-05

- Add scroll position buffer for table of contents ([#1499](https://github.com/tailwindlabs/tailwind-plus-issues/issues/1499))

## 2023-08-15

- Bump Next.js dependency

## 2023-08-11

- Port template to Next.js app router

## 2023-07-24

- Fix search rendering bug in Safari ([#1470](https://github.com/tailwindlabs/tailwind-plus-issues/issues/1470))

## 2023-07-18

- Add 404 page
- Sort imports

## 2023-05-16

- Bump Next.js dependency

## 2023-05-15

- Replace Algolia DocSearch with basic built-in search ([#1395](https://github.com/tailwindlabs/tailwind-plus-issues/issues/1395))

## 2023-04-11

- Bump Next.js dependency

## 2023-04-05

- Fix listbox console error ([#1442](https://github.com/tailwindlabs/tailwind-plus-issues/issues/1442))

## 2023-03-29

- Bump Tailwind CSS and Prettier dependencies
- Sort classes

## 2023-03-22

- Bump Headless UI dependency

## 2023-02-15

- Remove `passive` option from `removeEventListener`

## 2023-02-02

- Bump Headless UI dependency
- Sort imports

## 2022-11-04

- Bump Tailwind CSS and Next.js dependencies

## 2022-09-27

- Update Headless UI, Next.js, Markdoc, and Autoprefixer dependencies
- Fix nav sidebar overflow issue ([#1337](https://github.com/tailwindlabs/tailwind-plus-issues/issues/1337))

## 2022-09-19

- Fix bug with theme switching ([#1325](https://github.com/tailwindlabs/tailwind-plus-issues/issues/1325))

## 2022-09-09

- Update Next.js dependency

## 2022-09-07

- Update Headless UI dependency

## 2022-09-01

- Update Tailwind CSS, Next.js, Headless UI, ESLint, and other dependencies

## 2022-08-16

- Enable experimental Next.js `scrollRestoration` flag

## 2022-07-26

- Fix issue with table customizations ([#1278](https://github.com/tailwindlabs/tailwind-plus-issues/issues/1278))

## 2022-07-25

- Update Next.js and React dependencies

## 2022-07-11

- Add `.env.example` file ([#1260](https://github.com/tailwindlabs/tailwind-plus-issues/issues/1260))

## 2022-07-07

- Fix duplicated empty lines in code blocks

## 2022-07-06

- Replace `next/image` with `next/future/image`

## 2022-06-23

- Initial release
