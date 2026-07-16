---
title: Kraite — push
---

`kraite-push` commits and publishes the current Kraite project — path packages first (each pushed and `composer.lock` re-resolved), then the main project. **Never tags, never deploys.** {% .lead %}

---

## Flow

| Step | Action |
|---|---|
| 1. Profile detect | Recurse into [`kraite-profile`](/docs/dynamic-commands/kraite-profile) to decide whether path-package iteration applies |
| 2. Detect path packages | Read `composer.json` for `"type": "path"` repositories |
| 3. Push packages | For each dirty package: `add -A`, commit, `git push origin <branch>` |
| 4. Update lock | If any packages pushed, `composer update <vendor/package> ... --no-interaction` to capture new SHAs |
| 5. Push main project | Commit everything dirty (incl. updated `composer.lock`), push |

---

## Profile mapping

| Folder | Path packages? |
|---|---|
| `ingestion.kraite.test` | yes (kraitebot/core, brunocfalcao/step-dispatcher) — push first |
| `admin.kraite.test` / `kraite.test` / `syntax.kraite.test` | none — skip Step 2-4 |

---

## GitHub authentication

All `kraitebot/*` repos are public. The `gh` CLI is authenticated as `brunocfalcao`. No PAT switching needed in the normal path. If a remote uses SSH (`git@github.com:`), the git global config rewrites to HTTPS automatically.

---

## Hard rules

- **Never tags.** That's [`kraite-tag`](/docs/dynamic-commands/kraite-tag)'s job.
- **Never deploys.** That's [`kraite-deploy`](/docs/dynamic-commands/kraite-deploy)'s job.
- **Pushes every dirty file** — packages and main project. Working tree is CLEAN after the command returns.
- **Never force-pushes** without Bruno's explicit approval. Push rejected → `git pull --rebase origin <branch>`, then push again.
- **Co-author trailer mandatory** on every commit.

---

## Related

- [Kraite — commit](/docs/dynamic-commands/kraite-commit) — local-only sibling, no publish
- [Kraite — tag](/docs/dynamic-commands/kraite-tag) — when ready to ship a versioned release
- [push](/docs/dynamic-commands/push) — generic version (handles `gh auth switch` between multiple GitHub users + CHANGELOG bumps)
