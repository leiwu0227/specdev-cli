// workflow-contract.js — minimal CLI-validation surface.
//
// RippleGraph packages own workflow sequencing. This module retains only the
// CLI validation constants that semantic commands need independently of graph
// execution:
//
//   1. `commandPhases` — the set of phase names each CLI subcommand accepts as
//      positional arguments. Static because CLI argument grammars do not change
//      at runtime.
//   2. `ASSIGNMENT_TYPES`, `REQUIRED_BRAINSTORM_SECTIONS`, `assignmentTypeList`
//      — assignment-type / brainstorm content-schema metadata, intentionally
//      separate from graph execution and document templates.
//   3. `AGENT_SPEC_PATHS` — runtime agent spec locations, used by `research`.
//
// The old phase paths and gate fields remain in `workflow-runtime.js` only to
// finish assignments created before the RippleGraph upgrade.

export const ASSIGNMENT_TYPES = ['feature', 'bugfix', 'refactor', 'familiarization']

export const commandPhases = {
  checkpoint: ['brainstorm', 'implementation', 'discussion'],
  approve: ['brainstorm', 'implementation'],
  review: ['brainstorm', 'implementation', 'discussion'],
  checkReview: ['brainstorm', 'implementation'],
  reviewloop: ['brainstorm', 'implementation', 'discussion'],
}

export const REQUIRED_BRAINSTORM_SECTIONS = {
  feature: ['Overview', 'Goals', 'Non-Goals', 'Design', 'Success Criteria'],
  bugfix: ['Overview', 'Root Cause', 'Fix Design', 'Success Criteria'],
  refactor: ['Overview', 'Non-Goals', 'Design', 'Success Criteria'],
  familiarization: ['Overview'],
}

export const AGENT_SPEC_PATHS = {
  researcher: '.specdev/agents/researcher/agent.md',
}

export function assignmentTypeList(separator = ', ') {
  return ASSIGNMENT_TYPES.join(separator)
}
