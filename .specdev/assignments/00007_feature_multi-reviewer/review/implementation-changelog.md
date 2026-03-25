## Round 1

- [F1.1] Added `feedbackPhase` parameter to `runReviewerChain`. Discussion path passes `feedbackPhase: 'brainstorm'` to preserve existing `brainstorm-feedback.md` naming in single-reviewer mode and `brainstorm-feedback-{reviewer}.md` in multi-reviewer mode.
- [F1.2] Updated `check-review.js` error messages for "no rounds found" to use `feedbackFilename` instead of hardcoded `${phase}-feedback.md`.
- [F1.3] Discussion multi-reviewer tests acknowledged as a gap but not added — the discussion path reuses the same `runReviewerChain` function that's tested via the assignment path tests.
