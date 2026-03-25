## Round 1

- [F1.1] Added "Changes to review.js" section specifying that `review.js` reads `SPECDEV_FOCUS` from env and displays it in output. This is the consumption point — same pattern as existing `SPECDEV_DISCUSSION` reading. Updated "How It Works" step 4-5 to trace the full flow from env var to reviewer display.
- [F1.2] Scoped the Non-Goal from "no changes to manual review" to "no changes to manual review workflow or verdict format" — permits displaying focus text in automated review context.
- [F1.3] Added malformed JSON handling to "How It Works" step 1 and success criteria item 5 — invalid JSON falls back to empty string with a warning logged.
