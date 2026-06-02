---
title: learn
---

`learn` builds understanding of a codebase area through investigation. **Show reasoning, not snippets.** Brevity wins — default output is `Learned.` plus unresolved items. {% .lead %}

---

## Core rules — absolute

1. **Never assume.** Every statement is backed by a file read this session.
2. **Show correlation, not snippets.** Code dumps banned.
3. **Conclude from evidence only.** "Based on the name", "typically", "this would" → banned.
4. **Brevity wins.** Default output = `Learned.` + unresolved (if any). Anything more requires Bruno asking.

---

## Banned phrases (response rejected)

- "This probably..."
- "This likely..."
- "Based on the name..."
- "Typically this would..."
- "It seems..."
- "I believe..."

---

## Fact-check first — mandatory gate

Before any statement: read it → state it with `file:line` citation. Not read → read first. Can't find → explicitly say "cannot find" — never fill the gap with a guess.

---

## How to learn

| Step | Action |
|---|---|
| 1. Resolve scope | If argument set → that area only. If empty → ask Bruno (don't scan blindly) |
| 2. Read entry file(s) | For the scope |
| 3. Read dependencies | What the entry file depends on |
| 4. Correlate | How they work together |
| 5. Conclude | With reasoning from evidence |

---

## Show your reasoning — examples

**Wrong:**

> OrderService has a create() method that accepts an array.

**Right:**

> OrderService receives OrderRepository in its constructor. The create() method calls the repository's save() method, meaning OrderService delegates persistence — it doesn't handle database operations directly.

**Wrong (overcomplicated):**

> The OrderController is a Laravel controller that extends the base Controller class and uses dependency injection to receive the OrderService in its constructor, which is then stored in a private property for later use in the various action methods.

**Right (pragmatic):**

> OrderController depends on OrderService. All order operations go through that service.

---

## Output formats

**Default (unless Bruno explicitly asks for details):**

```
Learned.
```

If there are unresolved items, **immediately investigate them** — read more files, run commands, check configs — until resolved. Only output `Learned.` once everything is resolved. If something truly cannot be resolved:

```
Learned.

## Unresolved
- [Only items that genuinely cannot be verified from the codebase]
```

**Detailed format (only on Bruno's explicit request):**

```
## What I Read
[List files]

## How It Connects
[Your correlation]

## Conclusions
[What you determined and why]

## Unresolved
[What you couldn't confirm — be honest]
```

Each section 2-4 bullets. Explain conclusions only with direct evidence.

---

## Related

- [explain](/docs/dynamic-commands/explain) — sibling for explaining how something works (onion-peel)
- [read-docs](/docs/dynamic-commands/read-docs) — read the project's own documentation
- [troubleshoot](/docs/dynamic-commands/troubleshoot) — investigation for an actual bug, not curiosity
