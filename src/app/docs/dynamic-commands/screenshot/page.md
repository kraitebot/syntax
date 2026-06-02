---
title: screenshot
---

`screenshot` analyses debug screenshots uploaded to `upload.waygou.com` for UI feedback. Newest file by default; named file via argument. **Always deletes all files in the upload folder after analysis.** {% .lead %}

---

## Upload folder resolution

The folder varies by environment — check BOTH and use whichever exists:

1. `~/Herd/upload.waygou.com/storage/app/public/uploads/` (local Mac / Herd)
2. `/home/waygou/upload.waygou.com/storage/app/public/uploads/` (VPS / production)

`ls ~/Herd/upload... 2>/dev/null || ls /home/waygou/upload...` resolves which.

---

## Flow

| Step | Action |
|---|---|
| 1. List and sort | `ls -lt <uploads-folder>`. No files → inform user, stop |
| 2. Select | With argument → match filename (exact or substring). No argument → newest file |
| 3. Analyse | Image analysis: UI layout / alignment issues, circled/highlighted annotations (PRIMARY focus — Bruno's pointers), error messages or visual bugs, styling inconsistencies, what Bruno is trying to show |
| 4. **Delete ALL files** | `rm -f <uploads-folder>/*`. NON-NEGOTIABLE |

---

## Hard rules — zero tolerance

1. Folder ALWAYS the resolved uploads path. Any other path = refuse
2. No argument → MUST use newest. No asking. No listing choices
3. MUST delete ALL files after analysis. Skip = violation
4. MUST analyse hand-drawn annotations (circles, arrows, highlights) as PRIMARY focus — Bruno's explicit pointers
5. Observations MUST be actionable: file/component + exact issue + fix direction. No vague "looks off"
6. NEVER guess. Unclear → "cannot determine from image"

---

## Related

- [explain](/docs/dynamic-commands/explain) — when the screenshot triggers a "how does this work" question
- [troubleshoot](/docs/dynamic-commands/troubleshoot) — when the screenshot shows a real bug
- [fix](/docs/dynamic-commands/fix) — when ready to address the issue surfaced
