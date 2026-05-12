export const ASSIGNMENT_TYPES = ['feature', 'bugfix', 'refactor', 'familiarization']

export const phases = {
  canonical: ['brainstorm', 'breakdown', 'implementation'],
  aliases: {
    implementation: ['implement'],
  },
}

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

export const artifactPaths = {
  brainstorm: {
    proposal: 'brainstorm/proposal.md',
    design: 'brainstorm/design.md',
  },
  breakdown: {
    plan: 'breakdown/plan.md',
  },
  implementation: {
    progress: 'implementation/progress.json',
  },
  capture: {
    projectNotesDiff: 'capture/project-notes-diff.md',
    workflowDiff: 'capture/workflow-diff.md',
  },
}

export const AGENT_SPEC_PATHS = {
  researcher: '.specdev/agents/researcher/agent.md',
}

export const gateFields = {
  brainstorm: 'brainstorm_approved',
  implementation: 'implementation_approved',
}

export function assignmentTypeList(separator = ', ') {
  return ASSIGNMENT_TYPES.join(separator)
}

export function phaseList(command, separator = ' | ') {
  return (commandPhases[command] || []).join(separator)
}
