---
title: code-safe
---

`code-safe` enforces careful, step-by-step analysis before any code changes — for critical paths, uncertain changes, or complex refactoring. {% .lead %}

---

## Core principles — non-negotiable

### 1. Understand first, code later

- Analyse until you fully understand. No partial understanding proceeds.
- Never assume. Verify with code reads.
- Unclear → STOP and ask. Don't guess.

### 2. Mandatory pre-coding analysis — all three blocks

| Block | Content |
|---|---|
| **What you understood** | Problem restated in your own words + why this needs fixing (with evidence) |
| **Where the issue is** | EXACT file(s) and line(s) — no vague references. What is currently wrong/missing (cite code) |
| **How you propose to correct it** | Solution approach + BEFORE/AFTER code blocks (concrete, not pseudocode) + WHY this is correct |

### 3. Explicit permission — zero tolerance

- Writing code without "go ahead" / "implement it" = violation
- Change ONLY the parts approved. Nothing adjacent. Nothing "while I'm here"
- Additional issues found mid-work → STOP, present new analysis, wait for new permission

### 4. No business logic assumptions — hard ban

- Never add business rules based on guesses
- Never add conditional logic without explicit approval
- "Probably needs a check" → STOP. Ask Bruno.

### 5. Scope control — hard ban

- Approved scope is the **ceiling**, not the floor
- Discover related issue → STOP. Don't "fix while here". Report and wait.

---

## Workflow

`User request → analysis → present findings → Q&A → agreement → authorization → implementation → summary`

---

## Discovery mid-implementation — hard stop

Additional issue discovered mid-work triggers MANDATORY HALT:

- STOP at that exact point. Don't finish the "current" edit
- NEVER "fix while you're there". That's the failure this mode exists to prevent
- Report findings. Wait for new authorization. New issue = new analysis cycle

---

## One change at a time

- Complete one change fully before proposing the next
- Each change has its own analysis → permission → implementation cycle

---

## Input handling

- **With argument** → Code-Safe applies ONLY to those files. Read them first, then wait for task description.
- **No argument** → Code-Safe is global for the session until released.

---

## Related

- [brainstorm](/docs/dynamic-commands/brainstorm) — even safer, no code at all, just exploration
- [fix](/docs/dynamic-commands/fix) — disciplined fix flow with dependency mapping (similar gates)
- [confirm](/docs/dynamic-commands/confirm) — verbal alignment without any tool calls at all
