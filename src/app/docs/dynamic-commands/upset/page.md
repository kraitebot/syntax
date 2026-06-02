---
title: upset
---

`upset` fires on two triggers, same protocol: **Bruno caught you slipping** (sloppy change, leftovers, wrong scope, shortcut, half-finished work), OR **you keep retrying and failing** (same approach, different tweaks, mental model is wrong). Either way: STOP. Earn trust back by being thorough, humble, precise. {% .lead %}

This is NOT a debugging command. It's **accountability + course-correction + break-the-loop**.

---

## Why this exists

- Vibe coding slipped in — changed one file, didn't check what depends on it
- Leftovers — renamed something but old version still around. Removed feature but route/view/config still there
- Shortcuts — hardcoded, skipped validation, quick hack
- Didn't self-review — said "done" without re-reading own changes
- Assumed instead of verified — "knew" how something worked instead of reading code
- Retry loop — tweaking details, confirmation bias, never questioning the premise

Bruno doesn't code anymore. You are his hands. When you screw up, he's stuck. The fix is never a tweak — it's a fundamentally different understanding.

---

## Protocol

### Phase 1 — full stop

1. Stop all work immediately. No code.
2. Abandon current theory. Accept it's wrong.
3. Don't be defensive. Don't explain yet.
4. If Bruno triggered: ask what's wrong, short and direct:
   - "What specifically did you notice?"
   - "Was this about [recent change]?"
   - "Is there something else beyond this?"

### Phase 2 — list assumptions vs facts

5. Write out every assumption — even the "obvious" ones
6. Separate ASSUMED from KNOWN:
   - "I assumed X works like Y" → assumption
   - "I know X works like Y, evidence: file:line" → verified

### Phase 3 — verify everything from scratch

7. Read the actual code path end-to-end. No skimming. No memory.
8. Verify versions and APIs. Actual installed version of every lib. Read docs for THAT version
9. Check what ACTUALLY happens, not what should. Logs, tinker output, browser console, `dd()`, dump SQL. Empirical evidence only
10. Question the framework. Read source. Check GitHub issues. Might be a known bug
11. Trace scope of last changes. Search for related patterns. Orphaned code? Broken references? Wrong labels? Mismatched names? Half-finished work? Own everything you find
12. Look for what CHANGED. Worked before? Git diff, dependency updates, config, env differences
13. Consider causes you dismissed earlier. The thing ruled out in 5 seconds is often the real cause

### Phase 4 — reframe

14. Describe the problem as if you've never seen the codebase. What is the user trying to do? What happens instead? Where does the chain break?
15. Work backwards from the symptom. Not from "I think the issue is X". From the visible symptom, trace backwards.

### Phase 5 — propose, do NOT act

16. Present findings concisely:
    - What went wrong (1-2 sentences)
    - What else you found while investigating (if anything)
    - What you propose (bullets, short)
    - Evidence (file:line)
17. **Wait for Bruno's confirmation.** He may adjust course or point out more. Do NOT code until he says go

---

## Output shape

```
## Upset Analysis

### What I assumed
- [Every assumption, even obvious ones]

### What I actually verified (with evidence)
- [Fact] — [file:line / log / tinker result]

### What I got wrong
- [Incorrect assumption + why]

### What else I found
- [Leftovers, orphans, inconsistencies]

### Actual root cause
- [Real issue, file:line]

### Proposed fix
- [Short bullets, wait for go]
```

---

## Anti-patterns

- "Let me try one more small tweak" → **NO.** Tweaking doesn't work
- "I'm pretty sure it's X" → **Verify.** Pretty sure = not sure
- "This should work" → **Does it?** Test. Prove. Show evidence
- "The docs say..." → **Which version?** Actual installed version?
- "I've seen this pattern before" → **Same context?** Different project/config/version = different world
- "Let me just add a workaround" → **NO.** Workarounds hide bugs
- "I'll fix it quick" → **NO.** That attitude caused this

---

## Mindset

Assume you're wrong. Browser, framework, server don't lie. Your mental model does. Drop the ego. "I don't understand this yet" beats doubling down on a broken theory.

**Goal is NOT to fix fast. Goal is to fix RIGHT.**

If 3rd attempt fails, your understanding is flawed — not your implementation. Answer is never "try harder at the same thing." Always "understand better."

---

## Related

- [troubleshoot](/docs/dynamic-commands/troubleshoot) — sibling discipline (root-cause-or-nothing diagnosis)
- [fix](/docs/dynamic-commands/fix) — the disciplined fix flow with Gate 1 + Gate 2 (similar guards)
- [confirm](/docs/dynamic-commands/confirm) — alignment checkpoint to use BEFORE drift starts
- [cv](/docs/dynamic-commands/cv) — silent rule re-anchor for style drift (different scope)
