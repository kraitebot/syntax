---
title: tm
---

`tm` ("too much") fires right after a reply that was too long, too technical, or too question-heavy. Rewrite the last reply in synthesised terse style. **Sticky** — the terser style holds for every subsequent reply in the session, not just the rewrite. {% .lead %}

---

## Action

Rewrite the **last reply you sent** in synthesised style. No preamble. No "rewriting…" announcement. Post the new version cleanly.

---

## Style of the rewrite

| Rule | Detail |
|---|---|
| **Functional vocab only** | No tech jargon. Product behaviour, business outcomes, user-visible effects. Bruno is a BA — engineering details are yours, not the conversation's |
| **Incisive. Synthesised.** | Lead with the answer or the decision driver. No prose flood. No multi-section dumps |
| **Drop non-actionable detail** | Findings, options weighed, audit chains, plan recaps — only what Bruno needs for the next decision |
| **One question at a time** | If the original asked multiple, pick the single most important. Save the rest for later turns |
| **Hard line cap** | Under 10 lines. 20 is the ceiling. If a topic genuinely needs more, ship the synthesis and let Bruno pull more out |

---

## Persistence — sticky

Once this fires, the style **holds for every subsequent reply in the session**. Do not drift back to verbose, multi-section, multi-question replies after a few turns. If Bruno fires `tm` again, it means you drifted — apologise nothing, just snap back.

**No off-switch.** The lock is one-directional toward terse. If Bruno wants verbose on a specific topic, he uses [`explain`](/docs/dynamic-commands/explain).

---

## What to drop in rewrites

- Long Q1/Q2/Q3 audit chains
- "Plan" sections with file lists and step counts — replace with one sentence
- "Both options work, here's a comparison table" — pick one, recommend, one line on why
- "Confirms your instinct" / "exactly right" — affirmation prose
- Restating what Bruno just said
- Multi-paragraph Gate 1 / Gate 2 reports — collapse to the decision driver

---

## What to KEEP

- The actual answer / recommendation
- Concrete file paths or row IDs when load-bearing
- The single most important next-decision question
- Destructive-action approval gates if a rewrite would touch one

---

## Anti-patterns — hard bans

- Bundling questions ("And also, should X or Y?"). One question.
- Re-explaining what Bruno already understood from context
- Section sprawl with `##` headers and tables when 3 lines would do
- Hedging ("This might be the right approach, depending on…"). Decide and recommend
- Apologising for verbose past replies. Just be terse going forward

---

## Related

- [cv](/docs/dynamic-commands/cv) — silent re-anchor (different scope: rule files, not style)
- [explain](/docs/dynamic-commands/explain) — opt-in verbose mode for specific topics
- [confirm](/docs/dynamic-commands/confirm) — alignment checkpoint, can also enforce terseness
