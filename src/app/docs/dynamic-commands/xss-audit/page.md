---
title: xss-audit
---

`xss-audit` is a **systematic security audit** for Laravel applications — walks 11 sections covering authentication, sessions, input validation, rate limiting, authorisation, email enumeration, XSS, CSRF, security headers, orphaned attack surface, and sensitive data exposure. Originally written for the Market Study app; the section list is the general template. {% .lead %}

Default = full audit. Optional argument scopes to one section (e.g. "auth", "xss", "csrf").

---

## Phase 1 — context loading (mandatory)

Before auditing ANY code:

1. Read CLAUDE.md
2. Confirm Laravel version, packages, models (application-info)
3. Check current table structure (database-schema)
4. Read `routes/web.php` — map the full attack surface
5. Read `bootstrap/app.php` — middleware configuration

---

## Phase 2 — sections

| Section | Topic |
|---|---|
| **SEC-01** | Authentication & magic links (token hashing, rate limits, enumeration consistency, plaintext-link logging, signed-URL middleware, single-use tokens) |
| **SEC-02** | Session security (session regeneration on login, invalidation on logout, secure / http_only / same_site cookie config) |
| **SEC-03** | Input validation & max lengths (per-field `max:5000`, never just `required|array`) |
| **SEC-04** | Rate limiting & throttling (`throttle:5,1` on login, `throttle:3,1` on wizard store, `throttle:10,1` on AI endpoints) |
| **SEC-05** | Authorisation & IDOR prevention (scope to `Auth::id()`, `abort_unless($model->user_id === Auth::id(), 403)`) |
| **SEC-06** | Email enumeration (consistent responses for known vs unknown emails) |
| **SEC-07** | XSS prevention (escape `{!! Str::markdown($content) !!}` or run through `clean()`; verify `{!! !!}` only on safe / hardcoded data) |
| **SEC-08** | CSRF protection (`@csrf` in all forms, `X-CSRF-TOKEN` in JS fetch, CSRF meta tag in layouts) |
| **SEC-09** | Security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS, Permissions-Policy) |
| **SEC-10** | Orphaned / unused attack surface (delete unused views with form actions; audit any upload handler for MIME-by-magic-bytes, size limits, allowed-types whitelist, path-traversal prevention) |
| **SEC-11** | Sensitive data exposure (magic-link URL in logs, study data in API responses, payment webhook signature validation, API keys / session tokens never exposed) |

---

## Phase 3 — audit report

```
## Security Audit Report — [date]

### Critical (fix immediately)
- [Exploitable now]

### High (fix soon)
- [Security weaknesses]

### Medium (fix in next sprint)
- [Defence-in-depth]

### Low / Informational
- [Best practices, minor]

### Already Secure
- [Verified correctly implemented]

### Recommendations Summary
- [Ordered list of what to fix and how]
```

---

## Phase 4 — fix mode (only when instructed)

When Bruno says "fix it" or "apply fixes":

1. Create a task list with all items to fix
2. Fix one section at a time
3. After each fix, verify it doesn't break existing tests
4. Run test suite after all fixes
5. Report what was changed

---

## Hard rules

- **Never add business logic** — audit only, not feature work. Violation = revert immediately
- **Never change application behaviour** — only security hardening. If hardening changes behaviour (new rate limit blocks traffic), STOP and present the trade-off before applying
- **Must ASK before any UX-affecting fix** — rate limits, blocked emails, redirect changes
- **Must document every finding** with: what's wrong, why it matters (impact), exploitation path, fix. Missing any → incomplete
- **Never mark an item "safe" without reading the actual code.** "Expected: done" annotations MUST be verified against current code, not trusted

---

## Related

- [code-review](/docs/dynamic-commands/code-review) — challenges a reviewer's findings (security or otherwise)
- [troubleshoot](/docs/dynamic-commands/troubleshoot) — for diagnosing a specific reported vulnerability
- [fix](/docs/dynamic-commands/fix) — disciplined fix flow for the audit's findings
