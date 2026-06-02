---
title: Ralph — deploy
---

`ralph-deploy` transforms the pending tasks in `docs/next-ralph-tasks.md` into a fresh `scripts/ralph/prd.json` for Ralph to execute autonomously. {% .lead %}

---

## When to use

- Ready to start Ralph with queued tasks
- Converting a batch of [`ralph-task`](/docs/dynamic-commands/ralph-task) entries into user stories
- Deploying a phase of work for overnight execution

---

## Flow

| Step | Action |
|---|---|
| 1. Ensure structure | Create `scripts/ralph/` (with `CLAUDE.md`, `archive/`, `prd.json.example`, `progress.txt`, `ralph.sh`) if missing |
| 2. Archive current PRD | If `prd.json` has stories `passes: true`, move to `scripts/ralph/archive/YYYY-MM-DD-{project}/` |
| 3. Read pending tasks | Parse `docs/next-ralph-tasks.md` — extract title, priority, description, implementation notes |
| 4. Generate fresh prd.json | One user story per task, dependency-ordered, with "Typecheck passes" criterion on every story |
| 5. Reset progress.txt | Keep `## Codebase Patterns` section, reset the rest |
| 6. Clear processed tasks | Remove deployed tasks from `next-ralph-tasks.md` |
| 7. Confirm | Show story count + run command |

---

## PRD shape

```json
{
  "project": "{ProjectName} Phase X",
  "branchName": "master",
  "description": "Brief description",
  "ralphInstructions": "...",
  "userStories": [
    {
      "id": "PX-US-001",
      "title": "...",
      "description": "As a [user], I want [feature] so that [benefit]",
      "acceptanceCriteria": ["...", "Typecheck passes"],
      "priority": 1,
      "passes": false,
      "notes": "Implementation notes",
      "isFirstStory": true,
      "isLastStory": false
    }
  ]
}
```

---

## Modifiers

| Modifier | Effect |
|---|---|
| `--phase N` | Set specific phase number |
| `--keep-tasks` | Don't clear tasks from `next-ralph-tasks.md` after deploy |
| `--dry-run` | Show what would be deployed without writing |

---

## Story-completion bookkeeping

- **Every story:** update `docs/ralph/completed-tasks.md`
- **First story:** create/overwrite completed-tasks.md with fresh header
- **Last story:** also clean `docs/next-ralph-tasks.md`

---

## Run command (after deploy)

```bash
./scripts/ralph/ralph.sh --tool claude {N}
```

---

## Related

- [Ralph — task](/docs/dynamic-commands/ralph-task) — adds tasks to the queue this command drains
- [Ralph — convert](/docs/dynamic-commands/ralph-convert) — turns a free-form PRD into the same prd.json shape
- [Ralph — prepare](/docs/dynamic-commands/ralph-prepare) — Supervisor setup so the run survives reboots
- [Ralph — monitor](/docs/dynamic-commands/ralph-monitor) — QA the run while it executes
