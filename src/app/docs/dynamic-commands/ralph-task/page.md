---
title: Ralph — task
---

`ralph-task` appends a task to `docs/next-ralph-tasks.md` for Ralph to pick up on its next deploy. {% .lead %}

---

## When to use

- Adding tasks for Ralph to execute autonomously
- Queueing work for overnight / background processing
- Building up a batch before [`ralph-deploy`](/docs/dynamic-commands/ralph-deploy) turns the queue into prd.json

---

## Flow

| Step | Action |
|---|---|
| 1. Append | Find next task number (1 if file empty/reset), add a new section with the task details |
| 2. Confirm | Show task number + title; remind Bruno to run `/do ralph-deploy` when ready |

---

## Task format

```markdown
---

## [N]. [Task Title]

**Priority:** [High/Medium/Low]

**Description:** [Clear description. Use "As a [role], I want [feature] so that [benefit]" when appropriate.]

**Implementation Notes:**
- [Specific implementation details]
- [Files to check or patterns to follow]
- [Edge cases to consider]

---
```

---

## Writing good tasks — required

- **Title:** short, action-oriented ("Add login validation", "Fix sidebar overflow"). Vague titles → rejected.
- **Description:** clear, concise, WHAT should be done. No WHY-essays, no HOW-implementation.
- **Implementation Notes (most critical):**
  - MUST be specific. Ralph runs autonomously — ambiguity = wrong output.
  - MUST include success AND failure scenarios when relevant.
  - MUST mention: files to check, patterns to follow, APIs to use.
  - MUST include edge cases + error handling expectations.
  - Vague notes ("make it work nicely") → task is useless, rewrite.

---

## Hard rule

This command ALWAYS appends. NEVER overwrites. Want a fresh queue? Run [`ralph-clean`](/docs/dynamic-commands/ralph-clean) first.

---

## Invocation

| Usage | Behaviour |
|---|---|
| `/do ralph-task <task description>` | Free-form task description; the command structures it |
| `/do ralph-task` | Interactive — describe in free-form, the command structures |

---

## Related

- [Ralph — deploy](/docs/dynamic-commands/ralph-deploy) — turns this queue into prd.json
- [Ralph — clean](/docs/dynamic-commands/ralph-clean) — wipe the queue before a new phase
- [Ralph — convert](/docs/dynamic-commands/ralph-convert) — alternative when starting from an existing PRD instead of free-form tasks
