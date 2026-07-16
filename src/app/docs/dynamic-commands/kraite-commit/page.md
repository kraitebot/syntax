---
title: Kraite — commit
---

`kraite-commit` snapshots the current Kraite project to local git history — path packages first, then the main project. **Never pushes, never tags, never deploys.** Use [`kraite-push`](/docs/dynamic-commands/kraite-push) when ready to publish. {% .lead %}

---

## Core principle

The local codebase is always the correct one. Commit everything dirty — packages and main project. No review gates that block the commit. If it's dirty locally, snapshot it. Pushing is a separate explicit step.

---

## Flow

The command recurses into [`kraite-profile`](/docs/dynamic-commands/kraite-profile) first to decide whether path-package iteration applies (only the ingestion profile has them). The flow shape is the same across profiles — Step 1 is a no-op when no path packages are declared.

| Step | Action |
|---|---|
| 1. Detect path packages | Read `composer.json`, find every `"type": "path"` repository |
| 2. Commit packages first | For each dirty package, `git add -A && git commit` — no push |
| 3. Commit main project | Stage and commit everything dirty (including any `composer.lock` left untouched) |

`composer.lock` is **not** bumped here — only [`kraite-push`](/docs/dynamic-commands/kraite-push) runs `composer update` after pushing the package SHAs. Until that push, the lock file references the previous commit; that's correct for a local-only snapshot.

---

## Profile mapping

| Folder | Path packages? |
|---|---|
| `ingestion.kraite.test` | yes (kraitebot/core, brunocfalcao/step-dispatcher) — commit first |
| `admin.kraite.test` / `kraite.test` / `syntax.kraite.test` | none — skip the path-package phase |

---

## Hard rules

- **Never pushes.** That's [`kraite-push`](/docs/dynamic-commands/kraite-push)'s job.
- **Never tags.** That's [`kraite-tag`](/docs/dynamic-commands/kraite-tag)'s job.
- **Never deploys.** That's [`kraite-deploy`](/docs/dynamic-commands/kraite-deploy)'s job.
- **Never skips hooks** (`--no-verify`). Hook fails → fix root cause.
- **Commits all dirty files** — packages and main project. Working tree is CLEAN after the command returns.
- **No review gates** — local is authoritative for a snapshot.
- **Never auto-amends.** A failed commit means new commit on the fix, never amend.
- **Never commits files that likely contain secrets** (`.env`, credentials.json). Explicit warning if Bruno requests it.

---

## Related

- [Kraite — push](/docs/dynamic-commands/kraite-push) — what to run when ready to publish
- [Kraite — tag](/docs/dynamic-commands/kraite-tag) — release pipeline that supersedes this for full ships
- [commit](/docs/dynamic-commands/commit) — generic version with `[NEW FEATURE]` / `[BUG FIX]` changelog conventions
