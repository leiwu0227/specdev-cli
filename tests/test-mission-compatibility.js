import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parse as parseYaml, stringify } from 'yaml'
import { readCheckpoint, writeCheckpoint } from 'ripplegraph'
import {
  evaluateMissionCompatibility,
  evaluateMissionTransitionCompatibility,
} from '../src/utils/mission-compatibility.js'
import {
  migrateActiveMission,
  MissionMigrationInterruptionError,
} from '../src/utils/mission-migration.js'
import { missionChildFollowUp } from '../src/utils/mission.js'
import { installWorkspaceEngine } from '../src/utils/engine.js'

const repoRoot = resolve(import.meta.dirname, '..')
const bin = join(repoRoot, 'bin', 'specdev.js')
const sourceGraphPath = join(
  repoRoot,
  'templates',
  '.specdev',
  'workflows',
  'mission-lifecycle',
  'graph.json'
)
const assignmentGraphPath = join(
  repoRoot,
  'templates',
  '.specdev',
  'workflows',
  'assignment-lifecycle',
  'graph.json'
)
const dispatcherGraphPath = join(
  repoRoot,
  'templates',
  '.specdev',
  'workflows',
  'workspace-dispatcher',
  'graph.json'
)
const roots = []

function fixture(version, mutateGraph = (graph) => graph) {
  const root = mkdtempSync(join(tmpdir(), `specdev-mission-compatibility-${version}-`))
  roots.push(root)
  const specdevPath = join(root, '.specdev')
  const missionPath = join(specdevPath, 'missions', 'M00001_fixture')
  const packageName = `mission-lifecycle@${version}`
  const packagePath = join(specdevPath, 'workflows', packageName)
  mkdirSync(join(missionPath, 'design'), { recursive: true })
  mkdirSync(packagePath, { recursive: true })
  mkdirSync(join(specdevPath, '.ripplegraph'), { recursive: true })
  writeFileSync(
    join(specdevPath, 'workflow.json'),
    `${JSON.stringify(
      {
        id: 'specdev-workspace',
        version: '1.0.0',
        entryGraph: 'workspace-dispatcher',
      },
      null,
      2
    )}\n`,
    'utf8'
  )
  writeFileSync(
    join(specdevPath, '.ripplegraph', 'current.json'),
    '{"focusedRunId":null}\n',
    'utf8'
  )

  const graph = mutateGraph(JSON.parse(readFileSync(sourceGraphPath, 'utf8')))
  graph.version = version
  writeFileSync(join(packagePath, 'graph.json'), `${JSON.stringify(graph, null, 2)}\n`, 'utf8')
  if (version !== '1.4.0') {
    const targetPath = join(specdevPath, 'workflows', 'mission-lifecycle@1.4.0')
    mkdirSync(targetPath, { recursive: true })
    writeFileSync(join(targetPath, 'graph.json'), readFileSync(sourceGraphPath), 'utf8')
  }
  const assignmentPackagePath = join(specdevPath, 'workflows', 'assignment-lifecycle@2.2.0')
  mkdirSync(assignmentPackagePath, { recursive: true })
  writeFileSync(
    join(assignmentPackagePath, 'graph.json'),
    readFileSync(assignmentGraphPath),
    'utf8'
  )
  const dispatcherPackagePath = join(specdevPath, 'workflows', 'workspace-dispatcher@1.0.0')
  mkdirSync(dispatcherPackagePath, { recursive: true })
  writeFileSync(
    join(dispatcherPackagePath, 'graph.json'),
    readFileSync(dispatcherGraphPath),
    'utf8'
  )
  writeFileSync(
    join(specdevPath, 'workflows', 'catalog.json'),
    `${JSON.stringify(
      {
        version: 1,
        packages: {
          'assignment-lifecycle': {
            id: 'assignment-lifecycle',
            version: '2.2.0',
            kind: 'workflow',
            path: 'assignment-lifecycle@2.2.0',
          },
          'mission-lifecycle': {
            id: 'mission-lifecycle',
            version: '1.4.0',
            kind: 'workflow',
            path: 'mission-lifecycle@1.4.0',
          },
          'workspace-dispatcher': {
            id: 'workspace-dispatcher',
            version: '1.0.0',
            kind: 'dispatcher',
            path: 'workspace-dispatcher@1.0.0',
          },
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  )
  installWorkspaceEngine(root)

  const mission = {
    version: 1,
    id: 'M00001',
    objective: 'Exercise Mission compatibility',
    status: 'running',
    run_id: `mission-compatibility-${version.replaceAll('.', '-')}`,
    branch: 'main',
    base_branch: 'main',
    created_at: '2026-08-01T00:00:00.000Z',
    approved_at: '2026-08-01T00:01:00.000Z',
    approved_contract_hash: 'approved-contract-sha256',
    next_action: 'Continue the Mission.',
  }
  writeFileSync(join(missionPath, 'mission.yaml'), stringify(mission), 'utf8')
  writeFileSync(
    join(missionPath, 'design', 'assignments.yaml'),
    stringify({ version: 2, design_mode: 'single', assignments: [] }),
    'utf8'
  )
  writeCheckpoint(specdevPath, {
    runId: mission.run_id,
    status: 'active',
    rootGraph: 'mission-lifecycle',
    workflow: { id: 'specdev', version: '1' },
    position: { graph: 'mission-lifecycle', node: 'mission-review' },
    createdAt: mission.created_at,
    updatedAt: mission.approved_at,
    outputs: {},
    gateDecisions: {},
    graphSource: {
      kind: 'package',
      graphId: 'mission-lifecycle',
      graphVersion: version,
      packagePath: `workflows/${packageName}`,
    },
    stack: [],
    frameCounter: 0,
  })

  runGit(root, ['init', '--quiet'])
  runGit(root, ['config', 'user.name', 'SpecDev Test'])
  runGit(root, ['config', 'user.email', 'specdev@example.test'])
  writeFileSync(join(root, 'README.md'), '# Mission compatibility fixture\n', 'utf8')
  runGit(root, ['add', '--all'])
  runGit(root, ['commit', '--quiet', '-m', 'fixture'])
  runGit(root, ['branch', '-M', 'main'])
  return { root, specdevPath, missionPath, mission }
}

function run(cwd, args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  })
  assert.equal(
    result.status,
    expectedStatus,
    `${args.join(' ')} exited ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  )
  return result
}

function runGit(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  assert.equal(result.status, 0, `git ${args.join(' ')} failed:\n${result.stderr}`)
}

function runJson(root, args) {
  const result = run(root, args)
  return JSON.parse(result.stdout)
}

function knownLegacyGraph(graph) {
  graph.nodes['mission-review'].outputSchema.properties.disposition.enum = [
    'approved',
    'nonblocking-override',
    'repair',
    'objective-failure',
  ]
  graph.nodes['mission-review'].edges.at(-1).when.disposition = 'objective-failure'
  return graph
}

function replanLegacyGraph(graph) {
  knownLegacyGraph(graph)
  graph.nodes.replan = structuredClone(graph.nodes['resolve-gap'])
  delete graph.nodes['resolve-gap']
  for (const node of Object.values(graph.nodes)) {
    for (const edge of node.edges || []) {
      if (edge.to === 'resolve-gap') edge.to = 'replan'
    }
  }
  return graph
}

function readMission(path) {
  return parseYaml(readFileSync(join(path, 'mission.yaml'), 'utf8'))
}

function writeMission(path, mission) {
  writeFileSync(join(path, 'mission.yaml'), stringify(mission), 'utf8')
}

function migrationContext(value) {
  return {
    specdevPath: value.specdevPath,
    missionPath: value.missionPath,
    mission: value.mission,
  }
}

function prepareEvidenceClosure(value) {
  const mission = readMission(value.missionPath)
  mission.gaps = {
    version: 1,
    processed_signals: ['arbiter:gap-evidence'],
    items: [
      {
        id: 'gap-evidence',
        source: { kind: 'mission-review', id: 'convergence', key: 'mission-review:convergence' },
        status: 'closed',
        stage: 'arbiter',
        disposition: 'evidence-closed',
        assignments: [],
        signals: ['arbiter:gap-evidence'],
        evidence: '.specdev/missions/M00001_fixture/review/gap-evidence-arbiter-result.md',
      },
    ],
  }
  mission.pending_transition = {
    node: 'replan',
    output: {
      queue: '.specdev/missions/M00001_fixture/design/assignments.yaml',
      reason: 'mission-review:convergence',
      gap_id: 'gap-evidence',
      stage: 'arbiter',
      attempt: 'Attempt-00009',
      disposition: 'evidence-closed',
      gap_open: false,
      remaining: false,
      parallel: false,
    },
  }
  writeMission(value.missionPath, mission)
  value.mission = mission
  const checkpoint = readCheckpoint(value.specdevPath, value.mission.run_id)
  checkpoint.position.node = 'replan'
  writeCheckpoint(value.specdevPath, checkpoint)
  return value
}

function prepareTerminalRecovery(value, mutate = () => {}) {
  const command = `node -e "require('node:fs').writeFileSync('verification-reran', 'unexpected')"`
  const gapId = 'gap-evidence'
  const attemptId = 'Attempt-00009'
  const reason =
    `Pinned Mission graph cannot route evidence closure for gap ${gapId}` +
    '; ending with an explicit infrastructure failure.'
  const contract = `# Mission contract

## Objective and context

Recover one historical compatibility failure.

## Scope and non-goals

- In scope: terminal recovery.

## Expected behavior

Evidence is reused without a provider rerun.

## Important decisions

- Fail closed.

## Constraints and invariants

- Preserve durable evidence.

## Delegated and reserved authority

- Delegated: fixture recovery.

## Risks and assumptions

- Historical evidence must agree.

## Verification authority

- Focused fixture only.

## Acceptance criteria

- AC-1: The exact candidate recovers.

## Mission execution shape

- Initial child plan: single

## Final integrated verification

- Command: \`${command}\`
`
  mkdirSync(join(value.missionPath, 'brainstorm'), { recursive: true })
  mkdirSync(join(value.missionPath, 'review'), { recursive: true })
  writeFileSync(join(value.missionPath, 'brainstorm', 'contract.md'), contract, 'utf8')

  const mission = readMission(value.missionPath)
  mission.status = 'failed'
  mission.disposition = 'infrastructure-failure'
  mission.blocker = reason
  mission.failed_at = '2026-08-01T00:10:00.000Z'
  mission.next_action = null
  mission.approved_contract_hash = createHash('sha256').update(contract).digest('hex')
  mission.gaps = {
    version: 1,
    processed_signals: ['arbiter:gap-evidence'],
    items: [
      {
        id: gapId,
        source: {
          kind: 'mission-review',
          id: 'convergence',
          key: 'mission-review:convergence',
        },
        status: 'failed',
        stage: 'arbiter',
        disposition: 'infrastructure-failure',
        reason,
        assignments: [],
        signals: ['arbiter:gap-evidence'],
        evidence: attemptId,
        failed_at: '2026-08-01T00:10:00.000Z',
        updated_at: '2026-08-01T00:10:00.000Z',
      },
    ],
  }
  mission.gap_summary = {
    opened: 1,
    closed: 0,
    failed: 1,
    dispositions: { 'infrastructure-failure': 1 },
  }
  writeMission(value.missionPath, mission)
  value.mission = mission
  writeFileSync(
    join(value.missionPath, 'design', 'assignments.yaml'),
    stringify({
      version: 2,
      design_mode: 'single',
      assignments: [
        {
          id: '00001',
          title: 'Delivered child',
          kind: 'bugfix',
          wave: 1,
          status: 'completed',
        },
      ],
      final_verification: { command, scope: 'integrated' },
    }),
    'utf8'
  )

  const arbiterRelative = `.specdev/missions/M00001_fixture/review/${gapId}-arbiter-result.md`
  writeFileSync(
    join(value.missionPath, 'review', `${gapId}-arbiter-result.md`),
    '---\nverdict: approved\nmaterial_divergence: false\n---\n\n## Findings\n\nExisting evidence closes the gap.\n',
    'utf8'
  )
  mkdirSync(join(value.specdevPath, 'processes'), { recursive: true })
  writeFileSync(
    join(value.specdevPath, 'processes', `${attemptId}.yaml`),
    stringify({
      id: attemptId,
      kind: 'reviewer',
      status: 'completed',
      workspace: '.',
      provider: 'fixture-provider',
      result_path: arbiterRelative,
      mission: mission.id,
      started_at: '2026-08-01T00:08:00.000Z',
      ended_at: '2026-08-01T00:09:00.000Z',
    }),
    'utf8'
  )
  writeFileSync(
    join(value.missionPath, 'review', 'final-verification.json'),
    `${JSON.stringify(
      {
        command,
        revision: 'historical-checkpoint-revision',
        scope: 'integrated',
        status: 'passed',
        duration_ms: 17,
        completed_at: '2026-08-01T00:09:30.000Z',
      },
      null,
      2
    )}\n`,
    'utf8'
  )
  writeFileSync(
    join(value.missionPath, 'review', 'historical-checkpoint.json'),
    '{"revision":"historical-checkpoint-revision","clean":true}\n',
    'utf8'
  )
  writeFileSync(
    join(value.missionPath, 'status.json'),
    `${JSON.stringify(
      {
        version: 1,
        status: 'failed',
        failed_at: mission.failed_at,
        disposition: 'infrastructure-failure',
        reason,
      },
      null,
      2
    )}\n`,
    'utf8'
  )

  const legacyOutput = {
    queue: '.specdev/missions/M00001_fixture/design/assignments.yaml',
    reason: 'mission-review:convergence',
    gap_id: gapId,
    stage: 'arbiter',
    attempt: attemptId,
    disposition: 'objective-failure',
    gap_open: false,
    remaining: false,
    parallel: false,
  }
  const checkpoint = readCheckpoint(value.specdevPath, mission.run_id)
  checkpoint.status = 'completed'
  checkpoint.position = { graph: 'mission-lifecycle', node: 'failed' }
  checkpoint.outputs.replan = legacyOutput
  checkpoint.finalOutput = legacyOutput
  writeCheckpoint(value.specdevPath, checkpoint)
  const runPath = join(value.specdevPath, '.ripplegraph', 'runs', mission.run_id)
  mkdirSync(join(runPath, 'artifacts', 'replan'), { recursive: true })
  writeFileSync(
    join(runPath, 'artifacts', 'replan', 'output.json'),
    `${JSON.stringify(legacyOutput, null, 2)}\n`,
    'utf8'
  )
  writeFileSync(
    join(runPath, 'transition-log.jsonl'),
    `${JSON.stringify({
      ts: '2026-08-01T00:10:00.000Z',
      op: 'step',
      runId: mission.run_id,
      from: { graph: 'mission-lifecycle', node: 'replan' },
      to: { graph: 'mission-lifecycle', node: 'failed' },
      actor: 'agent',
      input: { artifact: 'artifacts/replan/output.json' },
      output: { artifact: 'artifacts/replan/output.json' },
      validation: { ok: true },
      gateDecision: null,
      reason: null,
      error: null,
    })}\n`,
    'utf8'
  )
  writeFileSync(
    join(value.missionPath, 'outcome.md'),
    `# Mission outcome\n\n## Delivery\n\nInfrastructure terminal failure: ${reason}\n`,
    'utf8'
  )
  mutate({ value, mission, checkpoint, gap: mission.gaps.items[0], reason, gapId })
  return value
}

try {
  const followUpRoot = mkdtempSync(join(tmpdir(), 'specdev-child-follow-up-'))
  roots.push(followUpRoot)
  const followUpSpecdevPath = join(followUpRoot, '.specdev')
  const followUpAssignmentPath = join(
    followUpSpecdevPath,
    'assignments',
    '00001_verification_receipts'
  )
  mkdirSync(join(followUpAssignmentPath, 'implementation'), { recursive: true })
  const failedReceipt = {
    command: 'npm run test:mission-compatibility',
    revision: 'working-tree@5bf905e3ef55d418211c5427c8b499a00ef64765',
    scope:
      'integrated Mission compatibility regression; exposed missing workflow registry setup in the new terminal fixture',
    status: 'failed',
    duration_ms: 2806,
  }
  const passedReceipt = {
    ...failedReceipt,
    scope:
      'integrated Mission compatibility regression after installing the fixture workflow registry',
    status: 'passed',
    duration_ms: 5691,
  }
  const writeFollowUpDelivery = ({ verification, follow_up = 'none', outcome = 'Passed' }) => {
    writeFileSync(
      join(followUpAssignmentPath, 'implementation', 'progress.json'),
      `${JSON.stringify({ verification, follow_up }, null, 2)}\n`,
      'utf8'
    )
    writeFileSync(
      join(followUpAssignmentPath, 'outcome.md'),
      `| Acceptance | Evidence | Result |\n| --- | --- | --- |\n| AC-1 | fixture | ${outcome} |\n`,
      'utf8'
    )
  }
  const followUpChild = { folder: '00001_verification_receipts' }

  writeFollowUpDelivery({ verification: [failedReceipt, passedReceipt] })
  assert.equal(await missionChildFollowUp(followUpSpecdevPath, followUpChild), 'none')
  assert.deepEqual(
    JSON.parse(
      readFileSync(join(followUpAssignmentPath, 'implementation', 'progress.json'), 'utf8')
    ).verification,
    [failedReceipt, passedReceipt]
  )

  writeFollowUpDelivery({ verification: [failedReceipt, passedReceipt, failedReceipt] })
  assert.equal(await missionChildFollowUp(followUpSpecdevPath, followUpChild), 'required')

  for (const unrelatedPass of [
    { ...passedReceipt, command: 'node other-check.js' },
    { ...passedReceipt, revision: 'working-tree@def456' },
  ]) {
    writeFollowUpDelivery({ verification: [failedReceipt, unrelatedPass] })
    assert.equal(await missionChildFollowUp(followUpSpecdevPath, followUpChild), 'required')
  }

  writeFollowUpDelivery({
    verification: [failedReceipt, passedReceipt],
    follow_up: 'required',
  })
  assert.equal(await missionChildFollowUp(followUpSpecdevPath, followUpChild), 'required')

  for (const outcome of ['Failed', 'Blocked']) {
    writeFollowUpDelivery({
      verification: [failedReceipt, passedReceipt],
      outcome,
    })
    assert.equal(await missionChildFollowUp(followUpSpecdevPath, followUpChild), 'required')
  }

  const known = fixture('1.3.0', knownLegacyGraph)
  const knownMissionBefore = readFileSync(join(known.missionPath, 'mission.yaml'), 'utf8')
  const knownCheckpointBefore = readFileSync(
    join(known.specdevPath, '.ripplegraph', 'runs', known.mission.run_id, 'checkpoint.json'),
    'utf8'
  )
  const knownRun = runJson(known.root, ['mission', 'run', 'M00001', '--json'])
  assert.equal(knownRun.status, 'migration-required')
  assert.equal(knownRun.next_action, 'specdev mission migrate M00001')
  assert.equal(knownRun.compatibility.migration.from, 'mission-lifecycle@1.3.0')
  assert.equal(existsSync(join(known.specdevPath, 'processes')), false)
  assert.equal(readFileSync(join(known.missionPath, 'mission.yaml'), 'utf8'), knownMissionBefore)
  assert.equal(
    readFileSync(
      join(known.specdevPath, '.ripplegraph', 'runs', known.mission.run_id, 'checkpoint.json'),
      'utf8'
    ),
    knownCheckpointBefore
  )
  const knownHuman = run(known.root, ['mission', 'run', 'M00001']).stdout
  assert.match(knownHuman, /Mission M00001: migration-required/)
  assert.match(knownHuman, /specdev mission migrate M00001/)
  assert.equal(
    evaluateMissionTransitionCompatibility({
      specdevPath: known.specdevPath,
      mission: known.mission,
      node: 'mission-review',
      output: {
        approved: false,
        verdict: 'review/mission-verdict.md',
        attempt: 'Attempt-00001',
        disposition: 'semantic-failure',
      },
    }).status,
    'migration-required'
  )

  const unknown = fixture('9.9.0', knownLegacyGraph)
  const unknownStatus = runJson(unknown.root, ['mission', 'status', 'M00001', '--json'])
  assert.equal(unknownStatus.status, 'workflow-incompatible')
  assert.equal(unknownStatus.compatibility.graph.version, '9.9.0')
  assert.match(unknownStatus.next_action, /specdev mission status M00001 --json/)
  assert.match(unknownStatus.blocker, /workflow-incompatible/)

  const compatible = fixture('1.4.0')
  const compatibleResult = evaluateMissionCompatibility({
    specdevPath: compatible.specdevPath,
    mission: compatible.mission,
  })
  assert.equal(compatibleResult.status, 'compatible')
  const compatibleStatus = runJson(compatible.root, ['mission', 'status', 'M00001', '--json'])
  assert.equal(compatibleStatus.status, 'running')
  assert.equal(compatibleStatus.compatibility.status, 'compatible')

  const lateMismatch = evaluateMissionTransitionCompatibility({
    specdevPath: compatible.specdevPath,
    mission: compatible.mission,
    node: 'mission-review',
    output: {
      approved: false,
      verdict: 'review/mission-verdict.md',
      attempt: 'Attempt-00001',
      disposition: 'future-controller-outcome',
    },
  })
  assert.equal(lateMismatch.status, 'workflow-incompatible')
  assert.match(lateMismatch.diagnostics[0], /rejects a controller output/)

  const preserved = fixture('1.3.0', knownLegacyGraph)
  const preservedMission = readMission(preserved.missionPath)
  preservedMission.child_deliveries = [{ assignment: '00001', revision: 'delivery-sha' }]
  preservedMission.verification = {
    command: 'node focused-check.js',
    revision: 'verified-sha',
    status: 'passed',
  }
  preservedMission.gaps = { version: 1, items: [], processed_signals: [] }
  writeMission(preserved.missionPath, preservedMission)
  preserved.mission = preservedMission
  writeFileSync(
    join(preserved.missionPath, 'design', 'assignments.yaml'),
    stringify({
      version: 2,
      design_mode: 'single',
      assignments: [
        {
          id: '00001',
          title: 'Delivered child',
          status: 'integrated',
          delivery_revision: 'delivery-sha',
        },
      ],
      final_verification: { command: 'node focused-check.js', scope: 'integrated' },
    }),
    'utf8'
  )
  const preservedCheckpoint = readCheckpoint(preserved.specdevPath, preserved.mission.run_id)
  preservedCheckpoint.outputs = {
    brainstorm: { contract_hash: preservedMission.approved_contract_hash },
    'final-verification': { receipt: 'review/final-verification.json', passed: true },
  }
  preservedCheckpoint.gateDecisions = {
    'approve-mission': { approved: true, contract_hash: preservedMission.approved_contract_hash },
  }
  writeCheckpoint(preserved.specdevPath, preservedCheckpoint)
  const runPath = join(preserved.specdevPath, '.ripplegraph', 'runs', preserved.mission.run_id)
  mkdirSync(join(runPath, 'artifacts', 'final-verification'), { recursive: true })
  writeFileSync(
    join(runPath, 'artifacts', 'final-verification', 'output.json'),
    '{"passed":true,"receipt":"review/final-verification.json"}\n',
    'utf8'
  )
  writeFileSync(
    join(runPath, 'transition-log.jsonl'),
    '{"preserved":"transition-history"}\n',
    'utf8'
  )
  mkdirSync(join(preserved.specdevPath, 'processes'), { recursive: true })
  writeFileSync(
    join(preserved.specdevPath, 'processes', 'Attempt-00001.yaml'),
    'id: Attempt-00001\nkind: worker\nstatus: completed\nworkspace: .\nmission: M00001\n',
    'utf8'
  )
  const preservedBytes = Object.fromEntries(
    [
      ['mission', join(preserved.missionPath, 'mission.yaml')],
      ['queue', join(preserved.missionPath, 'design', 'assignments.yaml')],
      ['attempt', join(preserved.specdevPath, 'processes', 'Attempt-00001.yaml')],
      ['artifact', join(runPath, 'artifacts', 'final-verification', 'output.json')],
      ['transitions', join(runPath, 'transition-log.jsonl')],
    ].map(([id, path]) => [id, readFileSync(path, 'utf8')])
  )
  const migrated = runJson(preserved.root, ['mission', 'migrate', 'M00001', '--json'])
  assert.equal(migrated.status, 'migrated')
  assert.equal(migrated.from.version, '1.3.0')
  assert.equal(migrated.to.version, '1.4.0')
  assert.equal(migrated.resumed, false)
  assert.equal(migrated.already_migrated, false)
  for (const [id, path] of [
    ['mission', join(preserved.missionPath, 'mission.yaml')],
    ['queue', join(preserved.missionPath, 'design', 'assignments.yaml')],
    ['attempt', join(preserved.specdevPath, 'processes', 'Attempt-00001.yaml')],
    ['artifact', join(runPath, 'artifacts', 'final-verification', 'output.json')],
    ['transitions', join(runPath, 'transition-log.jsonl')],
  ]) {
    assert.equal(readFileSync(path, 'utf8'), preservedBytes[id])
  }
  const migratedCheckpoint = readCheckpoint(preserved.specdevPath, preserved.mission.run_id)
  assert.equal(migratedCheckpoint.runId, preservedCheckpoint.runId)
  assert.equal(migratedCheckpoint.graphSource.graphVersion, '1.4.0')
  assert.deepEqual(migratedCheckpoint.outputs, preservedCheckpoint.outputs)
  assert.deepEqual(migratedCheckpoint.gateDecisions, preservedCheckpoint.gateDecisions)
  assert.equal(migratedCheckpoint.createdAt, preservedCheckpoint.createdAt)
  const completedJournalPath = join(runPath, 'mission-migration.json')
  const completedJournalBefore = readFileSync(completedJournalPath, 'utf8')
  const idempotent = runJson(preserved.root, ['mission', 'migrate', 'M00001', '--json'])
  assert.equal(idempotent.already_migrated, true)
  assert.equal(readFileSync(completedJournalPath, 'utf8'), completedJournalBefore)

  const nested = fixture('1.3.0', knownLegacyGraph)
  const nestedCheckpoint = readCheckpoint(nested.specdevPath, nested.mission.run_id)
  nestedCheckpoint.position = { graph: 'assignment-lifecycle', node: 'implementation' }
  nestedCheckpoint.stack = [
    {
      parent: {
        graph: 'mission-lifecycle',
        node: 'child-assignment',
        graphSource: nestedCheckpoint.graphSource,
        scope: '',
      },
      child: {
        kind: 'package',
        graphId: 'assignment-lifecycle',
        graphVersion: '2.2.0',
        packagePath: 'workflows/assignment-lifecycle@2.2.0',
      },
      scope: 'f1',
      enteredAt: nested.mission.created_at,
    },
  ]
  nestedCheckpoint.frameCounter = 1
  writeCheckpoint(nested.specdevPath, nestedCheckpoint)
  await migrateActiveMission(migrationContext(nested))
  const nestedMigrated = readCheckpoint(nested.specdevPath, nested.mission.run_id)
  assert.deepEqual(nestedMigrated.position, nestedCheckpoint.position)
  assert.equal(nestedMigrated.stack[0].scope, 'f1')
  assert.equal(nestedMigrated.stack[0].parent.graphSource.graphVersion, '1.4.0')
  assert.deepEqual(nestedMigrated.stack[0].child, nestedCheckpoint.stack[0].child)

  const evidence = prepareEvidenceClosure(fixture('1.3.0', replanLegacyGraph))
  const evidenceResult = await migrateActiveMission(migrationContext(evidence))
  assert.equal(evidenceResult.evidence_transition_reused, true)
  assert.equal(
    readCheckpoint(evidence.specdevPath, evidence.mission.run_id).position.node,
    'resolve-gap'
  )
  const migratedEvidenceMission = readMission(evidence.missionPath)
  assert.equal(migratedEvidenceMission.pending_transition.node, 'resolve-gap')
  assert.equal(migratedEvidenceMission.pending_transition.output.disposition, 'evidence-closed')
  assert.equal(migratedEvidenceMission.pending_transition.output.attempt, 'Attempt-00009')
  assert.equal(existsSync(join(evidence.specdevPath, 'processes')), false)

  for (const boundary of [
    'journal-prepared',
    'mission-written',
    'mission-progress-recorded',
    'checkpoint-written',
    'checkpoint-progress-recorded',
    'journal-completed',
  ]) {
    const interrupted = prepareEvidenceClosure(fixture('1.3.0', replanLegacyGraph))
    await assert.rejects(
      migrateActiveMission({ ...migrationContext(interrupted), interruptAfter: boundary }),
      (error) => error instanceof MissionMigrationInterruptionError && error.boundary === boundary
    )
    const resumed = await migrateActiveMission(migrationContext(interrupted))
    assert.equal(resumed.already_migrated, boundary === 'journal-completed')
    assert.equal(
      readCheckpoint(interrupted.specdevPath, interrupted.mission.run_id).graphSource.graphVersion,
      '1.4.0'
    )
    const resumedMission = readMission(interrupted.missionPath)
    assert.equal(resumedMission.pending_transition.node, 'resolve-gap')
    assert.equal(resumedMission.pending_transition.output.disposition, 'evidence-closed')
    assert.equal(resumedMission.pending_transition.output.attempt, 'Attempt-00009')
    assert.equal(existsSync(join(interrupted.specdevPath, 'processes')), false)
    const journalPath = join(
      interrupted.specdevPath,
      '.ripplegraph',
      'runs',
      interrupted.mission.run_id,
      'mission-migration.json'
    )
    const journal = JSON.parse(readFileSync(journalPath, 'utf8'))
    assert.equal(journal.status, 'completed')
    assert.deepEqual(journal.write_progress, {
      journal_prepared: true,
      mission_updated: true,
      checkpoint_updated: true,
      completed: true,
    })
    const stableJournal = readFileSync(journalPath, 'utf8')
    await migrateActiveMission(migrationContext(interrupted))
    assert.equal(readFileSync(journalPath, 'utf8'), stableJournal)
  }

  const terminal = prepareTerminalRecovery(fixture('1.3.0', replanLegacyGraph))
  const terminalRunPath = join(
    terminal.specdevPath,
    '.ripplegraph',
    'runs',
    terminal.mission.run_id
  )
  const preservedTerminalEvidence = Object.fromEntries(
    [
      ['arbiter', join(terminal.missionPath, 'review', 'gap-evidence-arbiter-result.md')],
      ['verification', join(terminal.missionPath, 'review', 'final-verification.json')],
      ['checkpoint', join(terminal.missionPath, 'review', 'historical-checkpoint.json')],
      ['transition', join(terminalRunPath, 'transition-log.jsonl')],
      ['legacy-output', join(terminalRunPath, 'artifacts', 'replan', 'output.json')],
      ['attempt', join(terminal.specdevPath, 'processes', 'Attempt-00009.yaml')],
    ].map(([id, path]) => [id, { path, bytes: readFileSync(path, 'utf8') }])
  )
  const terminalMigration = runJson(terminal.root, ['mission', 'migrate', 'M00001', '--json'])
  assert.equal(terminalMigration.status, 'migrated')
  assert.equal(terminalMigration.terminal_recovery, true)
  assert.equal(terminalMigration.evidence_transition_reused, true)
  const recoveredMission = readMission(terminal.missionPath)
  assert.equal(recoveredMission.status, 'paused')
  assert.equal(recoveredMission.disposition, undefined)
  assert.equal(recoveredMission.blocker, undefined)
  assert.equal(recoveredMission.gaps.items[0].status, 'closed')
  assert.equal(recoveredMission.gaps.items[0].disposition, 'evidence-closed')
  assert.equal(
    recoveredMission.gaps.items[0].evidence,
    '.specdev/missions/M00001_fixture/review/gap-evidence-arbiter-result.md'
  )
  assert.equal(recoveredMission.pending_transition.node, 'mission-review')
  assert.equal(recoveredMission.pending_transition.output.approved, true)
  assert.equal(recoveredMission.terminal_recovery.gap_id, 'gap-evidence')
  const recoveredCheckpoint = readCheckpoint(terminal.specdevPath, terminal.mission.run_id)
  assert.equal(recoveredCheckpoint.status, 'suspended')
  assert.equal(recoveredCheckpoint.position.node, 'mission-review')
  assert.equal(recoveredCheckpoint.graphSource.graphVersion, '1.4.0')
  assert.equal(recoveredCheckpoint.outputs['resolve-gap'].disposition, 'evidence-closed')
  assert.equal(recoveredCheckpoint.outputs.replan.disposition, 'objective-failure')
  assert.equal(
    JSON.parse(readFileSync(join(terminal.missionPath, 'status.json'), 'utf8')).status,
    'paused'
  )
  for (const { path, bytes } of Object.values(preservedTerminalEvidence)) {
    assert.equal(readFileSync(path, 'utf8'), bytes)
  }
  assert.equal(existsSync(join(terminal.root, 'verification-reran')), false)

  const terminalCompleted = runJson(terminal.root, ['mission', 'run', 'M00001', '--json'])
  assert.equal(terminalCompleted.status, 'completed')
  assert.ok(terminalCompleted.final_revision)
  assert.equal(existsSync(join(terminal.root, 'verification-reran')), false)
  const completedTerminalMission = readMission(terminal.missionPath)
  assert.equal(completedTerminalMission.status, 'completed')
  assert.equal(completedTerminalMission.activity.provider_attempt_count, 1)
  assert.match(readFileSync(join(terminal.missionPath, 'outcome.md'), 'utf8'), /Evidence-closed: 1/)
  for (const id of ['arbiter', 'verification', 'checkpoint']) {
    const evidence = preservedTerminalEvidence[id]
    assert.equal(readFileSync(evidence.path, 'utf8'), evidence.bytes)
  }

  for (const boundary of [
    'journal-prepared',
    'mission-written',
    'mission-progress-recorded',
    'status-written',
    'status-progress-recorded',
    'checkpoint-written',
    'checkpoint-progress-recorded',
    'journal-completed',
  ]) {
    const interrupted = prepareTerminalRecovery(fixture('1.3.0', replanLegacyGraph))
    await assert.rejects(
      migrateActiveMission({ ...migrationContext(interrupted), interruptAfter: boundary }),
      (error) => error instanceof MissionMigrationInterruptionError && error.boundary === boundary
    )
    const resumed = await migrateActiveMission(migrationContext(interrupted))
    assert.equal(resumed.terminal_recovery, true)
    assert.equal(resumed.already_migrated, boundary === 'journal-completed')
    assert.equal(readMission(interrupted.missionPath).status, 'paused')
    assert.equal(
      readCheckpoint(interrupted.specdevPath, interrupted.mission.run_id).position.node,
      'mission-review'
    )
    assert.equal(
      JSON.parse(readFileSync(join(interrupted.missionPath, 'status.json'), 'utf8')).status,
      'paused'
    )
    const journalPath = join(
      interrupted.specdevPath,
      '.ripplegraph',
      'runs',
      interrupted.mission.run_id,
      'mission-migration.json'
    )
    const journal = JSON.parse(readFileSync(journalPath, 'utf8'))
    assert.equal(journal.status, 'completed')
    assert.equal(journal.recovery.kind, 'terminal-evidence-closure')
    assert.deepEqual(journal.write_progress, {
      journal_prepared: true,
      mission_updated: true,
      status_updated: true,
      checkpoint_updated: true,
      completed: true,
    })
  }

  const rejectedTerminalCases = [
    {
      name: 'genuine semantic failure',
      mutate: ({ value, mission }) => {
        mission.disposition = 'semantic-failure'
        writeMission(value.missionPath, mission)
      },
    },
    {
      name: 'mismatched signature gap',
      mutate: ({ value, mission, reason }) => {
        mission.blocker = reason.replace('gap-evidence', 'gap-other')
        writeMission(value.missionPath, mission)
      },
    },
    {
      name: 'mismatched gap attempt',
      mutate: ({ value, mission, gap }) => {
        gap.evidence = 'Attempt-00010'
        writeMission(value.missionPath, mission)
      },
    },
    {
      name: 'missing positive arbiter result',
      mutate: ({ value, gapId }) => {
        rmSync(join(value.missionPath, 'review', `${gapId}-arbiter-result.md`))
      },
    },
    {
      name: 'failed final-verification receipt',
      mutate: ({ value }) => {
        const path = join(value.missionPath, 'review', 'final-verification.json')
        const receipt = JSON.parse(readFileSync(path, 'utf8'))
        receipt.status = 'failed'
        writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8')
      },
    },
    {
      name: 'ambiguous gap identity',
      mutate: ({ value, mission, gap }) => {
        mission.gaps.items.push(structuredClone(gap))
        writeMission(value.missionPath, mission)
      },
    },
  ]
  for (const rejectedCase of rejectedTerminalCases) {
    const candidate = prepareTerminalRecovery(
      fixture('1.3.0', replanLegacyGraph),
      rejectedCase.mutate
    )
    const missionPath = join(candidate.missionPath, 'mission.yaml')
    const checkpointPath = join(
      candidate.specdevPath,
      '.ripplegraph',
      'runs',
      candidate.mission.run_id,
      'checkpoint.json'
    )
    const statusPath = join(candidate.missionPath, 'status.json')
    const before = [missionPath, checkpointPath, statusPath].map((path) =>
      readFileSync(path, 'utf8')
    )
    const rejected = run(candidate.root, ['mission', 'migrate', 'M00001', '--json'], 1)
    const error = JSON.parse(rejected.stdout).error
    assert.match(error, /rejected without mutation|duplicate/, rejectedCase.name)
    assert.deepEqual(
      [missionPath, checkpointPath, statusPath].map((path) => readFileSync(path, 'utf8')),
      before,
      rejectedCase.name
    )
    assert.equal(
      existsSync(
        join(
          candidate.specdevPath,
          '.ripplegraph',
          'runs',
          candidate.mission.run_id,
          'mission-migration.json'
        )
      ),
      false,
      rejectedCase.name
    )
  }

  const ambiguous = fixture('1.3.0', replanLegacyGraph)
  const ambiguousCheckpoint = readCheckpoint(ambiguous.specdevPath, ambiguous.mission.run_id)
  ambiguousCheckpoint.position.node = 'replan'
  writeCheckpoint(ambiguous.specdevPath, ambiguousCheckpoint)
  const ambiguousMissionBefore = readFileSync(join(ambiguous.missionPath, 'mission.yaml'), 'utf8')
  const ambiguousCheckpointBefore = readFileSync(
    join(
      ambiguous.specdevPath,
      '.ripplegraph',
      'runs',
      ambiguous.mission.run_id,
      'checkpoint.json'
    ),
    'utf8'
  )
  const ambiguousResult = run(ambiguous.root, ['mission', 'migrate', 'M00001', '--json'], 1)
  assert.match(JSON.parse(ambiguousResult.stdout).error, /cannot infer a resolve-gap position/)
  assert.equal(
    readFileSync(join(ambiguous.missionPath, 'mission.yaml'), 'utf8'),
    ambiguousMissionBefore
  )
  assert.equal(
    readFileSync(
      join(
        ambiguous.specdevPath,
        '.ripplegraph',
        'runs',
        ambiguous.mission.run_id,
        'checkpoint.json'
      ),
      'utf8'
    ),
    ambiguousCheckpointBefore
  )
  assert.equal(
    existsSync(
      join(
        ambiguous.specdevPath,
        '.ripplegraph',
        'runs',
        ambiguous.mission.run_id,
        'mission-migration.json'
      )
    ),
    false
  )

  const unsupportedMissionBefore = readFileSync(join(unknown.missionPath, 'mission.yaml'), 'utf8')
  const unsupportedCheckpointPath = join(
    unknown.specdevPath,
    '.ripplegraph',
    'runs',
    unknown.mission.run_id,
    'checkpoint.json'
  )
  const unsupportedCheckpointBefore = readFileSync(unsupportedCheckpointPath, 'utf8')
  const unsupported = run(unknown.root, ['mission', 'migrate', 'M00001', '--json'], 1)
  assert.match(JSON.parse(unsupported.stdout).error, /Unsupported Mission migration source/)
  assert.equal(
    readFileSync(join(unknown.missionPath, 'mission.yaml'), 'utf8'),
    unsupportedMissionBefore
  )
  assert.equal(readFileSync(unsupportedCheckpointPath, 'utf8'), unsupportedCheckpointBefore)

  console.log('Mission compatibility tests passed.')
} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
}
