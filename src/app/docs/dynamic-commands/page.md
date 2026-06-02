---
title: Dynamic Commands
---

Dynamic commands are Bruno's portable operator vocabulary — one shared `.md` library at `~/Herd/.dynamic-commands/` that both Claude Code and Codex CLI dispatch through. Edit a command file once, both tools see the new behaviour on the next call. {% .lead %}

This chapter documents every command that lives in the library today. The dispatcher itself (`/do`) is not in the library — it's the thin per-tool router that reads the library files at invocation time.

---

## Why a shared library

Before this system, every custom slash command existed in two flavours — one for Claude (`~/.claude/commands/<name>.md`), one for Codex (its own folder, its own syntax). They drifted out of sync constantly. The dispatcher pattern collapses that into a single tool-agnostic prose file per command. Both tools read the same file and decide how to act with their native tool calls.

Result: edit `kraite-deploy.md` once → next time Bruno types `/do kraite-deploy` (Claude) or `use skill do kraite-deploy` (Codex), both tools execute the new behaviour. No skill reload, no IDE restart, no parallel maintenance.

---

## Invocation contract

The dispatcher reads `$ARGUMENTS` (everything after `/do`) and parses:

| Token | Meaning |
|---|---|
| **First whitespace-separated token** | the command name (`kraite-deploy`, `push`, `xss-audit`, etc.) |
| **Everything after the first token** | a free-form natural-language modifier — unrestricted, sits on top of whatever the library file says |

Empty `/do` → error, no auto-list. Missing file at `~/Herd/.dynamic-commands/<name>.md` → error, no fallback to native commands, no fuzzy-match suggestions. Bruno wants explicit failures, not menus.

The modifier is unrestricted on purpose. It can skip steps, override safety gates, redirect targets, change parameters — Bruno owns the consequences. The dispatcher does not sanitise it; it threads it through as additional instruction.

---

## Recursive dispatch

A library file may instruct "now run code-review" or "then do simplify on the dirty files". Each such sub-step re-enters the full dispatcher with a fresh read of the sub-command's `.md` file. Nothing is cached, nothing is paraphrased from memory. Editing `code-review.md` immediately changes every parent command that recurses into it — including releases, pushes, tags.

This cascading model is the whole reason the system exists. Without it, the parent commands would freeze their sub-skill semantics at authoring time, and edits to the leaf files would have no effect on real flows.

---

## Tool-agnostic prose

Each command file describes WHAT to do in plain English. Tool-specific affordances (Claude's `Read` / `Bash` / `Edit`, Codex's shell, scheduled-task primitives, etc.) are picked by the runtime. The library files never name Claude-only or Codex-only tools, never include conditional blocks per tool. If the prose needs a scheduled task or a log-tail or a database probe, it says so in tool-neutral language and trusts the runtime to find the right call.

This is non-negotiable: the moment a library file mentions `Read` or `WebFetch` or any tool name, it stops being portable.

---

## Command families

The library currently spans four families. Each family below maps a single project (or category) onto its operator surface.

### Kraite — trading-system operator stack

Profile-aware operator commands for the Kraite ingestion + web + worker fleet. Every kraite-* command starts by recursing into [`kraite-profile`](/docs/dynamic-commands/kraite-profile) to detect the active project from CWD, then branches per profile (ingestion / web-app / web-app-with-queue / static-site).

- [Kraite — commit](/docs/dynamic-commands/kraite-commit) — local commit, packages first, no push
- [Kraite — deploy](/docs/dynamic-commands/kraite-deploy) — profile-aware production deploy
- [Kraite — health](/docs/dynamic-commands/kraite-health) — fleet-wide datagrid probe
- [Kraite — profile](/docs/dynamic-commands/kraite-profile) — CWD → profile detection
- [Kraite — push](/docs/dynamic-commands/kraite-push) — push packages then main project, no tag
- [Kraite — read-docs](/docs/dynamic-commands/kraite-read-docs) — load Kraite functional + infra docs
- [Kraite — reboot](/docs/dynamic-commands/kraite-reboot) — per-host fleet reboot with REST reconcile
- [Kraite — release](/docs/dynamic-commands/kraite-release) — full release pipeline (docs → tests → tag → deploy → warmup → health)
- [Kraite — server-upgrade](/docs/dynamic-commands/kraite-server-upgrade) — fleet-wide OS apt upgrade with backup gate
- [Kraite — tag](/docs/dynamic-commands/kraite-tag) — docs + packages + main project tagging, no deploy
- [Kraite — update-docs](/docs/dynamic-commands/kraite-update-docs) — refresh raw specs + this syntax site
- [Kraite — warmup](/docs/dynamic-commands/kraite-warmup) — bring a project back online after deploy

### Quanamo — feedback-platform operator stack

Single-host (odin) variant of the same operator pattern. Three apps share the box — admin (PostgreSQL master), feedz (shares the same DB), kanban (own MySQL). No profile detection — quanamo has exactly one profile.

- [Quanamo — deploy](/docs/dynamic-commands/quanamo-deploy) — deploy admin / feedz / kanban
- [Quanamo — health](/docs/dynamic-commands/quanamo-health) — odin datagrid + AI optional check
- [Quanamo — read-docs](/docs/dynamic-commands/quanamo-read-docs) — load Quanamo docs + credentials
- [Quanamo — release](/docs/dynamic-commands/quanamo-release) — full release pipeline
- [Quanamo — tag](/docs/dynamic-commands/quanamo-tag) — tag the current project
- [Quanamo — update-docs](/docs/dynamic-commands/quanamo-update-docs) — refresh Quanamo functional docs
- [Quanamo — warmup](/docs/dynamic-commands/quanamo-warmup) — bring odin back online

### Ralph — autonomous overnight-run scaffolding

Ralph is the autonomous code-execution loop (per-iteration fresh Claude instance, no memory). The ralph-* commands manage the scaffolding around it — task queue, PRD conversion, deploy, monitor, archive.

- [Ralph — archive](/docs/dynamic-commands/ralph-archive) — snapshot artefacts after a run
- [Ralph — clean](/docs/dynamic-commands/ralph-clean) — reset task queue + PRD + progress
- [Ralph — convert](/docs/dynamic-commands/ralph-convert) — turn a PRD into prd.json user stories
- [Ralph — deploy](/docs/dynamic-commands/ralph-deploy) — transform tasks into prd.json
- [Ralph — install](/docs/dynamic-commands/ralph-install) — initialise Ralph in a new project
- [Ralph — monitor](/docs/dynamic-commands/ralph-monitor) — watch a running Ralph + inject fix specs
- [Ralph — post-review](/docs/dynamic-commands/ralph-post-review) — broken-only QA gate after a loop
- [Ralph — prepare](/docs/dynamic-commands/ralph-prepare) — Supervisor config so Ralph survives reboots
- [Ralph — task](/docs/dynamic-commands/ralph-task) — append a task to the queue

### Generic — cross-project dev commands

The "everyday" tooling — git workflow, code quality, requirements, memory, debugging, mode-switching. Project-agnostic by design.

- [brainstorm](/docs/dynamic-commands/brainstorm) — read-only solution exploration
- [code-review](/docs/dynamic-commands/code-review) — defend code against an SME review
- [code-safe](/docs/dynamic-commands/code-safe) — careful analysis-first mode
- [commit](/docs/dynamic-commands/commit) — local commit (packages first), no push
- [confirm](/docs/dynamic-commands/confirm) — verbal alignment checkpoint, zero tool calls
- [cv](/docs/dynamic-commands/cv) — silent re-anchor of global + project rules
- [distill](/docs/dynamic-commands/distill) — force the librarian to process learnings
- [elicitate](/docs/dynamic-commands/elicitate) — Senior IT BA requirements session
- [explain](/docs/dynamic-commands/explain) — onion-peel conceptual explanation, read-only
- [fix](/docs/dynamic-commands/fix) — disciplined fix with dependency mapping
- [forget](/docs/dynamic-commands/forget) — remove a specific learning
- [learn](/docs/dynamic-commands/learn) — understand a codebase area, brevity-first
- [memorize](/docs/dynamic-commands/memorize) — store a learning to persistent memory
- [memory](/docs/dynamic-commands/memory) — librarian status / stats
- [pest](/docs/dynamic-commands/pest) — adversarial Pest test authoring
- [prd](/docs/dynamic-commands/prd) — Product Requirements Document generator
- [pull](/docs/dynamic-commands/pull) — sync from remote with safe default
- [push](/docs/dynamic-commands/push) — commit + push, packages first
- [read-docs](/docs/dynamic-commands/read-docs) — read project documentation
- [refactor](/docs/dynamic-commands/refactor) — rethink-then-polish refactor flow
- [screenshot](/docs/dynamic-commands/screenshot) — analyse upload.waygou.com screenshots
- [tag](/docs/dynamic-commands/tag) — full release pipeline against odin
- [tm](/docs/dynamic-commands/tm) — too-much trigger, rewrite terser
- [troubleshoot](/docs/dynamic-commands/troubleshoot) — root-cause-or-nothing diagnosis
- [update-docs](/docs/dynamic-commands/update-docs) — refresh project docs
- [upset](/docs/dynamic-commands/upset) — caught-slipping reset + verify-from-zero protocol
- [xss-audit](/docs/dynamic-commands/xss-audit) — multi-section security audit checklist

---

## Authoring conventions

Three rules govern every library file:

1. **Tool-agnostic prose.** WHAT to do, not HOW. No tool names.
2. **Frontmatter for discoverability.** `name`, `description`, `keywords` — purely human-facing, the dispatcher itself doesn't parse them.
3. **Reference sub-skills by their command name.** `"now run code-review"` (the dispatcher converts that to `/do code-review` recursion). Never paste a sub-skill's body inline — that freezes a stale copy.

When migrating a native slash command into the library, the retired native body lands in `~/Herd/.dynamic-commands/backup/<name>.md` so the system travels together if the folder is ever git-tracked or cloud-synced.

---

## Cross-lens links

- **[Architecture overview](/docs/servers/architecture-overview)** — the fleet these commands operate on
- **[Lifecycles](/docs/lifecycles/position-lifecycle)** — the trading flows that release / deploy / reboot eventually touch
- **[Subsystems — dispatch daemon](/docs/subsystems/dispatch-daemon)** — the runtime piece that cooldown / warmup pause and resume
