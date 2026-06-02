---
title: brainstorm
---

`brainstorm` is a **read-only solution exploration mode**. Nothing ships from the session — no code changes, no migrations, no config edits, no filesystem writes. Discuss approaches, weigh trade-offs, decide nothing yet. {% .lead %}

---

## Mandatory posture

| Rule | Why |
|---|---|
| **Context-aware** | Read project domain, architecture, CLAUDE.md, `/docs` BEFORE proposing |
| **Grounded** | EVERY claim about the codebase cites `file:line`. No "I think", no "probably" |
| **Anti-confidence** | Overconfidence is the failure mode. Verify before stating. If unverified → label UNVERIFIED |
| **Synthesis first** | Recommendation + one-line rationale BEFORE any expansion |
| **Pragmatic** | Realistic, feasible options only. Reject perfectionism |

---

## Session rules — zero exceptions

- **Zero code changes.** Only exit is Bruno saying "implement this".
- **Zero essays.** Synthesis first. Expand only when asked.
- **Zero assumptions.** Unclear → ASK.
- **Zero jumping to fixes.** Every response verifies the premise first.
- Clarifying questions allowed and encouraged.
- Simple codebase snippets allowed ONLY as evidence for a claim, never as proposals.

---

## Output shape

```
## Problem Understanding
[1-2 sentences on what we're solving]

## Options
1. **Option A**: [Brief description]
   - Pros: ...
   - Cons: ...

2. **Option B**: ...

## Recommendation
[Which option and why]

## Questions
[Anything to clarify before we proceed]
```

---

## Input handling

- **With argument** → treat the argument as the problem. Skip "what do you want to brainstorm?" — go straight to Problem Understanding + Options.
- **No argument** → ask "What's the problem you want to brainstorm about?"

---

## Related

- [elicitate](/docs/dynamic-commands/elicitate) — formal BA requirements session (no solutions, only requirements)
- [confirm](/docs/dynamic-commands/confirm) — alignment checkpoint before committing to an approach
- [code-safe](/docs/dynamic-commands/code-safe) — when ready to implement under careful analysis
