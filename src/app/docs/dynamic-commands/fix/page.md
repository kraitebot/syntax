---
title: fix
---

`fix` applies a diagnosed bug fix with **full dependency awareness and solution validation**. No rushing, no first-instinct coding, no narrow fixes that break other flows. {% .lead %}

**Precondition: diagnosis must exist.** If the root cause isn't identified and located, STOP and recurse into [`troubleshoot`](/docs/dynamic-commands/troubleshoot) first. This command starts AFTER the problem is understood.

---

## The two hard gates — non-negotiable

### Gate 1 — map the dependency graph (DO NOT SKIP)

Before ANY fix code:

1. Identify the exact file(s) and method(s) to change
2. Trace EVERY caller, consumer, and dependent:
   - Search for usages across the codebase
   - Check parent classes, interfaces, traits
   - Check who calls the method, who extends the class
   - Check views / JS that reference the endpoint or data shape
   - Check jobs / listeners / observers that react to this model/event
3. List them explicitly. No hand-waving.

"Probably nothing else uses this" → BANNED. Verify.

**This is where you fail most often.** You fix the reported case, forget the class is called from 3 other places that now break. STOP. MAP. VERIFY.

### Gate 2 — challenge your solution (DO NOT SKIP)

Before implementing, stress-test the fix mentally:

1. State your proposed fix in one sentence
2. Answer each:
   - Does this fix ONLY the bug, or change behaviour for working cases?
   - What happens to each dependent under this fix?
   - Is there a simpler fix that touches less code?
   - Am I fixing the symptom or the actual root cause?
   - Could this introduce a regression in a different state / mode / edge case?
3. ANY uncertain answer → investigate further before coding. Don't proceed on "probably fine".

**This is where cyclic hallucinations start.** First solution is a HYPOTHESIS, not a conclusion. Prove it before committing.

---

## Execution flow

| Step | Action |
|---|---|
| 1. Write a failing test | Reproduces the exact bug. Run it. Confirm it FAILS. Proof the bug exists |
| 2. Apply the fix | Minimal change. Only what's necessary. No cleanup, no refactoring, no "while I'm here" |
| 3. Run the bug test | Must now PASS |
| 4. Run dependency tests | Cover EVERY dependent from Gate 1. No tests for a dependent → state that and verify manually |
| 5. Confirm | All pass. Report: what fixed, what verified, done |

---

## Anti-patterns — hard bans

- **No fixing without dependency mapping.** Gate 1 is not optional.
- **No trusting first instinct.** Gate 2 is not optional.
- **No stacking fixes on fixes.** Fix breaks something → REVERT, go back to Gate 2. Don't patch on top.
- **No "probably fine".** Prove or investigate.
- **No touching unrelated code.** Stay in scope. Note smells, don't fix them.
- **No skipping the failing test.** Can't write one → you don't understand the bug well enough.

---

## If stuck in a loop

Fix → breaks something → fix that → breaks something else → you're cycling. STOP IMMEDIATELY:

1. Revert ALL changes to the starting state
2. Re-read Gate 1 and Gate 2 from scratch
3. Your mental model is wrong. The first solution was wrong. Start fresh
4. Still stuck after one clean retry → report honestly: "I've attempted this twice and my approach isn't working. Here's what I've tried and where it breaks. I need to rethink."

---

## Related

- [troubleshoot](/docs/dynamic-commands/troubleshoot) — what runs before fix (diagnosis)
- [code-safe](/docs/dynamic-commands/code-safe) — sibling discipline mode (analysis-first, scope-locked)
- [upset](/docs/dynamic-commands/upset) — when the fix loop won't break
- [pest](/docs/dynamic-commands/pest) — for writing the failing test in Step 1
