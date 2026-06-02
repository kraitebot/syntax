---
title: Kraite — reboot
---

`kraite-reboot` cleanly reboots a single Kraite fleet server in the safest order for its role. It is **destructive by nature** — disconnects users, drains queues, and (for ingestion / database) pauses real-money trading. Every host has its own cool-down + warm-up shape because each host runs different workload. {% .lead %}

---

## Invocation

```
/do kraite-reboot <hostname>       # reboot one specific server
/do kraite-reboot                  # sweep mode — every server needing a reboot
```

Valid hostnames: `athena`, `pheme`, `eos`, `iris`, `nyx`, `hemera`, `tyche`, `hyperion`. Unknown hostname → STOP with the valid list.

**Per-invocation approval.** A "yes" applies to that one host only. Rebooting another host in the same session re-asks. The session-wide "yes" from sweep mode does NOT bypass per-host approvals.

---

## Universal phase shape

Every host follows the same five phases. Only Phase 2 and Phase 6 differ per role.

| Phase | Action |
|---|---|
| 1. Pre-flight | Confirm hostname maps to a known host; confirm Bruno's intent for THIS host |
| 2. Cool down (role-specific) | Drain queues, pause dispatchers, put apps in maintenance, terminate Horizon |
| 3. Reboot | `ssh root@<host> 'systemctl reboot' \|\| true`. SSH disconnect is success, not failure |
| 4. Wait for SSH | **Async via scheduled task** — never `sleep`-poll, never `ssh -o ConnectTimeout=600`. Probe every 30s for up to 10 minutes |
| 5. Health check | Recurse into [`kraite-health`](/docs/dynamic-commands/kraite-health) for the host's scope |
| 6. Warm up (role-specific) | Resume dispatchers, `artisan up`, supervisor restarts to spawn fresh workers |
| 7. Report | One concise summary |

---

## Per-role blast radius

| Host | Blast radius | Key risk |
|---|---|---|
| **athena** | Whole trading loop pauses. No step advances anywhere. **User-data WS events from every exchange are LOST during the window — exchanges do NOT replay on listenKey reconnect.** TP fills, SL fills, partials, cancels, balance changes during the reboot are invisible to ingestion. | Local DB view of positions/orders may diverge from exchange. MANDATORY REST reconcile in Phase 6 |
| **pheme** | 4 public sites 5xx through Cloudflare for ~60s | Zero trading impact |
| **workers** (eos / iris / nyx / hemera / tyche) | Fleet drops to 2-of-3 capacity per queue while one is down | Other workers absorb the load |
| **hyperion** | **Highest in the fleet.** Every app disconnects, every queue stops consuming. | Every consumer must be cooled before, warmed after |

---

## Athena: the lost-events problem

{% callout type="warning" title="User-data WS events are lost during the reboot window" %}
Binance / Bitget / KuCoin / Bybit do NOT replay user-data events on listenKey reconnect. Any TP fill, SL fill, partial, cancel, or balance change that happens between cooldown and warmup is invisible to ingestion until a REST reconcile catches up.

Phase 6 on athena therefore runs `kraite:cron-sync-positions` + `kraite:cron-sync-orders` immediately after `kraite:warmup`, then sanity-checks that REST-reported open-positions per account match `positions WHERE status IN ("opened","new","active")`. Any divergence → STOP, flag the account IDs to Bruno before letting the dispatcher run any close / cancel / place workflow.

Without this reconcile, a TP fill that happened during the reboot leaves the local row marked `opened` while the exchange has closed it. The next sweep cycle would manage a position the exchange no longer holds — at best a no-op API error, at worst a duplicate close attempt or misplaced re-entry.
{% /callout %}

---

## Hyperion: the consumer-side cooldown

Hyperion has no Laravel project — only MySQL and Redis. The cool-down work happens on every **consumer** before hyperion is touched:

1. Ingestion fleet (athena + 5 workers) full cooldown in parallel
2. Pheme web apps (admin / console / kraite.com) `php artisan down --retry=60`

Phase 4 on hyperion ALSO probes MySQL TCP (3306) and Redis TCP (6379) accepting connections — not just SSH — before declaring hyperion back. The server can SSH-in before mysqld or Redis has finished initialising.

Phase 6 brings consumers back in reverse dependency order: pheme web apps first (operator sees site up before trading is fully restored), then athena's `kraite:warmup`, then the 5 workers in parallel.

---

## Sweep mode

`/do kraite-reboot` with no argument probes `/var/run/reboot-required` on every fleet host, builds a TODO list, and walks them **sequentially** in the safest order: workers → pheme → athena → hyperion. Lowest blast radius first; highest last.

Between hosts, the command waits for the current host's Phase 6 + report to complete before starting the next. If any host fails to come back within its 10-minute SSH timeout, the sweep STOPS entirely — the failing host is the priority. If Bruno declines a per-host approval, that host is skipped but the sweep continues.

---

## Hard rules

- **Per-invocation approval.** Per-host re-ask within a sweep.
- **Cool down first, always.** No reboot without first quiescing the workload.
- **Never sleep-poll.** Scheduled-task affordance for Phase 4.
- **SSH disconnect on reboot is success.** Wrap the reboot SSH in `|| true`.
- **kraite-reboot is not kraite-deploy.** No tag, no migrations, no composer. Just power-cycle and restore.
- **Never `kill -9` mysqld / supervisord during cooldown.** Let graceful paths run.
- **If SSH never comes back within 10 minutes**, STOP. Escalate to Bruno — host may have failed to boot.

---

## Related

- [Kraite — health](/docs/dynamic-commands/kraite-health) — Phase 5 entry point
- [Kraite — warmup](/docs/dynamic-commands/kraite-warmup) — Phase 6 entry point for ingestion-class hosts
- [Kraite — server-upgrade](/docs/dynamic-commands/kraite-server-upgrade) — auto-reboots inline when `/var/run/reboot-required` fires
- [Athena (ingestion)](/docs/servers/athena) — the box with the worst reboot blast radius
- [Hyperion (database + Redis)](/docs/servers/hyperion) — the box with the highest one
