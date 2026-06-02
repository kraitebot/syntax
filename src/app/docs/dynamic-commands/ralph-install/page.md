---
title: Ralph — install
---

`ralph-install` initialises Ralph in a new project — installs the global CLI if needed and creates the project-specific structure. {% .lead %}

---

## When to use

- Setting up Ralph in a new project
- Initialising Ralph infrastructure on a fresh VPS
- First-time setup

---

## Flow

| Step | Action |
|---|---|
| 1. Global CLI check | `ralph --help` → if missing, clone `https://github.com/frankbria/ralph-claude-code.git` to `~/ralph-claude-code` and run `./install.sh` |
| 2. Project structure | `mkdir -p scripts/ralph/archive` |
| 3. Copy templates | `ralph.sh`, `CLAUDE.md`, `prd.json.example` from the eduka reference (working implementation) |
| 4. Initialise progress.txt | Stamped header with start date |
| 5. Iteration log dir | `docs/00-ralph/iteration-log.md` |
| 6. Task queue file | `docs/next-ralph-tasks.md` if missing |
| 7. Clean old structure | If pre-existing `.ralph/` folder from `frankbria` setup — **STOP, ask Bruno first** before removing |

---

## Resulting layout

```
scripts/ralph/
├── CLAUDE.md         ← Instructions for Ralph
├── archive/          ← Completed PRDs
├── prd.json.example  ← Template reference
├── progress.txt      ← Progress log
└── ralph.sh          ← Run script

docs/
├── 00-ralph/
│   └── iteration-log.md  ← Iteration tracking
└── next-ralph-tasks.md   ← Task queue
```

---

## Modifiers

| Modifier | Effect |
|---|---|
| `--skip-global` | Skip the global CLI installation check |
| `--force` | Overwrite existing `scripts/ralph/` folder |

---

## Next steps after install

1. Add tasks with [`ralph-task`](/docs/dynamic-commands/ralph-task)
2. Deploy with [`ralph-deploy`](/docs/dynamic-commands/ralph-deploy)
3. Run: `./scripts/ralph/ralph.sh --tool claude {N}`

---

## Related

- [Ralph — task](/docs/dynamic-commands/ralph-task) — populate the task queue
- [Ralph — deploy](/docs/dynamic-commands/ralph-deploy) — turn tasks into prd.json
- [Ralph — prepare](/docs/dynamic-commands/ralph-prepare) — Supervisor config for VPS-persistent runs
