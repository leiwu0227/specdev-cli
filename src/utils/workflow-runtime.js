import { join } from 'path'
import fse from 'fs-extra'
import YAML from 'yaml'
import { resolveCurrentAssignment } from './current.js'
import { scanSingleAssignment } from './scan.js'
import { detectAssignmentState } from './state.js'
import { artifactPaths, gateFields, phases as workflowPhases } from './workflow-contract.js'

export const DEFAULT_WORKFLOW = {
  workflow_contract_version: 1,
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
        { id: 'checkpoint', kind: 'command', run: 'specdev checkpoint brainstorm' },
        { id: 'approval', kind: 'gate', gate: 'brainstorm_approved' },
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
        { id: 'checkpoint', kind: 'command', run: 'specdev checkpoint implementation' },
        { id: 'approval', kind: 'gate', gate: 'implementation_approved' },
      ],
    },
    capture: {
      steps: [
        {
          id: 'capture_knowledge',
          kind: 'guide',
          guide: '.specdev/skills/core/knowledge-capture/SKILL.md',
          produces: [
            artifactPaths.capture.projectNotesDiff,
            artifactPaths.capture.workflowDiff,
          ],
        },
      ],
    },
  },
  hooks: [
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

  if (workflow.workflow_contract_version !== 1) {
    errors.push('workflow_contract_version must be 1')
  }

  validateWorkflowPhases(workflow, errors)

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
  requireWorkflowStep(workflow, 'capture', 'capture_knowledge', 'guide', errors)
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
  const detected = await detectAssignmentState(summary, current.path)
  const action = actionForDetectedState(detected.state, workflowInfo.workflow)
  const interaction = interactionForDetectedState(detected.state)
  const hookOutcomes = hookOutcomesForState(workflowInfo.workflow, detected.state)

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
    trace: buildTrace(detected.state),
    blockers: detected.blockers,
    progress: detected.progress,
  }
}

function hookOutcomesForState(workflow, state) {
  if (state !== 'summary_in_progress' || !Array.isArray(workflow.hooks)) {
    return []
  }

  return workflow.hooks
    .filter((hook) => hook.phase === 'implementation' && hook.slot === 'phase:end')
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
        ? 'blocking implementation-end hooks are not executed by this runtime overlay'
        : 'advisory implementation-end hook is available; capture is not blocked',
    }))
}

function interactionForDetectedState(state) {
  if (state === 'brainstorm_checkpoint_ready') {
    return {
      type: 'choice',
      prompt: 'How do you want to proceed from brainstorm?',
      choices: buildReviewChoices('brainstorm'),
    }
  }
  if (state === 'implementation_checkpoint_ready') {
    return {
      type: 'choice',
      prompt: 'How do you want to proceed from implementation?',
      choices: buildReviewChoices('implementation'),
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

function actionForDetectedState(state, workflow) {
  const actionMap = {
    brainstorm_in_progress: {
      phase: 'brainstorm',
      step: 'create_artifacts',
      afterStep: 'checkpoint',
    },
    brainstorm_checkpoint_ready: {
      phase: 'brainstorm',
      step: 'checkpoint',
    },
    breakdown_in_progress: {
      phase: 'breakdown',
      step: 'create_plan',
    },
    implementation_in_progress: {
      phase: 'implementation',
      step: 'execute_plan',
      afterStep: 'checkpoint',
    },
    implementation_checkpoint_ready: {
      phase: 'implementation',
      step: 'checkpoint',
    },
    summary_in_progress: {
      phase: 'capture',
      step: 'capture_knowledge',
    },
  }

  if (actionMap[state]) {
    return actionFromWorkflowStep(workflow, actionMap[state])
  }

  if (state === 'completed') {
    return {
      id: 'assignment.completed',
      phase: null,
      step: null,
      kind: 'none',
      evidence: {},
    }
  }

  return {
    id: 'workflow.inspect',
    phase: null,
    step: null,
    kind: 'inspect',
    evidence: {},
  }
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

function buildTrace(state) {
  const traces = {
    brainstorm_in_progress: [
      'brainstorm artifacts are missing',
      'next action is to run the brainstorm guide',
    ],
    brainstorm_checkpoint_ready: [
      'brainstorm artifacts are present',
      'brainstorm approval gate is pending',
      'next action is to run the brainstorm checkpoint',
    ],
    breakdown_in_progress: [
      'brainstorm gate is approved',
      'breakdown/plan.md is missing',
      'next action is to run the breakdown guide',
    ],
    implementation_in_progress: [
      'breakdown/plan.md is present',
      'implementation progress is missing or incomplete',
      'next action is to run the implementation guide',
    ],
    implementation_checkpoint_ready: [
      'implementation tasks are complete',
      'implementation approval gate is pending',
      'next action is to run the implementation checkpoint',
    ],
    summary_in_progress: [
      'implementation gate is approved',
      'capture artifacts are missing',
      'next action is to run knowledge capture',
    ],
    completed: [
      'all required workflow artifacts are present',
      'assignment appears complete',
    ],
  }
  return traces[state] || ['workflow state requires inspection']
}
