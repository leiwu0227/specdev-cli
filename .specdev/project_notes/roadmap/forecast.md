# Forecast

## 1. Support Extensible Discussion Artifact Sets

Discussion currently creates, validates, reviews, fingerprints, indexes, and promotes only `brainstorm/proposal.md` and `brainstorm/design.md`, while its workflow guidance forbids other files. Keep those canonical artifacts required, but allow supporting regular files and nested directories beneath the Discussion's `brainstorm/`. Add safe recursive enumeration that rejects symlinks, path escapes, and operational noise, then produce a deterministic manifest with stable relative-path ordering and content fingerprints. Use the complete manifest for review context, completion immutability, knowledge discovery, and Assignment or Mission promotion provenance while retaining `design.md` as the concise reader entry point.

Based on: `workflow/lanes/discussion_lane.md`, `foundations/specdev_state_model.md`

## 2. Allow Adhoc During Focused Contract Formation

Adhoc coexistence currently recognizes only a standalone Assignment at its approved design boundary and rejects Mission ownership, so contract brainstorming cannot use an independent Adhoc detour without first resolving focus. Extend coexistence to active Assignment and Mission contract formation and other quiescent pre-execution boundaries. Preserve the focused identity and all lane-owned artifacts, reject live or uncertain Attempts and ambiguous product changes, and prevent approval, execution, or Git-boundary advancement while Adhoc owns mutation. After completion or cancellation, revalidate affected contract assumptions against the resulting product state before the focused workflow resumes.

Based on: `workflow/lanes/adhoc_lane.md`, `workflow/lanes/assignment/assignment_lane.md`, `workflow/lanes/mission_lane.md`
