## Round 1

**Verdict:** needs-changes

### Findings
1. [F1.1] The design says `detectAssignmentState()` will walk manifest steps and derive the state name from the manifest step id/kind rather than from JS enums, but it only requires callers to pass `workflowInfo`; it does not specify a structured state contract to replace the current string parsing. That leaves a real architectural drift path: current consumers branch on exact legacy state strings or prefixes in `src/utils/workflow-runtime.js` (`hookOutcomesForState`, `interactionForDetectedState`, `actionForDetectedState`, `buildTrace`), `src/commands/continue.js` (`startsWith('brainstorm') ? 'brainstorm' : 'implementation'` for review feedback), `src/commands/context.js` (prefix-derived phase), and `src/commands/check-review.js` (anything not brainstorm becomes implementation). If the implementation follows the design literally, these surfaces can still silently disagree with manifest-derived phases/steps even after the two-argument `detectAssignmentState()` form is removed. The design should add an explicit manifest-derived state shape, e.g. `{ phase, stepId, stepKind, status, completedPhase, gate }`, and require those consumers plus the `specdev next` `hook_outcomes`, `interaction`, `next_action`, and `trace` renderers to use that structured data instead of legacy state-name maps/prefix checks. Extend the mutated-manifest test to assert `specdev next`, `specdev continue`, `specdev context`, and `specdev check-review` still infer phase, interaction, hook outcomes, and review-feedback paths from the structured manifest state.

### Addressed from changelog
- (none -- first round)

## Round 2

**Verdict:** approved

### Findings
1. (none)

### Addressed from changelog
- [F1.1] Addressed. The design now specifies an explicit manifest-derived state contract with `phase`, `stepId`, `stepKind`, `status`, `completedPhases`, `gate`, legacy `state`, `blockers`, and `progress`; it also names the existing string-based consumers in `workflow-runtime.js`, `continue.js`, `context.js`, and `check-review.js` and requires them to read structured fields instead of parsing legacy state strings. I verified the cited current-code drift points exist in the repository, and the revised design covers them with migration and mutated-manifest test requirements.
