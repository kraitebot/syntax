---
title: Components catalog
---

Reference page listing every Markdoc component, callout style, and content pattern available on this site. Use this to look up "how do I draw X" when authoring a new chapter, without having to read the template's source. {% .lead %}

{% callout title="Why this page exists" %}
This site uses the Tailwind Plus Syntax template. The component palette is intentionally small and consistent. Rather than lose visibility into what's possible while customizing chapters, this page holds a working example of every primitive — a live cheat sheet.
{% /callout %}

---

## Lead paragraph

A leading paragraph rendered larger and lighter. Append `{% .lead %}` to any paragraph to opt in. Used at the top of every chapter for the one-line summary.

Plain paragraphs render at the default body size — like this one.

---

## Callouts

### Note (default)

{% callout title="Note callout" %}
Used for **decision rationale**, **clarifications**, and **inline caveats** that don't disrupt the flow. Light blue. Default style if `type` is omitted.
{% /callout %}

### Warning

{% callout type="warning" title="Warning callout" %}
Used for **invariants**, **incident-driven rules**, and **gotchas** that future-Bruno needs to spot at a glance. Amber. Set `type="warning"`.
{% /callout %}

---

## Code blocks

Single-language fenced blocks render with the template's syntax highlighting. Always show **input shape** or **math** — never pasted production code (that lives in the codebase, not in functional docs).

```php
target_price = breakEvenPrice * (1 + profit_percentage / 100);
```

```bash
php artisan horizon:terminate
```

```
for rung i in 0..N-1:
    prev *= multiplier[i]
    price = ref_price * (1 + (i+1) * gap_percent/100)
```

Inline code uses single backticks: `OrderObserver::updated()`, `status='active'`, `exchange_order_id`.

---

## Tables

Heavily used. Best primitive on this site for status-machine summaries, decision matrices, and step lists.

| Column header | Column header | Column header |
|---|---|---|
| Cell | Cell | Cell |
| Cell with `inline code` | Cell with **bold** | Cell content |

---

## Quick links grid

Used on the homepage only — top-level navigation tiles into the four lenses. Don't reuse inside chapter content; use a regular table or list instead. The available icons are `installation`, `presets`, `plugins`, `theming`, `lightbulb`, `warning`.

---

## Figure (image with caption)

Use the `figure` tag when an image needs a caption. Plain markdown image works for inline images without a caption.

Use the figure tag with `src`, `alt`, and `caption` attributes — for example, an image at `/diagrams/foo.png` with caption "Pivot data lifecycle". Plain markdown image syntax (`![alt](src)`) works for inline images without a caption.

---

## Headings hierarchy

Chapters use this convention:

- `#` — chapter title (set via frontmatter `title:`, never as `#` in body)
- `##` — phase / major section ("Open", "Sync", "Close", "Decision: ...")
- `###` — subsection inside a phase
- `####` — rarely used; reach for a callout or table instead

The right sidebar table-of-contents auto-generates from `##` and `###`.

---

## Cross-references between chapters

End every cross-lens chapter with a "See this from another angle" or "Cross-lens links" section. Always link to the **canonical** chapter for the deep version of a flow, never duplicate content. Pattern:

```
- **[Position lifecycle](/docs/lifecycles/position-lifecycle)** — full step-by-step flow
- **[Kraite host](/docs/servers/kraite)** — the server this runs on
```

---

## Patterns to use, patterns to avoid

| Use | Avoid |
|---|---|
| Tables for state machines and step lists | Long bulleted lists for ordered flows |
| Callouts for decisions and incidents | Inline bold for critical info |
| Pseudocode / formulas in fenced blocks | Pasting production code from the repo |
| Cross-links to canonical chapters | Duplicating the full lifecycle in every lens |
| Step class names in inline code | Class internals or method bodies |
| Backticked status values | Quoted prose status names |
