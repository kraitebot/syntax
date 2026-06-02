---
title: Kraite — read-docs
---

`kraite-read-docs` loads Kraite's documentation surfaces — functional specs, infra credentials, deploy notes, and project context — so Claude has grounded knowledge before doing real work. {% .lead %}

The command is meaningful primarily from the `ingestion` profile (the docs in `~/Herd/docs/kraite/` describe the trading system). From web-project profiles it still works, but prefixes its response with a "context is ingestion-flavoured" note so Bruno isn't surprised.

---

## Documentation locations

Kraite docs span three locations:

| Location | Purpose |
|---|---|
| `~/Herd/docs/kraite/` | Functional docs — system overview, features, admin / console specs |
| `~/Herd/.credentials/kraite/` | Infrastructure: `servers.json`, `deploy-notes.md` (56+ lessons), `hardening.json`, `credentials` (PATs) |
| Per repo (`CLAUDE.md`, `WhereAreWe.md`, `CHANGELOG.md`) | Project-level context and current state |

---

## Scopes (via free-form modifier)

| Invocation | Behaviour |
|---|---|
| `/do kraite-read-docs` | Read the full set — README → architecture → servers.json → deploy lessons → features as needed |
| `/do kraite-read-docs servers` | Server config + credentials + deploy lessons + Horizon queue distribution |
| `/do kraite-read-docs deploy` | Deploy notes + `deploy.sh` + the `kraite-deploy.md` / `kraite-warmup.md` library bodies + server-prep runbook |
| `/do kraite-read-docs <feature>` | Read `02-features/<feature>/` |
| `/do kraite-read-docs incidents` | Search deploy notes for "CRITICAL", "incident", "$13 loss" |

---

## Hard rules

- **README first, no exceptions.** Reading feature docs without the index = ungrounded claims.
- **Cite the doc file** when capturing business rules or architecture decisions.
- **Use Kraite terms verbatim** — don't paraphrase domain vocabulary.
- **Always present the server quick-reference** when the scope touches infra.

---

## Server quick-reference

| Hostname | IP | Role |
|---|---|---|
| hyperion | 135.181.93.226 | Database (MySQL) + Redis |
| athena | 37.27.243.164 | Ingestion |
| pheme | 62.238.38.113 | Web (admin, console, kraite.com, syntax) |
| eos / iris / nyx / hemera | 204.168.137.153 / .138.83 / .129.189 / 77.42.68.254 | Workers — positions / orders / priority (interchangeable consumers) |
| tyche | 204.168.135.246 | Worker — indicators + cronjobs |

SSH: `ssh -i ~/.ssh/id_ed25519_kraite root@<IP>`. All project commands as `su - <hostname> -c '...'` (user matches hostname).

---

## Related

- [Kraite — update-docs](/docs/dynamic-commands/kraite-update-docs) — the writer counterpart of this reader command
- [Kraite — health](/docs/dynamic-commands/kraite-health) — runtime probe of the same fleet read-docs describes statically
- [read-docs](/docs/dynamic-commands/read-docs) — generic version (project-agnostic, looks up `~/Herd/docs/<project>/`)
