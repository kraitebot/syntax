---
title: Ralph — archive
---

`ralph-archive` snapshots a Ralph run's artefacts into a timestamped folder, then resets the working directories for the next batch. {% .lead %}

Ralph is the autonomous code-execution loop: per-iteration fresh Claude instance, no memory of previous work. Each run accumulates specs, logs, progress files in `.ralph/`. This command preserves them as `.ralph/archive-YYYY-MM-DD-HHmm/` so the next run starts clean.

---

## When to use

- After a Ralph run completes (success or failure)
- Before starting a new batch of specs
- To preserve history before [`ralph-clean`](/docs/dynamic-commands/ralph-clean) wipes the slate

---

## What gets archived

From `.ralph/` into `.ralph/archive-{timestamp}/`:

| Item | Notes |
|---|---|
| `specs/` | The entire spec directory |
| `logs/` | All log files (`claude_output_*`, `ralph*.log`, stream logs) |
| `live.log` | Ralph live output |
| `progress.json` | Task progress tracker |
| `status.json` | Run status |
| `fix_plan.md` | If it exists |

---

## What gets cleaned (post-archive)

Empty `.ralph/specs/` and `.ralph/logs/` are recreated. Runtime state files are deleted so the next run starts fresh:

- `.call_count`, `.last_reset`, `.ralph_session`
- `.loop_start_sha`, `.exit_signals`
- `.circuit_breaker_state`, `.circuit_breaker_history`
- `monitor.log`, `monitor-report.md`

---

## Hard rules

- **Do NOT archive or clean** `AGENT.md`, `PROMPT.md`, `templates/`, `docs/`, or shell scripts — persistent config.
- **Do NOT nest archives** — skip existing `archive-*` folders.
- **Empty `.ralph/specs/` with no logs/status** → inform the user, nothing to archive.
- **Timestamp collision** → append `-2`.

---

## Related

- [Ralph — clean](/docs/dynamic-commands/ralph-clean) — sibling reset (different scope: PRD + task queue, not run artefacts)
- [Ralph — monitor](/docs/dynamic-commands/ralph-monitor) — what generates the archived artefacts
- [Ralph — post-review](/docs/dynamic-commands/ralph-post-review) — what to run before archiving (final QA)
