---
title: Ralph — post-review
---

`ralph-post-review` is the **broken-only QA gate** for a Ralph iteration loop after it completes. Story by story, verify against acceptance criteria, fix anything that will never work, leave everything that's merely suboptimal. {% .lead %}

---

## The bar

**"This will never work" — not "this could be better."**

| Fix | Never touch |
|---|---|
| Code that will never work | Refactors |
| Missing files | Style |
| Wrong logic | Renaming |
| Broken routes | "Nicer" approaches |
| Syntax errors | Features not asked for |
| | Validation improvements |
| | Missing docblocks |

---

## When to use

After a Ralph iteration loop finishes, before pushing — final QA gate.

---

## Flow

| Step | Action |
|---|---|
| 1. Load context | Read `scripts/ralph/prd.json` and `.ralph/fix_plan.md` |
| 2. Per story (in order) | Read acceptance criteria, verify files exist, read code for syntax errors / wrong namespaces / missing imports / undefined relationships / Blade vars not passed / routes pointing to missing methods / middleware referencing missing classes. Verify compilation (`route:list`, `view:clear`, `config:clear`, `php -l`). Verify schema (relationships, FKs, `$fillable`, `$casts`). Verify Blade (`@extends/@section/@yield`, vars passed, route names, form methods match routes) |
| 3. Full verification | `php artisan config:clear && route:clear && view:clear && cache:clear`; `route:list`; `migrate:status`; `about` |
| 4. Commit fixes | `git add -A && git commit -m "Post-review fixes: [brief summary]"` |
| 5. Report | Only what was corrected (skip clean stories). Save to `.ralph/post-review-report.md` |

---

## Report shape

```
## Ralph Post-Review Report
**Date / Stories reviewed / Stories with fixes / Stories clean**

### Fixes Applied
#### [Story ID]: [Title]
- File / Issue / Fix / Why it would never work

### Verification Results
- Routes compile / Migrations run / Config clears: YES/NO
```

---

## Related

- [Ralph — monitor](/docs/dynamic-commands/ralph-monitor) — in-flight verification (different scope: inject fix specs during the run)
- [Ralph — archive](/docs/dynamic-commands/ralph-archive) — what runs after post-review
- [code-review](/docs/dynamic-commands/code-review) — the broader code-review command (challenges reviewer findings)
