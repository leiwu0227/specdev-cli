# Plan

**Implementation Guides:** []
**Review Guides:** []

## Tasks

1. **T-1: Classify chronological verification receipts by stable obligation identity.** Update the Mission child follow-up path so only the latest receipt for the same command, revision, and scope determines that obligation's verification status, without mutating or discarding receipt history. Covers AC-1 and AC-2.
2. **T-2: Add focused regression fixtures for closure and unresolved signals.** Extend the Mission compatibility fixture coverage for a failed receipt followed by a matching pass, a latest matching failure, an unrelated later pass, and independent explicit failed/blocked signals. Covers AC-1 and AC-2.
3. **T-3: Record bounded verification and delivery receipts.** With repository-required test authority, run only the focused Mission compatibility command; otherwise record the missing authority accurately, inspect the changed paths, and complete the Assignment artifacts without overstating runtime evidence. Covers AC-1 and AC-2.
