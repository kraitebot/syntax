---
title: troubleshoot
---

`troubleshoot` systematically **diagnoses, tests, and fixes** issues. The argument is the description of the issue. {% .lead %}

---

## Golden rule — root cause or nothing

**Never stop at the first suspicious thing. Never propose a fix until the root cause is PROVEN with evidence.**

- Trace the full code path start → finish
- Ask "WHY" not "WHAT"
- Hypothesis without evidence = banned
- Declaring victory before re-running the failing test = banned
- Band-aids that mask symptoms = banned

---

## Phase 1 — diagnose

| Step | Action |
|---|---|
| 1. Context | Action taken, expected vs actual result, when did it start |
| 2. Logs | Cheapest log tool first (e.g. `last-error` MCP). Escalate to broader log reads only if needed, capped at 3 entries |
| 3. Trace code path | Read controller / job / service. Follow entry → failure point |
| 4. DB state | If relevant, verify records involved in the failure |
| 5. Confirm root cause | Exact file, line, reason. Don't proceed until you can explain WHY it broke |

---

## Phase 2 — test gap analysis

1. **Check existing tests** — search for the class/method name in `tests/`
2. **Explain the gap** — why didn't an existing test catch this? Missing? Doesn't cover this scenario? Mocked away the real behaviour?
3. **Decide type** — feature (most common) or unit. Prefer feature.

---

## Phase 3 — write failing test

```bash
php artisan make:test --pest {Name} --no-interaction
php artisan test --compact --filter={TestName}
```

The test MUST FAIL before you fix anything. If it passes, the test doesn't capture the bug — rewrite it.

---

## Phase 4 — fix

1. **Minimal fix.** Change ONLY what resolves the root cause. **Zero refactoring. Zero "improvements". Zero adjacent cleanup.** Out-of-scope edit = violation.
2. `vendor/bin/pint --dirty --format agent`

---

## Phase 5 — verify

```bash
php artisan test --compact --filter={TestName}
```

PASS → done. FAIL → back to Phase 4. If the fix touched shared code, run broader suite scoped to the relevant file/folder.

---

## Output shape

```
## Troubleshooting Report: [Issue Summary]

### Root Cause
[Specific cause — file, line, config value, DB record]

### Evidence
[Logs, config values, database records that confirmed the cause]

### Test Gap
[Why no existing test caught this]

### Test Created
[Test file path and what it asserts]

### Fix Applied
[What was changed — file:line]

### Verification
- Test before fix: FAILED
- Test after fix: PASSED
```

---

## Common issue checklists

| Symptom | First-check |
|---|---|
| PDF rendering errors | Browser binary path; node wrapper executable; temp dir permissions |
| Email not sent/received | Mail config (forced recipient, driver); notification logs; queue processing |
| API 401/403 | Request logs; credentials; blocked hosts |
| Jobs/steps stuck | Worker running; error messages on stuck records; queue processing |
| Third-party API issues | API keys; env (dev vs prod); record status in DB |

---

## Related

- [fix](/docs/dynamic-commands/fix) — the next-step command once the diagnosis is locked
- [pest](/docs/dynamic-commands/pest) — Phase 3 entry point (the failing test)
- [upset](/docs/dynamic-commands/upset) — when troubleshoot enters a retry loop with no progress
