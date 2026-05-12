import { join } from 'path'
import fse from 'fs-extra'
import YAML from 'yaml'
import { resolveCurrentAssignment } from './current.js'
import { scanSingleAssignment } from './scan.js'
import { detectAssignmentState } from './state.js'
import { artifactPaths, gateFields, phases as workflowPhases } from './workflow-contract.js'

const BRAINSTORM_CHECKPOINT_INTERACTION = {
  id: 'brainstorm_review_decision',
  kind: 'choice',
  prompt: 'How do you want to proceed from brainstorm?',
  render_via: 'choice_prompt',
  choices: [
    {
      id: 'reviewloop_autocontinue',
      label: 'Automated review, then continue if approved',
      command_template: 'specdev reviewloop brainstorm --reviewer=<name> --autocontinue',
      requires_reviewer: true,
      autocontinue: true,
    },
    {
      id: 'reviewloop_only',
      label: 'Automated review only',
      command_template: 'specdev reviewloop brainstorm --reviewer=<name>',
      requires_reviewer: true,
    },
    {
      id: 'manual_review',
      label: 'Manual review',
      command_template: 'specdev review brainstorm',
    },
    {
      id: 'approve_skip_review',
      label: 'Skip review and approve',
      command_template: 'specdev approve brainstorm',
    },
  ],
  follow_up: {
    when: 'choice.requires_reviewer',
    id: 'reviewer_pick',
    kind: 'choice',
    prompt: 'Which reviewer?',
    source: 'reviewers_listing',
  },
}

const IMPLEMENTATION_CHECKPOINT_INTERACTION = {
  id: 'implementation_review_decision',
  kind: 'choice',
  prompt: 'How do you want to proceed from implementation?',
  render_via: 'choice_prompt',
  choices: [
    {
      id: 'reviewloop_autocontinue',
      label: 'Automated review, then continue if approved',
      command_template: 'specdev reviewloop implementation --reviewer=<name> --autocontinue',
      requires_reviewer: true,
      autocontinue: true,
    },
    {
      id: 'reviewloop_only',
      label: 'Automated review only',
      command_template: 'specdev reviewloop implementation --reviewer=<name>',
      requires_reviewer: true,
    },
    {
      id: 'manual_review',
      label: 'Manual review',
      command_template: 'specdev review implementation',
    },
    {
      id: 'approve_skip_review',
      label: 'Skip review and approve',
      command_template: 'specdev approve implementation',
    },
  ],
  follow_up: {
    when: 'choice.requires_reviewer',
    id: 'reviewer_pick',
    kind: 'choice',
    prompt: 'Which reviewer?',
    source: 'reviewers_listing',
  },
}

const DISCUSSION_CHECKPOINT_INTERACTION = {
  id: 'discussion_checkpoint',
  kind: 'choice',
  prompt: 'How do you want to review this discussion?',
  render_via: 'choice_prompt',
  choices: [
    {
      id: 'reviewloop',
      label: 'Automated review',
      command_template: 'specdev reviewloop discussion --discussion={discussion} --reviewer=<name>',
      requires_reviewer: true,
    },
    {
      id: 'manual_review',
      label: 'Manual review',
      command_template: 'specdev review discussion --discussion={discussion}',
    },
  ],
  follow_up: {
    when: 'choice.requires_reviewer',
    id: 'reviewer_pick',
    kind: 'choice',
    prompt: 'Which reviewer?',
    source: 'reviewers_listing',
  },
}

const GATE_ON_SATISFIED = {
  next: { kind: 'workflow_advance' },
  sticky: ['reviewer', 'autocontinue'],
  interrupt: false,
}

export const DEFAULT_WORKFLOW = {
  workflow_contract_version: 2,
  phases: {
    brainstorm: {
      steps: [
        {
          id: 'create_artifacts',
          kind: 'guide',
          guide: '.specdev/skills/core/brainstorming/SKILL.md',
          produces: [
            artifactPaths.brainstorm.proposal,
            artifactPaths.brainstorm.design,
          ],
        },
        {
          id: 'checkpoint',
          kind: 'command',
          run: 'specdev checkpoint brainstorm',
          requires: [
            artifactPaths.brainstorm.proposal,
            artifactPaths.brainstorm.design,
          ],
          interaction: BRAINSTORM_CHECKPOINT_INTERACTION,
        },
        {
          id: 'approval',
          kind: 'gate',
          gate: 'brainstorm_approved',
          requires: [
            artifactPaths.brainstorm.proposal,
            artifactPaths.brainstorm.design,
          ],
          on_satisfied: GATE_ON_SATISFIED,
        },
      ],
    },
    breakdown: {
      steps: [
        {
          id: 'create_plan',
          kind: 'guide',
          guide: '.specdev/skills/core/breakdown/SKILL.md',
          produces: [artifactPaths.breakdown.plan],
        },
      ],
    },
    implementation: {
      steps: [
        {
          id: 'execute_plan',
          kind: 'guide',
          guide: '.specdev/skills/core/implementing/SKILL.md',
          produces: [artifactPaths.implementation.progress],
        },
        {
          id: 'checkpoint',
          kind: 'command',
          run: 'specdev checkpoint implementation',
          requires: [artifactPaths.implementation.progress],
          interaction: IMPLEMENTATION_CHECKPOINT_INTERACTION,
        },
        {
          id: 'approval',
          kind: 'gate',
          gate: 'implementation_approved',
          requires: [artifactPaths.implementation.progress],
          on_satisfied: GATE_ON_SATISFIED,
        },
      ],
    },
  },
  interactions: [DISCUSSION_CHECKPOINT_INTERACTION],
  hooks: [
    {
      id: 'brainstorm_knowledge_prompt',
      slot: 'phase:end',
      phase: 'brainstorm',
      order: 50,
      kind: 'guide',
      guide: '.specdev/skills/core/knowledge-capture/SKILL.md',
      blocking: false,
    },
    {
      id: 'breakdown_knowledge_prompt',
      slot: 'phase:end',
      phase: 'breakdown',
      order: 50,
      kind: 'guide',
      guide: '.specdev/skills/core/knowledge-capture/SKILL.md',
      blocking: false,
    },
    {
      id: 'repo_knowledge_prompt',
      slot: 'phase:end',
      phase: 'implementation',
      order: 50,
      kind: 'guide',
      guide: '.specdev/skills/core/knowledge-capture/SKILL.md',
      blocking: false,
    },
  ],
}

export async function loadWorkflowDefinition(specdevPath) {
  const manifestPath = join(specdevPath, 'workflow.yaml')
  if (!(await fse.pathExists(manifestPath))) {
    return {
      source: 'default',
      path: null,
      workflow: DEFAULT_WORKFLOW,
      validation: validateWorkflowDefinition(DEFAULT_WORKFLOW),
    }
  }

  const raw = await fse.readFile(manifestPath, 'utf-8')
  let parsed
  try {
    parsed = YAML.parse(raw)
  } catch (error) {
    const workflow = {
      workflow_contract_version: null,
      phases: {},
      hooks: [],
    }
    return {
      source: 'manifest',
      path: manifestPath,
      workflow,
      validation: {
        valid: false,
        errors: [`workflow.yaml parse error: ${error.message}`],
      },
    }
  }
  return {
    source: 'manifest',
    path: manifestPath,
    workflow: parsed,
    validation: validateWorkflowDefinition(parsed),
  }
}

export function validateWorkflowDefinition(workflow) {
  const errors = []
  const seenHookOrders = new Set()

  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
    return {
      valid: false,
      errors: ['workflow.yaml must contain a mapping/object'],
    }
  }

  if (workflow.workflow_contract_version !== 2) {
    if (workflow.workflow_contract_version === 1) {
      errors.push('workflow_contract_version 1 is no longer supported; run `specdev update` to migrate to version 2')
    } else {
      errors.push('workflow_contract_version must be 2')
    }
  }

  validateWorkflowPhases(workflow, errors)

  if (workflow.interactions !== undefined) {
    if (!Array.isArray(workflow.interactions)) {
      errors.push('interactions must be an array when provided')
    } else {
      for (const interaction of workflow.interactions) {
        validateInteractionBlock(interaction, 'interactions entry', errors)
      }
    }
  }

  if (workflow.hooks !== undefined && !Array.isArray(workflow.hooks)) {
    errors.push('hooks must be an array when provided')
  }

  const hooks = Array.isArray(workflow.hooks) ? workflow.hooks : []
  for (const hook of hooks) {
    if (!hook || typeof hook !== 'object' || Array.isArray(hook)) {
      errors.push('hooks entries must be mappings/objects')
      continue
    }
    for (const field of ['id', 'slot', 'phase', 'order', 'kind']) {
      if (hook[field] === undefined || hook[field] === null || hook[field] === '') {
        errors.push(`hook missing ${field}`)
      }
    }
    const key = `${hook.phase}:${hook.slot}:${hook.order}`
    if (seenHookOrders.has(key)) {
      errors.push(`duplicate hook order for ${key}`)
    }
    seenHookOrders.add(key)
    if (hook.blocking && !hook.validator) {
      errors.push(`blocking hook ${hook.id || '(unknown)'} must declare validator`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

function validateWorkflowPhases(workflow, errors) {
  if (!workflow.phases || typeof workflow.phases !== 'object' || Array.isArray(workflow.phases)) {
    errors.push('phases must be a mapping/object')
    return
  }

  for (const phase of workflowPhases.canonical) {
    const phaseDef = workflow.phases[phase]
    if (!phaseDef || typeof phaseDef !== 'object' || Array.isArray(phaseDef)) {
      errors.push(`phase ${phase} must be a mapping/object`)
      continue
    }
    if (!Array.isArray(phaseDef.steps)) {
      errors.push(`phase ${phase} steps must be an array`)
      continue
    }
    for (const step of phaseDef.steps) {
      validateWorkflowStep(phase, step, errors)
    }
  }

  requireWorkflowStep(workflow, 'brainstorm', 'create_artifacts', 'guide', errors)
  requireWorkflowStep(workflow, 'brainstorm', 'checkpoint', 'command', errors)
  requireWorkflowStep(workflow, 'brainstorm', 'approval', 'gate', errors, gateFields.brainstorm)
  requireWorkflowStep(workflow, 'breakdown', 'create_plan', 'guide', errors)
  requireWorkflowStep(workflow, 'implementation', 'execute_plan', 'guide', errors)
  requireWorkflowStep(workflow, 'implementation', 'checkpoint', 'command', errors)
  requireWorkflowStep(workflow, 'implementation', 'approval', 'gate', errors, gateFields.implementation)
}

function validateWorkflowStep(phase, step, errors) {
  if (!step || typeof step !== 'object' || Array.isArray(step)) {
    errors.push(`phase ${phase} steps entries must be mappings/objects`)
    return
  }
  if (!step.id) errors.push(`phase ${phase} step missing id`)
  if (!step.kind) errors.push(`phase ${phase} step ${step.id || '(unknown)'} missing kind`)
  if (step.kind === 'guide' && !step.guide) {
    errors.push(`phase ${phase} guide step ${step.id || '(unknown)'} missing guide`)
  }
  if (step.kind === 'command' && !step.run) {
    errors.push(`phase ${phase} command step ${step.id || '(unknown)'} missing run`)
  }
  if (step.kind === 'gate' && !step.gate) {
    errors.push(`phase ${phase} gate step ${step.id || '(unknown)'} missing gate`)
  }

  const stepLabel = `phase ${phase} step ${step.id || '(unknown)'}`

  // Checkpoint steps (kind: command, id: checkpoint) must declare an interaction block
  if (step.kind === 'command' && step.id === 'checkpoint') {
    if (!step.interaction || typeof step.interaction !== 'object' || Array.isArray(step.interaction)) {
      errors.push(`${stepLabel} missing interaction block`)
    } else {
      validateInteractionBlock(step.interaction, `${stepLabel} interaction`, errors)
    }
    validateRequiresField(step, stepLabel, errors)
  }

  // Gate steps must declare on_satisfied + requires
  if (step.kind === 'gate') {
    validateRequiresField(step, stepLabel, errors)
    if (!step.on_satisfied || typeof step.on_satisfied !== 'object' || Array.isArray(step.on_satisfied)) {
      errors.push(`${stepLabel} missing on_satisfied block`)
    } else {
      if (!step.on_satisfied.next || typeof step.on_satisfied.next !== 'object' || Array.isArray(step.on_satisfied.next)) {
        errors.push(`${stepLabel} on_satisfied.next must be a mapping/object`)
      } else if (!step.on_satisfied.next.kind) {
        errors.push(`${stepLabel} on_satisfied.next.kind missing`)
      }
      if (typeof step.on_satisfied.interrupt !== 'boolean') {
        errors.push(`${stepLabel} on_satisfied.interrupt must be a boolean`)
      }
    }
  }
}

function validateRequiresField(step, stepLabel, errors) {
  if (step.requires === undefined) {
    errors.push(`${stepLabel} missing requires`)
    return
  }
  if (!Array.isArray(step.requires)) {
    errors.push(`${stepLabel} requires must be an array`)
    return
  }
  for (const entry of step.requires) {
    if (typeof entry === 'string' && entry.length > 0) continue
    if (entry && typeof entry === 'object' && !Array.isArray(entry) && typeof entry.path === 'string' && entry.path.length > 0) {
      continue
    }
    errors.push(`${stepLabel} requires entries must be path strings or { path: string } objects`)
  }
}

function validateInteractionBlock(block, label, errors) {
  if (!block || typeof block !== 'object' || Array.isArray(block)) {
    errors.push(`${label} must be a mapping/object`)
    return
  }
  if (!block.id) errors.push(`${label} missing id`)
  if (block.kind !== 'choice') errors.push(`${label} kind must be 'choice'`)
  if (!block.prompt) errors.push(`${label} missing prompt`)
  if (block.render_via !== 'choice_prompt') errors.push(`${label} render_via must be 'choice_prompt'`)
  if (!Array.isArray(block.choices) || block.choices.length === 0) {
    errors.push(`${label} choices must be a non-empty array`)
    return
  }
  for (const choice of block.choices) {
    if (!choice || typeof choice !== 'object' || Array.isArray(choice)) {
      errors.push(`${label} choices entries must be mappings/objects`)
      continue
    }
    if (!choice.id) errors.push(`${label} choice missing id`)
    if (!choice.label) errors.push(`${label} choice ${choice.id || '(unknown)'} missing label`)
  }
}

function requireWorkflowStep(workflow, phase, id, kind, errors, gate = null) {
  const steps = workflow.phases?.[phase]?.steps
  if (!Array.isArray(steps)) return
  const step = steps.find((item) => item && typeof item === 'object' && !Array.isArray(item) && item.id === id)
  if (!step) {
    errors.push(`phase ${phase} missing required step ${id}`)
    return
  }
  if (step.kind !== kind) {
    errors.push(`phase ${phase} step ${id} must be kind ${kind}`)
  }
  if (gate && step.gate !== gate) {
    errors.push(`phase ${phase} step ${id} must use gate ${gate}`)
  }
}

export function buildReviewChoices(phase, { discussion = null, reviewers = [] } = {}) {
  const discussionArg = discussion ? ` --discussion=${discussion}` : ''
  const reviewPhase = discussion ? 'discussion' : phase

  if (discussion) {
    return [
      {
        id: 'reviewloop',
        label: 'Automated review',
        description: 'Runs reviewloop for this discussion.',
        command: `specdev reviewloop ${reviewPhase}${discussionArg} --reviewer=<name>`,
        requires_reviewer: true,
      },
      {
        id: 'manual_review',
        label: 'Manual review',
        description: 'Starts a separate manual review session.',
        command: `specdev review ${reviewPhase}${discussionArg}`,
      },
    ]
  }

  return [
    {
      id: 'reviewloop_autocontinue',
      label: 'Automated review, then continue',
      description: 'Runs reviewloop and continues to the next phase if approved.',
      command: `specdev reviewloop ${phase} --reviewer=<name> --autocontinue`,
      requires_reviewer: true,
      autocontinue: true,
    },
    {
      id: 'reviewloop_only',
      label: 'Automated review only',
      description: 'Runs reviewloop and stops after phase approval.',
      command: `specdev reviewloop ${phase} --reviewer=<name>`,
      requires_reviewer: true,
      autocontinue: false,
    },
    {
      id: 'manual_review',
      label: 'Manual review',
      description: 'Starts a separate manual review session.',
      command: `specdev review ${phase}`,
    },
    {
      id: 'approve_skip_review',
      label: 'Approve without review',
      description: `Approves the ${phase} gate without running review.`,
      command: `specdev approve ${phase}`,
    },
  ].map((choice) => ({
    ...choice,
    reviewers: choice.requires_reviewer ? reviewers : undefined,
  }))
}

export async function computeNextAction(specdevPath) {
  const workflowInfo = await loadWorkflowDefinition(specdevPath)
  if (!workflowInfo.validation.valid) {
    return {
      command: 'next',
      version: 1,
      status: 'blocked',
      state: 'workflow_manifest_invalid',
      workflow: workflowInfoSummary(workflowInfo),
      blockers: workflowInfo.validation.errors.map((error) => ({
        code: 'workflow_manifest_invalid',
        detail: error,
        recommended_fix: 'Fix .specdev/workflow.yaml hook declarations',
      })),
      next_action: null,
    }
  }

  const current = await resolveCurrentAssignment(specdevPath)
  if (current.error) {
    return {
      command: 'next',
      version: 1,
      status: 'blocked',
      state: current.error === 'missing' ? 'no_assignment' : 'stale_current',
      workflow: workflowInfoSummary(workflowInfo),
      blockers: [{
        code: current.error === 'missing' ? 'no_assignment' : 'stale_current',
        detail: current.error === 'missing'
          ? 'No active assignment set'
          : `Active assignment "${current.name}" not found`,
        recommended_fix: 'Run specdev focus <id> or specdev assignment <description>',
      }],
      next_action: null,
    }
  }

  const summary = await scanSingleAssignment(current.path, current.name)
  const detected = await detectAssignmentState(summary, current.path, workflowInfo)
  const action = actionForDetectedState(detected, workflowInfo.workflow)
  const interaction = interactionForDetectedState(detected)
  const hookOutcomes = hookOutcomesForState(workflowInfo.workflow, detected)

  return {
    command: 'next',
    version: 1,
    status: detected.blockers.length > 0 ? 'blocked' : 'ok',
    assignment: current.name,
    assignment_path: current.path,
    state: detected.state,
    workflow: workflowInfoSummary(workflowInfo),
    next_action: action,
    interaction,
    hook_outcomes: hookOutcomes,
    trace: buildTrace(detected),
    blockers: detected.blockers,
    progress: detected.progress,
  }
}

function hookOutcomesForState(workflow, detected) {
  if (!Array.isArray(workflow.hooks)) {
    return []
  }
  const endedPhase = endedPhaseFromDetected(detected)
  if (!endedPhase) return []

  return workflow.hooks
    .filter((hook) => hook.phase === endedPhase && hook.slot === 'phase:end')
    .sort((a, b) => a.order - b.order)
    .map((hook) => ({
      id: hook.id,
      phase: hook.phase,
      slot: hook.slot,
      order: hook.order,
      kind: hook.kind,
      guide: hook.guide,
      blocking: Boolean(hook.blocking),
      outcome: hook.blocking ? 'not_applicable' : 'skipped',
      reason: hook.blocking
        ? 'blocking phase-end hooks are not executed by this runtime overlay'
        : 'advisory phase-end knowledge capture hook is available; workflow progress is not blocked',
    }))
}

function endedPhaseFromDetected(detected) {
  // A "phase:end" hook fires when we've just finished a phase. We treat:
  //   - phase=brainstorm, status=checkpoint_ready  → brainstorm artifacts done
  //   - phase=implementation, status=in_progress   → breakdown plan done (we just entered implementation)
  //   - phase=implementation, status=checkpoint_ready → implementation work done
  //   - status=completed (phase=null)              → terminal: implementation just finished
  if (detected.status === 'completed') return 'implementation'
  if (detected.phase === 'brainstorm' && detected.status === 'checkpoint_ready') return 'brainstorm'
  if (detected.phase === 'implementation' && detected.status === 'in_progress') return 'breakdown'
  if (detected.phase === 'implementation' && detected.status === 'checkpoint_ready') return 'implementation'
  return null
}

function interactionForDetectedState(detected) {
  if (detected.stepKind === 'command' && detected.stepId === 'checkpoint' && detected.status === 'checkpoint_ready') {
    if (detected.phase === 'brainstorm') {
      return {
        type: 'choice',
        prompt: 'How do you want to proceed from brainstorm?',
        choices: buildReviewChoices('brainstorm'),
      }
    }
    if (detected.phase === 'implementation') {
      return {
        type: 'choice',
        prompt: 'How do you want to proceed from implementation?',
        choices: buildReviewChoices('implementation'),
      }
    }
  }
  return null
}

function workflowInfoSummary(workflowInfo) {
  return {
    source: workflowInfo.source,
    path: workflowInfo.path,
    contract_version: workflowInfo.workflow?.workflow_contract_version || null,
  }
}

function actionForDetectedState(detected, workflow) {
  if (detected.status === 'completed') {
    return {
      id: 'assignment.completed',
      phase: null,
      step: null,
      kind: 'none',
      evidence: {},
    }
  }

  if (!detected.phase || !detected.stepId) {
    return {
      id: 'workflow.inspect',
      phase: null,
      step: null,
      kind: 'inspect',
      evidence: {},
    }
  }

  const phaseDef = workflow.phases?.[detected.phase]
  if (!phaseDef || !Array.isArray(phaseDef.steps)) {
    return {
      id: 'workflow.inspect',
      phase: null,
      step: null,
      kind: 'inspect',
      evidence: {},
    }
  }
  const step = phaseDef.steps.find((item) => item && item.id === detected.stepId)
  if (!step) {
    return {
      id: 'workflow.inspect',
      phase: null,
      step: null,
      kind: 'inspect',
      evidence: {},
    }
  }

  // When the active step is a guide that has a checkpoint sibling in the
  // same phase (today: brainstorm/create_artifacts → checkpoint,
  // implementation/execute_plan → checkpoint), surface the checkpoint
  // command as the `after` field. This matches the legacy `afterStep`
  // behavior without branching on the legacy state string.
  let afterStepId = null
  if (step.kind === 'guide') {
    const checkpointStep = phaseDef.steps.find(
      (item) => item && item.kind === 'command' && item.id === 'checkpoint'
    )
    if (checkpointStep) afterStepId = checkpointStep.id
  }

  return actionFromWorkflowStep(workflow, {
    phase: detected.phase,
    step: detected.stepId,
    afterStep: afterStepId,
  })
}

function actionFromWorkflowStep(workflow, actionConfig) {
  const step = workflow.phases[actionConfig.phase].steps.find((item) => item.id === actionConfig.step)
  const action = {
    id: `${actionConfig.phase}.${step.id}`,
    phase: actionConfig.phase,
    step: step.id,
    kind: step.kind,
    evidence: step.produces ? { artifacts: step.produces } : {},
  }

  if (step.guide) action.guide = step.guide
  if (step.run) action.command_line = step.run
  if (step.gate) action.gate = step.gate

  if (step.kind === 'command') {
    action.evidence = { exit_code: 0 }
  }

  if (actionConfig.afterStep) {
    const after = workflow.phases[actionConfig.phase].steps.find((item) => item.id === actionConfig.afterStep)
    if (after?.run) action.after = after.run
  }

  return action
}

function buildTrace(detected) {
  if (detected.status === 'completed') {
    return [
      'implementation gate is approved',
      'required workflow gates are complete',
      'optional knowledge capture may be suggested by phase-end hooks',
    ]
  }

  const { phase, stepKind, status } = detected

  if (phase === 'brainstorm' && status === 'in_progress') {
    return [
      'brainstorm artifacts are missing',
      'next action is to run the brainstorm guide',
    ]
  }
  if (phase === 'brainstorm' && status === 'checkpoint_ready') {
    return [
      'brainstorm artifacts are present',
      'brainstorm approval gate is pending',
      'next action is to run the brainstorm checkpoint',
    ]
  }
  if (phase === 'breakdown' && status === 'in_progress') {
    return [
      'brainstorm gate is approved',
      'breakdown/plan.md is missing',
      'next action is to run the breakdown guide',
    ]
  }
  if (phase === 'implementation' && status === 'in_progress' && stepKind === 'guide') {
    return [
      'breakdown/plan.md is present',
      'implementation progress is missing or incomplete',
      'next action is to run the implementation guide',
    ]
  }
  if (phase === 'implementation' && status === 'checkpoint_ready') {
    return [
      'implementation tasks are complete',
      'implementation approval gate is pending',
      'next action is to run the implementation checkpoint',
    ]
  }
  return ['workflow state requires inspection']
}

/**
 * Render a manifest step's interaction, continuation, or blocker output.
 * Consumed by checkpoint, approve, reviewloop, next, status, review commands.
 *
 * @param {Object} step - manifest step (with interaction/on_satisfied/requires fields)
 * @param {Object} runtimeContext - { phase, discussion, reviewers, sessionState }
 * @param {Object} options - { format: 'text' | 'json' }
 * @returns {Object} - { interaction?, continuation?, blockers? } depending on what the step has
 */
export function renderStepOutput(step, runtimeContext, { format = 'json' } = {}) {
  if (!step) return {}
  const output = {}

  if (step.interaction) {
    output.interaction = renderInteractionBlock(step.interaction, runtimeContext)
  }
  if (step.on_satisfied) {
    output.continuation = renderContinuationBlock(step.on_satisfied, runtimeContext)
  }
  // requires-based blockers are computed by callers that know what's missing on disk;
  // renderStepOutput just formats the step's manifest contract, not the runtime artifact-presence check.

  return output
}

function renderInteractionBlock(interaction, runtimeContext) {
  const { phase, discussion, reviewers = [] } = runtimeContext
  const substitute = (str) => {
    if (typeof str !== 'string') return str
    return str
      .replace(/\{phase\}/g, phase || '')
      .replace(/\{discussion\}/g, discussion || '')
  }

  const choices = (interaction.choices || []).map((choice) => {
    const rendered = {
      id: choice.id,
      label: substitute(choice.label),
      command: substitute(choice.command_template),
    }
    if (choice.requires_reviewer) {
      rendered.requires_reviewer = true
      rendered.reviewers = reviewers
    }
    if (choice.autocontinue) rendered.autocontinue = true
    return rendered
  })

  let followUp
  if (interaction.follow_up) {
    followUp = {
      id: interaction.follow_up.id,
      kind: interaction.follow_up.kind,
      prompt: substitute(interaction.follow_up.prompt),
      when: interaction.follow_up.when,
      source: interaction.follow_up.source,
    }
  }

  return {
    id: substitute(interaction.id),
    kind: interaction.kind,
    prompt: substitute(interaction.prompt),
    render_via: interaction.render_via,
    choices,
    follow_up: followUp,
  }
}

function renderContinuationBlock(onSatisfied, runtimeContext) {
  const { sessionState = null, nextPhase = null } = runtimeContext
  const sticky = onSatisfied.sticky || []
  const hasSticky = Boolean(sessionState && sessionState.autocontinue && sessionState.reviewer)
  // Effective interrupt: manifest says don't interrupt, but if we have no
  // sticky state we must fall back to user prompt (interrupt:true).
  // The manifest's `interrupt:false` is the "happy path" assertion; the runtime
  // downgrades to interrupt:true when sticky is absent.
  const interruptManifest = onSatisfied.interrupt === true
  const interrupt = interruptManifest || !hasSticky

  const sticky_resolved = Object.fromEntries(
    sticky.map((key) => [key, sessionState ? sessionState[key] ?? null : null])
  )

  // Build the concrete command(s) the agent should run.
  let command = null
  let prompt = null
  if (nextPhase) {
    if (hasSticky) {
      command = `specdev reviewloop ${nextPhase} --reviewer=${sessionState.reviewer} --autocontinue`
    } else {
      prompt = {
        pick_reviewer: `specdev reviewloop ${nextPhase} --reviewer=<name> --autocontinue`,
        skip_review: `specdev approve ${nextPhase}`,
        message: `Pick a reviewer for ${nextPhase}:`,
      }
    }
  }

  return {
    next: { ...onSatisfied.next },
    sticky,
    interrupt,
    sticky_resolved,
    next_phase: nextPhase,
    command,
    prompt,
  }
}

export function findTopLevelInteraction(workflow, id) {
  const list = Array.isArray(workflow?.interactions) ? workflow.interactions : []
  return list.find((entry) => entry && entry.id === id) || null
}

/**
 * Resolve the next phase that follows the given completed phase, based on the
 * canonical phase order declared by the manifest. Returns null when there is
 * no successor (terminal phase) or when the input is unknown.
 */
export function nextPhaseAfter(workflow, completedPhase) {
  const order = ['brainstorm', 'breakdown', 'implementation']
  const idx = order.indexOf(completedPhase)
  if (idx === -1 || idx === order.length - 1) return null
  // Skip phases that have no gate — agents auto-advance through them.
  for (let i = idx + 1; i < order.length; i++) {
    const phase = order[i]
    const phaseDef = workflow?.phases?.[phase]
    if (!phaseDef || !Array.isArray(phaseDef.steps)) continue
    const hasGate = phaseDef.steps.some((s) => s && s.kind === 'gate')
    if (hasGate) return phase
  }
  return null
}

/**
 * Find a phase's gate step.
 */
export function findGateStep(workflow, phase) {
  const steps = workflow?.phases?.[phase]?.steps
  if (!Array.isArray(steps)) return null
  return steps.find((s) => s && s.kind === 'gate') || null
}
