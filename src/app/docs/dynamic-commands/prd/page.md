---
title: prd
---

`prd` generates a **Product Requirements Document** — clear, actionable, suitable for implementation (or Ralph autonomous execution). {% .lead %}

**Does NOT start implementing.** Just creates the PRD.

---

## Process

| Step | Action |
|---|---|
| 1. Feature description | With argument → use it as the initial description. No argument → ask Bruno |
| 2. Clarifying questions | 3-5 MAX (more = over-engineered) targeting: Problem/Goal, Core Functionality, Scope/Boundaries, Success Criteria. Skip what's already clear |
| 3. Generate PRD | Structured per the format below |
| 4. Derive name | `[feature-name]` kebab-case |
| 5. Save | `tasks/prd-[feature-name].md` |

---

## Question format (lettered options)

```
1. What is the primary goal of this feature?
   A. Improve user onboarding experience
   B. Increase user retention
   C. Reduce support burden
   D. Other: [please specify]

2. Who is the target user?
   A. New users only
   B. Existing users only
   C. All users
   D. Admin users only
```

Bruno can respond "1A, 2C, 3B" for quick iteration.

---

## PRD structure

1. **Introduction / Overview** — brief description + problem
2. **Goals** — bullet list, specific, measurable
3. **User Stories** — title + "As a [user], I want [feature] so that [benefit]" + verifiable acceptance criteria (always include "Typecheck passes")
4. **Functional Requirements** — numbered FR-1, FR-2, ...
5. **Non-Goals (out of scope)** — explicit
6. **Design Considerations** (optional) — UI/UX, mockups, components to reuse
7. **Technical Considerations** (optional) — constraints, dependencies, integration points, performance
8. **Success Metrics** — how success is measured
9. **Open Questions** — remaining clarifications

---

## Checklist — all required

- [ ] 3-5 clarifying questions asked with lettered options
- [ ] Bruno's answers incorporated (no assumptions filled in)
- [ ] Every user story is small, specific, independently testable
- [ ] Functional requirements numbered (FR-1, FR-2, ...) and unambiguous
- [ ] Non-goals section explicitly lists what's OUT of scope
- [ ] Success metrics measurable (not "better UX")
- [ ] Saved to `tasks/prd-[feature-name].md` with kebab-case name
- [ ] ZERO implementation code written

---

## Output location

`tasks/prd-[feature-name].md`

---

## Related

- [elicitate](/docs/dynamic-commands/elicitate) — fuller BA requirements session (no solutions, just requirements)
- [Ralph — convert](/docs/dynamic-commands/ralph-convert) — turn a PRD into prd.json user stories for autonomous execution
- [brainstorm](/docs/dynamic-commands/brainstorm) — explore approaches once the PRD is locked
