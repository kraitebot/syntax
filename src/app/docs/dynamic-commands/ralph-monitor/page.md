---
title: Ralph — monitor
---

`ralph-monitor` watches a running Ralph process, verifies each spec's acceptance criteria as Ralph progresses, and **injects corrective fix specs** when criteria are not met. Autonomous QA of Ralph's work. {% .lead %}

---

## Polling

3-minute interval. Report email: `bruno.falcao@live.com` via Laravel Mail.

---

## Phase 1 — gather context

1. Read every spec from `.ralph/specs/`, parse its `## Acceptance Criteria` checklist
2. Tail last 200 lines of `.ralph/live.log`
3. Read `.ralph/progress.json` and `.ralph/status.json` if present
4. Determine which specs Ralph has already attempted (git log mentions, files modified vs spec's "Files to Modify", `---RALPH_STATUS---` blocks in `live.log`)

---

## Phase 2 — monitor loop (every 3 min)

For each spec that appears to have finished (committed or moved past):

1. Read its acceptance criteria
2. Verify each criterion using the right method:

| Criterion type | Verification |
|---|---|
| File exists / modified | Search or read |
| Route exists | `php artisan route:list` |
| Database value correct | DB query or tinker |
| PHP code works | Tinker |
| View renders | Tinker with try/catch around `view('name')->render()` |
| Build succeeds | `npm run build` |
| No placeholder text | grep for "TBD", "placeholder", "lorem" |
| Browsershot works | Tinker: `Browsershot::html('<h1>Test</h1>')->save('/tmp/test.pdf')` |
| Config/env correct | tinker / config tool |

3. Score each spec — passed vs total

### Inject corrective specs

When a spec has failures, create `{original}b-fix-{short-description}.md` (e.g. `17b-fix-browsershot-flags.md`). Filename sort order makes it run right after the original (`17b` sorts between `17` and `18`). If `b` exists, use `c`, `d`, etc.

Fix spec format mirrors the original — Objective, What Failed (criteria + finding), Implementation (precise file/line/change), Acceptance Criteria (only the unmet ones), Blocked By, Blocks.

### Log progress

Running monitor log at `.ralph/monitor.log`:

```
[2026-02-12 07:30] Spec 17: 5/7 criteria passed. Created 17b-fix-browsershot-flags.md
[2026-02-12 07:33] Spec 18: Pending (Ralph still working)
[2026-02-12 07:36] Spec 17b: 2/2 criteria passed. VERIFIED.
```

---

## Phase 3 — final report

When Ralph signals `STATUS: COMPLETE` or all specs + fix specs are verified, compile a summary (pass rate, per-spec results, fix specs injected, files modified, remaining issues, recommendations). Email it via Laravel Mail; save to `.ralph/monitor-report.md` either way.

---

## Hard rules

- **Do NOT interfere with Ralph's running process** — only read logs and verify outputs.
- **Do NOT modify files Ralph is actively working on** — only write NEW fix spec files.
- **Wait at least 1 full polling cycle** after Ralph commits before verifying — give it time to finish.
- **Be conservative** — flag a criterion as failed only if you actually tested it.
- **Sort order matters** — fix specs MUST sort between original and next spec.
- **Do not create duplicate fix specs** — if `17b` covers the issue, don't create `17c` for the same.

---

## Related

- [Ralph — post-review](/docs/dynamic-commands/ralph-post-review) — broken-only QA at end of run
- [Ralph — deploy](/docs/dynamic-commands/ralph-deploy) — what kicked off the run being monitored
- [Ralph — archive](/docs/dynamic-commands/ralph-archive) — what runs after the loop finishes
