import { resolve, sep } from 'node:path'
import Ajv from 'ajv'
import { loadGraphPackage, readCheckpoint } from 'ripplegraph'
import { readMissionMigrationJournal } from './mission-migration.js'

const CONTROLLER_GRAPH_ID = 'mission-lifecycle'
const CONTROLLER_GRAPH_VERSION = '1.4.0'
const MIGRATABLE_GRAPH_VERSIONS = new Set(['1.3.0'])

const CONTROLLER_OUTPUTS = {
  'create-mission': [{ id: 'M00001', path: '.specdev/missions/example', objective: 'Example' }],
  brainstorm: [{ contract: 'brainstorm/contract.md', contract_hash: 'sha256' }],
  design: [{ queue: 'design/assignments.yaml', attempt: 'Attempt-00001', parallel: false }],
  'execute-wave': [{ wave: 1, completed: ['00001'] }],
  'advance-wave': missionAdvanceOutputs(),
  'advance-queue': missionAdvanceOutputs(),
  'mission-review': [
    missionReviewOutput(true, 'approved'),
    missionReviewOutput(true, 'nonblocking-override'),
    missionReviewOutput(false, 'repair'),
    missionReviewOutput(false, 'semantic-failure'),
  ],
  'resolve-gap': [
    missionGapOutput('resolution-added'),
    missionGapOutput('evidence-closed'),
    missionGapOutput('semantic-failure'),
    missionGapOutput('authority-failure'),
    missionGapOutput('infrastructure-failure'),
  ],
  'final-verification': [
    {
      passed: true,
      receipt: 'review/final-verification.json',
      recoverable: false,
      disposition: 'evidence-closed',
    },
    {
      passed: false,
      receipt: 'review/final-verification.json',
      recoverable: true,
      disposition: 'gap-open',
    },
  ],
}

const CONTROLLER_NODES = new Set([
  ...Object.keys(CONTROLLER_OUTPUTS),
  'approve-mission',
  'child-assignment',
  'done',
  'failed',
])

export class MissionCompatibilityError extends Error {
  constructor(compatibility) {
    super(compatibility.message)
    this.name = 'MissionCompatibilityError'
    this.compatibility = compatibility
  }
}

export function evaluateMissionCompatibility({ specdevPath, mission }) {
  let journal
  try {
    journal = readMissionMigrationJournal(specdevPath, mission.run_id)
  } catch (error) {
    return incompatibleResult(
      mission.id,
      { id: CONTROLLER_GRAPH_ID, version: 'unknown', path: null },
      null,
      [error.message]
    )
  }
  if (journal && journal.status !== 'completed') {
    const command = `specdev mission migrate ${mission.id}`
    return {
      status: 'migration-required',
      compatible: false,
      controller: `${CONTROLLER_GRAPH_ID}@${CONTROLLER_GRAPH_VERSION}`,
      graph: journal.from || { id: CONTROLLER_GRAPH_ID, version: 'unknown', path: null },
      phase: null,
      diagnostics: [`Mission migration is incomplete at ${journal.status || 'unknown'}.`],
      migration: { from: journal.from, to: journal.to, command },
      next_action: command,
      message: `Mission ${mission.id} has an incomplete migration. Resume it with: ${command}`,
    }
  }
  const loaded = loadPinnedMissionGraph(specdevPath, mission.run_id)
  if (!loaded.ok) {
    return incompatibleResult(mission.id, loaded.graph, loaded.phase, [loaded.diagnostic])
  }

  const { graph, graphPackage, phase } = loaded
  const diagnostics = evaluateReachableProtocol(graphPackage.manifest, phase)
  if (diagnostics.length === 0) {
    return {
      status: 'compatible',
      compatible: true,
      controller: `${CONTROLLER_GRAPH_ID}@${CONTROLLER_GRAPH_VERSION}`,
      graph,
      phase,
      diagnostics: [],
      next_action: null,
    }
  }

  if (MIGRATABLE_GRAPH_VERSIONS.has(graph.version)) {
    const command = `specdev mission migrate ${mission.id}`
    return {
      status: 'migration-required',
      compatible: false,
      controller: `${CONTROLLER_GRAPH_ID}@${CONTROLLER_GRAPH_VERSION}`,
      graph,
      phase,
      diagnostics,
      migration: {
        from: `${graph.id}@${graph.version}`,
        to: `${CONTROLLER_GRAPH_ID}@${CONTROLLER_GRAPH_VERSION}`,
        command,
      },
      next_action: command,
      message: `Mission ${mission.id} is pinned to ${graph.id}@${graph.version}, which requires migration before this controller can continue. Run: ${command}`,
    }
  }

  return incompatibleResult(mission.id, graph, phase, diagnostics)
}

export function evaluateMissionTransitionCompatibility({ specdevPath, mission, node, output }) {
  const compatibility = evaluateMissionCompatibility({ specdevPath, mission })
  if (!compatibility.compatible) return compatibility

  const loaded = loadPinnedMissionGraph(specdevPath, mission.run_id)
  if (!loaded.ok) {
    return incompatibleResult(mission.id, loaded.graph, loaded.phase, [loaded.diagnostic])
  }
  if (loaded.phase !== node) {
    return incompatibleResult(mission.id, loaded.graph, loaded.phase, [
      `Controller attempted transition ${node}, but the pinned Mission is at ${loaded.phase}.`,
    ])
  }
  const schema = loaded.graphPackage.manifest.nodes?.[node]?.outputSchema
  const diagnostic = validateOutput(schema, output, node)
  return diagnostic
    ? incompatibleResult(mission.id, loaded.graph, loaded.phase, [diagnostic])
    : compatibility
}

function loadPinnedMissionGraph(specdevPath, runId) {
  let checkpoint
  try {
    checkpoint = readCheckpoint(specdevPath, runId)
  } catch (error) {
    return {
      ok: false,
      graph: { id: CONTROLLER_GRAPH_ID, version: 'unknown', path: null },
      phase: null,
      diagnostic: `Cannot read pinned Mission run ${runId}: ${error.message}`,
    }
  }

  const source = checkpoint.graphSource
  const phase = rootMissionPhase(checkpoint)
  const graph = {
    id: source?.graphId || checkpoint.rootGraph || CONTROLLER_GRAPH_ID,
    version: source?.graphVersion || 'unknown',
    path: source?.packagePath || null,
  }
  if (graph.id !== CONTROLLER_GRAPH_ID || !graph.path) {
    return {
      ok: false,
      graph,
      phase,
      diagnostic: `Pinned run does not identify a ${CONTROLLER_GRAPH_ID} graph package.`,
    }
  }

  const workflowRoot = resolve(specdevPath)
  const packageRoot = resolve(workflowRoot, graph.path)
  if (packageRoot !== workflowRoot && !packageRoot.startsWith(`${workflowRoot}${sep}`)) {
    return {
      ok: false,
      graph,
      phase,
      diagnostic: `Pinned graph package path escapes the workflow root: ${graph.path}`,
    }
  }

  try {
    const graphPackage = loadGraphPackage(packageRoot)
    if (graphPackage.manifest.id !== graph.id || graphPackage.manifest.version !== graph.version) {
      return {
        ok: false,
        graph,
        phase,
        diagnostic: `Pinned graph metadata does not match package ${graph.id}@${graph.version}.`,
      }
    }
    return { ok: true, checkpoint, graph, graphPackage, phase }
  } catch (error) {
    return {
      ok: false,
      graph,
      phase,
      diagnostic: `Cannot load pinned graph package ${graph.id}@${graph.version}: ${error.message}`,
    }
  }
}

function rootMissionPhase(checkpoint) {
  if (checkpoint.position?.graph === CONTROLLER_GRAPH_ID) return checkpoint.position.node || null
  return checkpoint.stack?.[0]?.parent?.node || checkpoint.position?.node || null
}

function evaluateReachableProtocol(graph, phase) {
  if (!phase || !graph.nodes?.[phase]) {
    return [`Pinned graph does not contain the current Mission phase ${phase || 'unknown'}.`]
  }
  const diagnostics = []
  for (const nodeId of reachableNodes(graph, phase)) {
    const node = graph.nodes[nodeId]
    if (!CONTROLLER_NODES.has(nodeId)) {
      diagnostics.push(`Controller does not support reachable pinned node ${nodeId}.`)
      continue
    }
    for (const output of CONTROLLER_OUTPUTS[nodeId] || []) {
      const diagnostic = validateOutput(node.outputSchema, output, nodeId)
      if (diagnostic) {
        diagnostics.push(diagnostic)
        break
      }
    }
  }
  return [...new Set(diagnostics)]
}

function reachableNodes(graph, start) {
  const pending = [start]
  const reached = new Set()
  while (pending.length > 0) {
    const nodeId = pending.shift()
    if (reached.has(nodeId) || !graph.nodes?.[nodeId]) continue
    reached.add(nodeId)
    for (const edge of graph.nodes[nodeId].edges || []) pending.push(edge.to)
  }
  return reached
}

function validateOutput(schema, output, nodeId) {
  if (!schema) return `Reachable node ${nodeId} has no output schema for controller transitions.`
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema)
  if (validate(output)) return null
  const details = (validate.errors || [])
    .map((error) => `${error.instancePath || '<output>'} ${error.message}`)
    .join('; ')
  return `Reachable node ${nodeId} rejects a controller output: ${details || 'schema mismatch'}.`
}

function incompatibleResult(missionId, graph, phase, diagnostics) {
  const command = `specdev mission status ${missionId} --json`
  return {
    status: 'workflow-incompatible',
    compatible: false,
    controller: `${CONTROLLER_GRAPH_ID}@${CONTROLLER_GRAPH_VERSION}`,
    graph,
    phase,
    diagnostics,
    next_action: `Install a SpecDev controller compatible with ${graph.id}@${graph.version}, then rerun ${command}.`,
    message: `Mission ${missionId} is workflow-incompatible with this controller. ${diagnostics.join(' ')}`,
  }
}

function missionAdvanceOutputs() {
  return [
    {
      remaining: true,
      completed: '00001',
      follow_up_required: false,
      gap_open: false,
      parallel: false,
    },
    {
      remaining: false,
      completed: '00001',
      follow_up_required: true,
      gap_open: true,
      gap_id: 'gap-example',
      parallel: false,
    },
  ]
}

function missionReviewOutput(approved, disposition) {
  return {
    approved,
    verdict: 'review/mission-verdict.md',
    attempt: 'Attempt-00001',
    disposition,
  }
}

function missionGapOutput(disposition) {
  return {
    queue: 'design/assignments.yaml',
    reason: 'gap source',
    gap_id: 'gap-example',
    stage: disposition === 'evidence-closed' ? 'arbiter' : 'resolution',
    attempt: 'Attempt-00001',
    disposition,
    gap_open: false,
    remaining: disposition === 'resolution-added',
    parallel: false,
  }
}
