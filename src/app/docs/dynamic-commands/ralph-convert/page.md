---
title: Ralph — convert
---

`ralph-convert` transforms an existing PRD into the `prd.json` format Ralph uses for autonomous execution — splitting it into independently-completable user stories with verifiable acceptance criteria. {% .lead %}

---

## The number-one rule

**Each story must be completable in ONE Ralph iteration (one context window).** Ralph spawns a fresh Claude instance per iteration with no memory of previous work. If a story is too big, it produces broken code.

| Right-sized | Too big — split |
|---|---|
| Add a database column and migration | "Build the entire dashboard" |
| Add a UI component to an existing page | "Add authentication" |
| Update a server action with new logic | "Build the user notification system" |
| Add a filter dropdown to a list | |

**Rule of thumb:** if the change can't be described in 2-3 sentences, it's too big.

---

## Story ordering — dependencies first

Stories execute in priority order. Earlier stories must not depend on later ones.

Correct order:

1. Schema / database changes (migrations)
2. Server actions / backend logic
3. UI components that use the backend
4. Dashboard / summary views

---

## Acceptance criteria — must be verifiable

| Good | Bad |
|---|---|
| "Add `status` column to tasks table with default 'pending'" | "Works correctly" |
| "Filter dropdown has options: All, Active, Completed" | "User can do X easily" |
| "Clicking delete shows confirmation dialog" | "Good UX" |
| "Typecheck passes" | |

**Always include `"Typecheck passes"`.** For UI stories add `"Verify in browser using dev-browser skill"`.

---

## Output shape

```json
{
  "project": "[Project Name]",
  "branchName": "ralph/[feature-name-kebab-case]",
  "description": "[Feature description]",
  "userStories": [
    {
      "id": "US-001",
      "title": "[Story title]",
      "description": "As a [user], I want [feature] so that [benefit]",
      "acceptanceCriteria": ["...", "Typecheck passes"],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

---

## Conversion rules

1. Each user story → one JSON entry
2. IDs sequential (`US-001`, `US-002`, …)
3. Priority by dependency order
4. All stories start `passes: false`, empty `notes`
5. `branchName` kebab-case, prefixed `ralph/`
6. Always add "Typecheck passes" to every story

---

## Archiving on different feature

Before writing new `prd.json`, check if the current one has a different `branchName` AND `progress.txt` has content. If both → archive to `archive/YYYY-MM-DD-feature-name/`, then reset `progress.txt`.

---

## Output location

`scripts/ralph/prd.json`

---

## Related

- [Ralph — deploy](/docs/dynamic-commands/ralph-deploy) — runs prd.json
- [Ralph — task](/docs/dynamic-commands/ralph-task) — queues raw tasks; convert turns those into stories
- [prd](/docs/dynamic-commands/prd) — generic PRD generator (cross-project)
