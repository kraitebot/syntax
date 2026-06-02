---
title: refactor
---

`refactor` cleans up code that was 100% written by you. **Two modes** — rethink patterns first, or polish docs/style on a known target. Business logic is preserved strictly. {% .lead %}

---

## Mode pick

| Mode | When |
|---|---|
| **A — Rethink (global)** | No target given, or "refactor this module/feature". Patterns / structure / architecture / approach |
| **B — Polish (docs + style)** | Target given: file path, multiple files, folder |

Unclear → default to Mode A and ask Bruno what to polish after.

---

## Mode A — rethink

### Strict rules

1. Do NOT modify any code immediately
2. Do NOT show diffs
3. Do NOT show examples unless asked
4. First response = very short numbered bullet list (max 15 points)
5. Each bullet = one global refactor theme + what it improves
6. Extremely concise
7. End with: **"Tell me what module/file/feature you want refactored first."**

### Principles

- Assume full ownership of current design
- Use current best practices of the language/framework in this project
- Eliminate vibe-coding. Detect similar patterns across codebase, propose universal solutions
- Simplify aggressively: reduce branching, nesting, duplication, cognitive load
- Replace repeated query logic with centralised abstractions (local scopes, query objects, specifications, repositories)
- Too many conditionals → rethink design (polymorphism, strategy, state objects, mapping tables, pipelines)
- Make invariants explicit. Kill impossible states via typing, validation, guards
- Improve naming, boundaries, responsibilities. Smaller units, clearer intent
- Reduce side effects and hidden coupling
- Normalise error handling. Make failures observable
- Remove obvious perf issues (N+1, redundant work). No premature optimisation
- Increase testability via separation of concerns
- Enforce pattern consistency across codebase
- Composition over conditionals when appropriate
- Propose safe, incremental migration steps

Wait for Bruno's instruction before touching code.

---

## Mode B — polish (docs + style)

### Phase 1 — context

Read the file(s). Understand purpose, relationships, business logic before any change.

### Phase 2 — apply

**Class documentation:** PHPDoc — one-line description, 2-3 sentences on purpose/usage, `@see` for related classes.

**Method documentation:** Document the "why" for complex logic, not the "what" for obvious code. Use `@param`, `@return`, `@throws`. Never PHPDoc that only repeats type hints.

**Mandatory style rules:**

| Rule | Detail |
|---|---|
| No FQNs in code body | Add `use` statements instead |
| No `fn()` arrow functions | Full `function` syntax |
| No nested ternaries | `if/elseif/else` or `match` |
| No raw bcmath functions | If project has Math helper, use it |
| No `===` or float casting for financial/numerical | Float casting corrupts decimal precision |
| No `(float)` casting on financial values | Keep as strings, use Math helpers |
| Prefer readability over brevity | Extract complex expressions to named variables |

### Critical constraints

**NEVER:** add validation, conditional checks, data filters, change return values, modify control flow, touch files not in scope.

Business logic that seems wrong → **note it, do not fix it**.

### Phase 3 — post-polish

Apply the simplify skill, then `vendor/bin/pint --dirty`.

---

## Related

- [commit](/docs/dynamic-commands/commit) — runs refactor (Mode B) as Step 0
- [push](/docs/dynamic-commands/push) — same Step 0 gate
- [code-safe](/docs/dynamic-commands/code-safe) — analysis-first mode for the rethink output
- [pest](/docs/dynamic-commands/pest) — verify business logic is preserved after Mode B
