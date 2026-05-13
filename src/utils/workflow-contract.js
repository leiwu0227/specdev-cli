// workflow-contract.js — minimal CLI-validation surface.
//
// As of contract-version 2, the workflow manifest (`templates/.specdev/workflow.yaml`
// and the installed `.specdev/workflow.yaml`) is the single source of truth for
// per-phase artifact paths, gate field names, interaction blocks, and post-gate
// continuation rules. This module now retains only constants that are NOT
// derivable from the manifest at CLI startup time:
//
//   1. `commandPhases` — the set of phase names each CLI subcommand accepts as
//      positional arguments. Static because CLI argument grammars do not change
//      at runtime.
//   2. `ASSIGNMENT_TYPES`, `REQUIRED_BRAINSTORM_SECTIONS`, `assignmentTypeList`
//      — assignment-type / brainstorm content-schema metadata, intentionally
//      separate from the workflow manifest (which describes phase/step
//      sequencing, not document templates).
//   3. `AGENT_SPEC_PATHS` — runtime agent spec locations, used by `research`.
//
// Per-phase artifact paths and gate field names that were previously exported
// here have moved inline to `workflow-runtime.js` (as the canonical literals
// backing `DEFAULT_WORKFLOW`) and to `workflow.yaml` (the runtime source of
// truth). Do NOT reintroduce them here.

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
