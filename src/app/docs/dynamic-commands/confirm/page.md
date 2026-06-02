---
title: confirm
---

`confirm` is an **absolute freeze**. No code, no file reads, no shell commands, no tool calls of any kind. Verbal-only alignment checkpoint before doing anything. {% .lead %}

---

## What the command does

Bruno fires `/do confirm` when he wants to lock in shared understanding before any execution. The response MUST:

1. **State what you understood** — in your own words, what is Bruno actually asking?
2. **State what you will NOT do** — anything ambiguous or intentionally out of scope.
3. **Wait for approval.** If Bruno corrects, restate the updated understanding and wait again.

---

## Output shape

```
## My understanding

**What you're asking**: [plain description of the task in your own words]

**Expected result**: [what it should look like / behave like when done]

**Out of scope**: [what I'm NOT touching]

Waiting for your go-ahead.
```

---

## Hard rules

- **NO tool calls of any kind.** No reads, no shell, no edits.
- **NO code generation.**
- **NO assumptions.** Anything unclear → ask, don't infer.
- If Bruno corrects, restate and wait again.
- Keep it concise — this is an alignment check, not a document.

---

## After approval — letter of the law

Once Bruno confirms, execute EXACTLY as confirmed. Every deviation is a violation:

- NO additions outside confirmed scope
- NO "improvements" that seemed helpful
- NO assumptions on anything ambiguous
- ANY doubt mid-execution → STOP and ask. Never improvise.
- Drift from confirmed plan → run [`upset`](/docs/dynamic-commands/upset) on yourself before continuing.

---

## Related

- [brainstorm](/docs/dynamic-commands/brainstorm) — read-only exploration before committing to an approach
- [code-safe](/docs/dynamic-commands/code-safe) — careful-analysis mode for the execution phase
- [upset](/docs/dynamic-commands/upset) — what to invoke if you drift from the confirmed plan
