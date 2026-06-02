---
title: pest
---

`pest` writes adversarial Pest tests — tests **hard to pass** that catch real bugs, not happy-path-only tests that pass even when code is broken. {% .lead %}

---

## The golden question

Before writing ANY test: **"If there are bugs in this code, will these tests catch them? Or will they pass anyway, giving false confidence?"**

A test that passes when the code is broken is **worse than no test at all**.

---

## Core principles

1. **Simulate reality** — mirror real-world usage
2. **Be adversarial** — write tests HARD to pass
3. **Hunt edge cases** — bugs that hurt most are in edge cases
4. **Verify specific records** — query by unique identifiers, NEVER `Model::count()` on shared tables
5. **Distrust everything** — verify actual values, not just that "something happened"

---

## Adversarial rules — mandatory

| Rule | Detail |
|---|---|
| **Exact values** | `toBe(50000.0)`. `not->toBeNull()` as primary assertion = BANNED |
| **Before AND after** | Assert state on BOTH sides of the action. Single-side = incomplete |
| **Test the negative** | Verify records that SHOULDN'T change are untouched |
| **Edge cases required** | Empty inputs, single item, boundary values, duplicates, nulls. Missing = incomplete |
| **Unique test data** | Per-test token prefix on every factory call. Global counts (`Model::count()`) on shared tables = BANNED |

---

## Data isolation — critical

Always query ONLY the records your test created — use specific identifiers, not global counts or `::first()`. Never use `Model::count()` unless the test owns ALL records in the table.

---

## Test structure

Check `tests/Pest.php` first — it typically handles `RefreshDatabase`, HTTP fakes, time freezing, `Once::flush()`. Don't duplicate setup that's already there.

---

## Test naming

Describe specific behaviour:

```php
test('does not duplicate candles on re-run with same timestamps')
```

Not:

```php
test('works correctly')
```

---

## Quick commands

```bash
php artisan test $ARGUMENTS
php artisan test --filter="does not duplicate"
php artisan test --parallel --processes=4
vendor/bin/pint --dirty
```

---

## Quality checklist — every box required

- [ ] Isolation: queries scoped by specific identifiers, zero global counts on shared tables
- [ ] Adversarial: exact values asserted, not existence
- [ ] Edge cases: empty, single, boundaries, nulls all tested
- [ ] Before/After: state asserted on BOTH sides
- [ ] Negative tests: wrong records verified untouched
- [ ] Unique tokens: every factory call prefixed
- [ ] Descriptive names: test name describes specific behaviour

After creating tests, report: file path, list of tests with what each verifies, run command. **No "done" claim without running the test and showing it passes.**

---

## Input handling

- **With argument** (file path / folder / feature / class) → write/extend tests for that target. Read first, identify behaviours, then test.
- **No argument** → ask Bruno. Don't guess from recent edits.

---

## Related

- [fix](/docs/dynamic-commands/fix) — pest is Step 1 of the disciplined fix flow
- [troubleshoot](/docs/dynamic-commands/troubleshoot) — Phase 3 writes the failing test using pest patterns
- [refactor](/docs/dynamic-commands/refactor) — Mode B finishes with `vendor/bin/pint --dirty`
