---
title: Quanamo — read-docs
---

`quanamo-read-docs` loads Quanamo's documentation — functional specs, infra credentials, AI provider keys — to ground subsequent work. {% .lead %}

---

## Documentation locations

| Location | Purpose |
|---|---|
| `~/Herd/docs/quanamo/README.md` | Index — **read first** |
| `~/Herd/docs/quanamo/` | Functional specs, architecture, feature pages |
| `~/Herd/.credentials/quanamo/servers.json` | Odin server IP, hostname, SSH key, stack |
| `~/Herd/.credentials/quanamo/api-keys.json` | OpenAI + Gemini keys and model mapping |
| Per repo (`CLAUDE.md`, `CHANGELOG.md`) | Project-level context and history |

---

## Scopes

| Invocation | Behaviour |
|---|---|
| `/do quanamo-read-docs` | Full read — README → servers.json → api-keys.json → CLAUDE.md per repo |
| `/do quanamo-read-docs servers` | servers.json + Horizon config |
| `/do quanamo-read-docs deploy` | servers.json + `deploy.sh` files + `kanban.quanamo.test/deploy/README.md` + this library's `quanamo-deploy.md` + `quanamo-warmup.md` |
| `/do quanamo-read-docs <feature>` | Matching feature folder |

---

## App layout (always present)

| App | DB engine | DB name | Queue driver | Horizon? | Redis DB | Step dispatcher |
|---|---|---|---|---|---|---|
| admin.quanamo.com | PostgreSQL (master) | `quanamo` | redis | yes | 5 (queue), 6 (cache) | yes — driven by `schedule:run` from cron |
| feedz.quanamo.com | PostgreSQL (shared with admin) | `quanamo` | database | no | — | no |
| kanban.quanamo.com | MySQL (own) | `kanban_quanamo` | redis | yes | 7 (queue), 8 (cache) | yes — driven by `kanban-scheduler` supervisor program, gated by `storage/step-dispatcher/active.flag` |

When the scope touches kanban, the command also reads `~/Herd/kanban.quanamo.test/deploy/README.md` — it documents the kanban-only MySQL backup gate, Redis prefix, and `active.flag` operational rules.

---

## Hard rule

**README first, no exceptions.** Reading feature docs without the index = ungrounded claims.

---

## Related

- [Quanamo — update-docs](/docs/dynamic-commands/quanamo-update-docs) — writer counterpart
- [Quanamo — deploy](/docs/dynamic-commands/quanamo-deploy) — the deploy command this lookup informs
- [read-docs](/docs/dynamic-commands/read-docs) — generic version
