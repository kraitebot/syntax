---
title: Notifications
---

Operator alerts and trader messages pass through the same delivery machinery.
The **Throttler** suppresses repeats, while the optional **Threshold** can
require recurrence before an operator alert is delivered. Together they keep
Kraite quiet on noise without losing required trader communication. {% .lead %}

This is the **subsystem lens** — the delivery machinery. For the per-canonical recipient mapping and channel coverage, that inventory lives in the raw spec; this chapter covers how an occurrence becomes (or doesn't become) a delivered alert.

---

## The two gates, in order

Every notification occurrence runs this path:

1. **Throttler** — the rate limiter. Keyed per `(canonical, relatable)` with a `cache_duration` (and optional `cache_key`). It decides whether an occurrence is allowed into `notification_logs` at all. Its job is *anti-spam*: don't send the same thing too often.
2. **Threshold** — the escalation gate (opt-in). It counts only the post-throttle occurrences already in `notification_logs` and decides whether *this* one is sent for real. Its job is the opposite: *don't send until it's clearly recurring*.

Because the Threshold only sees what survives the Throttler, the two must be compatible — a Threshold notification runs with its throttle effectively off (`cache_duration = 0`) so the Threshold is the sole gate.

---

## Throttler — suppress repeats

The default control. A `cache_duration` window per `(canonical, relatable)` collapses bursts of the same alert into one send. With a `cache_key` it uses an atomic cache claim (`Cache::add`) so multiple worker servers racing the same event still emit only once. This is what stops, e.g., a flapping price daemon from paging the admin every second.

### Delivery priority follows required action

Severity and device interruption are separate decisions. A successful WAP
application remains high severity in audit and email presentation because it
is an important position event, but Pushover delivers it at normal priority.
It stays visible without bypassing quiet hours; the bot already completed the
protective TP adjustment, so no immediate operator action is required.

### Required onboarding mail

Most notifications follow the trader's configured channel preferences. The
registration welcome is deliberately mail-only because a newly registered
trader may not have configured Pushover or Telegram. It is sent after public
registration commits and explains the first trading cycle, existing exchange
activity, and trading risk. Re-enabling an existing account does not send it.

Delivery is once per trader after a successful or still-pending mail audit
record. A failed mail does not consume that entitlement and can be retried.
This avoids duplicate welcomes when the same trader later adds another
account, while still recovering from a transport failure.

---

## Threshold — escalate only on recurrence

{% callout title="Why this exists" %}
Some alerts are pure noise one at a time but a real signal in bulk — the motivating case is Bybit `retCode 10006` ("too many visits"): one is routine backpressure that self-recovers, several in two minutes means something's wrong. The Throttler can only *suppress*; it can't *require* repetition. The Threshold is the missing opposite-direction lever: stay silent until the rate crosses a line, then speak.
{% /callout %}

Opt-in per notification via three fields — `has_threshold`, `threshold_max_notifications`, and `threshold_max_duration_minutes`. Every post-throttle occurrence is logged; the new `notification_logs.passed_threshold` flag records the outcome:

| `passed_threshold` | Meaning |
|---|---|
| `true` | physically delivered (also the default — the normal send path is unchanged) |
| `false` (status `threshold held`) | recorded for audit, **not** sent |

**Re-earn:** after the gate fires it resets — with "2 in 1 minute" the admin is alerted on the 2nd, 4th, 6th… occurrence, never a lone one; ten rapid occurrences yield five alerts, not ten and not one. The window is a rolling look-back, so a slow trickle never accumulates. Counting is per `(notification, relatable)`.

The gate only decides *whether* an occurrence reaches the admin — it never changes the message, severity, or channel. It is **inert by default** (no `has_threshold` → unchanged) and **fail-open**: a write error, an unkeyable relatable, or a misconfigured threshold degrades to "send normally" rather than ever breaking the caller. The breach decision is serialized per scope so two workers can't double-alert on the same breach.

---

## Don't page on transient backpressure

The Threshold is one of two 2026-06 lessons that share a principle: a *transient, self-recovering* condition should not page a human. The other is the step-dispatcher **group-progress watchdog**, which now excludes rate-limit-waiting (`is_throttled`) steps from its "can't drain" tally — so chronic TAAPI / exchange 429 backpressure no longer fires phantom `group_no_progress` alerts, while a genuine non-throttled backlog still does. Same instinct: alert on real, recurring trouble; stay quiet on noise that clears itself.

---

## Cross-lens links

- **[Indicators](/docs/domains/indicators)** — the TAAPI throttle whose 429s are the canonical "benign-when-rare" Threshold candidate
- **[Dispatch daemon](/docs/subsystems/dispatch-daemon)** — where the group-progress watchdog runs
- **[Horizon queues](/docs/subsystems/horizon-queues)** — the worker pools that emit most system alerts
