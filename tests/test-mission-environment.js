import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readCheckpoint, writeCheckpoint } from 'ripplegraph'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import {
  appendVerificationReceipt,
  classifyVerificationDisposition,
  closeOrSupersedeFinding,
  deriveMissionExecutionPolicy,
  missionExecutionPolicyTemplate,
  parsePolicyDeclaration,
  scopeMissionFinding,
  selectVerificationExecutor,
} from '../src/utils/mission-execution.js'
import { openMissionGap, supersedeMissionGap } from '../src/utils/mission-gaps.js'
import { recoverPersistedMissionQueueAdvance } from '../src/utils/mission.js'

const CLI = fileURLToPath(new URL('../bin/specdev.js', import.meta.url))
const roots = []

function run(root, args, expected = 0) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd: root,
    encoding: 'utf-8',
  })
  assert.equal(result.status, expected, result.stderr || result.stdout)
  return result.stdout.trim() ? JSON.parse(result.stdout) : null
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf-8' }).trim()
}

function fixtureContract() {
  return `# Mission contract

Kind: change

## Objective and context

Preserve a candidate while recovering blocked evidence.

## Scope and non-goals

- In scope: collect the missing evidence.
- Non-goals: change the candidate.

## Expected behavior

Only unresolved evidence is handed to a fresh Assignment.

## Important decisions

The terminal Mission remains immutable.

## Constraints and invariants

The verification command and candidate revision stay pinned.

## Delegated and reserved authority

- Delegated: collect focused evidence.
- Reserved for the user: approve the successor contract.

## Risks and assumptions

The authorized executor may remain unavailable.

## Verification authority

- The exact command below is authorized.

## Acceptance criteria

- AC-1: Preserve already-satisfied product behavior.
- AC-2: Recover the unresolved executor-blocked evidence.

## Mission execution shape

- Initial child plan: single
- Split reason: none

## Final integrated verification

- Command: \`node --version\`
`
}

function directorySnapshot(root) {
  const snapshot = {}
  const visit = (directory) => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name)
      if (statSync(path).isDirectory()) visit(path)
      else snapshot[relative(root, path)] = readFileSync(path, 'utf8')
    }
  }
  visit(root)
  return snapshot
}

function prepareMissionFixture(root, missionPath, { terminal }) {
  const contract = fixtureContract()
  writeFileSync(join(missionPath, 'brainstorm', 'contract.md'), contract)
  const missionFile = join(missionPath, 'mission.yaml')
  const mission = parseYaml(readFileSync(missionFile, 'utf8'))
  mission.branch = git(root, ['branch', '--show-current'])
  mission.base_branch = mission.branch
  mission.base_revision = git(root, ['rev-parse', 'HEAD'])
  mission.approved_contract_hash = createHash('sha256').update(contract).digest('hex')
  mission.approved_at = '2026-08-08T00:00:00.000Z'
  mission.status = terminal ? 'failed' : 'running'
  if (terminal) {
    mission.disposition = 'infrastructure-failure'
    mission.convergence_disposition = 'executor_unavailable'
    mission.gaps = {
      version: 1,
      processed_signals: [],
      items: [
        {
          id: 'gap-evidence',
          source: { kind: 'final-verification', id: 'authorized-command' },
          status: 'failed',
          acceptance: 'AC-2',
          finding_type: 'evidence',
        },
      ],
    }
    mkdirSync(join(missionPath, 'review'), { recursive: true })
    writeFileSync(
      join(missionPath, 'review', 'final-verification-attempts.json'),
      `${JSON.stringify(
        [
          {
            id: 'verification-001',
            command: 'node --version',
            revision: mission.base_revision,
            status: 'blocked',
            disposition: 'executor_unavailable',
            executor: 'managed-worker',
          },
        ],
        null,
        2
      )}\n`
    )
  }
  writeFileSync(missionFile, stringifyYaml(mission))

  const checkpoint = readCheckpoint(join(root, '.specdev'), mission.run_id)
  checkpoint.status = terminal ? 'completed' : 'active'
  checkpoint.position = {
    graph: 'mission-lifecycle',
    node: terminal ? 'failed' : 'mission-review',
  }
  checkpoint.outputs = checkpoint.outputs || {}
  checkpoint.gateDecisions = checkpoint.gateDecisions || {}
  if (terminal) checkpoint.finalOutput = { disposition: 'infrastructure-failure' }
  writeCheckpoint(join(root, '.specdev'), checkpoint)
  return mission
}

try {
  const root = mkdtempSync(join(tmpdir(), 'specdev-mission-environment-'))
  roots.push(root)
  const specdevPath = join(root, '.specdev')
  mkdirSync(specdevPath, { recursive: true })
  const recoveredChildFolder = '00001_recovered-child'
  const recoveredChildPath = join(specdevPath, 'assignments', recoveredChildFolder)
  mkdirSync(join(recoveredChildPath, 'review'), { recursive: true })
  writeFileSync(
    join(recoveredChildPath, 'status.json'),
    `${JSON.stringify(
      {
        version: 1,
        id: '00001',
        mission: 'M00001',
        run_id: 'mission-run-1',
        status: 'completed',
        completed_at: '2026-09-01T00:00:00.001Z',
      },
      null,
      2
    )}\n`
  )
  writeFileSync(join(recoveredChildPath, 'outcome.md'), '# Outcome\n')
  writeFileSync(join(recoveredChildPath, 'review', 'implementation-verdict.md'), '# Verdict\n')
  const recoveredQueue = {
    version: 2,
    design_mode: 'planned',
    assignments: [
      {
        id: '00001',
        folder: recoveredChildFolder,
        status: 'integrated',
        outcome: `.specdev/assignments/${recoveredChildFolder}/outcome.md`,
        completed_at: '2026-09-01T00:00:00.002Z',
        follow_up: 'none',
        disposition: 'completed',
      },
      { id: '00002', status: 'pending' },
    ],
  }
  const recoveredCheckpoint = {
    updatedAt: '2026-09-01T00:00:00.000Z',
    outputs: {
      'child-assignment': {
        approved: true,
        verdict: `.specdev/assignments/${recoveredChildFolder}/review/implementation-verdict.md`,
      },
    },
  }
  const recoveredChild = await recoverPersistedMissionQueueAdvance({
    specdevPath,
    mission: { id: 'M00001', run_id: 'mission-run-1' },
    queue: recoveredQueue,
    checkpoint: recoveredCheckpoint,
  })
  assert.equal(recoveredChild.id, '00001')
  await assert.rejects(
    recoverPersistedMissionQueueAdvance({
      specdevPath,
      mission: { id: 'M00001', run_id: 'mission-run-1' },
      queue: {
        ...recoveredQueue,
        assignments: [
          { ...recoveredQueue.assignments[0], completed_at: '2026-08-31T23:59:59.999Z' },
          recoveredQueue.assignments[1],
        ],
      },
      checkpoint: recoveredCheckpoint,
    }),
    /is incomplete/
  )
  writeFileSync(
    join(specdevPath, 'agents.yaml'),
    'worker:\n  provider: codex\n  model: worker-test\n  effort: medium\n  timeout: 1m\nreviewer:\n  provider: claude\n  model: reviewer-test\n  effort: high\n  timeout: 1m\n'
  )
  writeFileSync(
    join(specdevPath, 'executors.yaml'),
    `version: 1
executors:
  managed-worker:
    class: managed-worker
    available: true
    capabilities: []
    services: []
    platforms: [test-platform]
    runtimes: [node]
    secret_names: []
  authorized-host:
    class: authorized-host
    available: true
    capabilities: [loopback_bind]
    services: [postgres]
    platforms: [test-platform]
    runtimes: [node]
    secret_names: [TEST_DATABASE_URL]
`
  )
  const contract = `${missionExecutionPolicyTemplate()
    .replace('Alternate executors: none', 'Alternate executors: authorized-host')
    .replace('Required runtimes: none', 'Required runtimes: node')
    .replace('Required capabilities: none', 'Required capabilities: loopback_bind')
    .replace('Required services: none', 'Required services: postgres')
    .replace('Required platforms: current', 'Required platforms: test-platform')
    .replace('Required secrets: none', 'Required secrets: TEST_DATABASE_URL')}
## Final integrated verification

- Command: \`node --version\`
`
  const declaration = parsePolicyDeclaration(contract)
  assert.equal(declaration.primary, 'managed-worker')
  assert.deepEqual(declaration.alternates, ['authorized-host'])

  const policy = await deriveMissionExecutionPolicy({
    specdevPath,
    contractContent: contract,
    contractHash: 'contract-hash',
    verificationCommand: 'node --version',
    environment: { TEST_DATABASE_URL: 'must-not-be-persisted' },
    platform: 'test-platform',
  })
  assert.equal(policy.contract_hash, 'contract-hash')
  assert.equal(policy.preflight.status, 'ready')
  assert.deepEqual(policy.preflight.capable_executors, ['authorized-host'])
  assert.equal(JSON.stringify(policy).includes('must-not-be-persisted'), false)
  assert.deepEqual(policy.requirements.secret_names, ['TEST_DATABASE_URL'])
  assert.equal(
    selectVerificationExecutor(policy, { currentClass: 'managed-worker' }).status,
    'executor-unavailable'
  )
  const routed = selectVerificationExecutor(policy, { currentClass: 'authorized-host' })
  assert.equal(routed.status, 'recovery')
  assert.equal(routed.executor.id, 'authorized-host')

  const missingSecret = await deriveMissionExecutionPolicy({
    specdevPath,
    contractContent: contract,
    contractHash: 'contract-hash',
    verificationCommand: 'node --version',
    environment: {},
    platform: 'test-platform',
  })
  assert.equal(missingSecret.preflight.status, 'decision-required')
  assert.match(missingSecret.preflight.missing.join(','), /secret:TEST_DATABASE_URL/)
  assert.equal(missingSecret.preflight.decisions[0].disposition, 'user_decision_required')

  const first = {
    id: 'verification-001',
    command: 'node --version',
    revision: 'candidate',
    status: 'blocked',
  }
  const history = appendVerificationReceipt([first], {
    id: 'verification-002',
    command: first.command,
    revision: first.revision,
    status: 'passed',
  })
  assert.equal(history[0].superseded_by, 'verification-002')
  assert.equal(history[1].supersedes, 'verification-001')
  assert.equal(classifyVerificationDisposition({ exitCode: 127 }), 'executor_unavailable')
  assert.equal(classifyVerificationDisposition({ exitCode: 1 }), 'needs_product_change')

  const finding = scopeMissionFinding({
    acceptance: 'AC-2',
    type: 'evidence',
    required: 'Run on an authorized host.',
  })
  const superseded = closeOrSupersedeFinding(finding, {
    mode: 'superseded',
    by: 'verification-002',
    evidence: 'receipt.json',
  })
  assert.equal(superseded.status, 'superseded')
  assert.equal(superseded.superseded_by, 'verification-002')
  const mission = {}
  const gap = openMissionGap(mission, {
    kind: 'child',
    sourceId: '00001',
    signalId: 'child:00001:AC-2:evidence',
    acceptance: 'AC-2',
    findingType: 'evidence',
  }).gap
  supersedeMissionGap(mission, gap.id, {
    supersededBy: 'child:00002:complete',
    evidence: 'outcome.md',
    authority: '00002',
  })
  assert.equal(gap.status, 'superseded')
  assert.equal(gap.acceptance, 'AC-2')
  assert.equal(gap.closure_authority, '00002')

  const cliRoot = mkdtempSync(join(tmpdir(), 'specdev-mission-environment-cli-'))
  roots.push(cliRoot)
  git(cliRoot, ['init', '-b', 'main'])
  git(cliRoot, ['config', 'user.name', 'SpecDev Test'])
  git(cliRoot, ['config', 'user.email', 'specdev@example.test'])
  writeFileSync(join(cliRoot, 'README.md'), '# Fixture\n')
  git(cliRoot, ['add', 'README.md'])
  git(cliRoot, ['commit', '-m', 'base'])
  run(cliRoot, ['init', '--json'])
  assert.equal(existsSync(join(cliRoot, '.specdev', 'executors.yaml')), true)
  const created = run(cliRoot, ['mission', 'create', 'environment aware mission', '--json'])
  const missionContract = readFileSync(
    join(cliRoot, created.path, 'brainstorm', 'contract.md'),
    'utf-8'
  )
  assert.match(missionContract, /^## Mission execution policy$/m)
  assert.match(missionContract, /Primary executor: managed-worker/)

  writeFileSync(
    join(cliRoot, '.specdev', 'project_notes', 'big_picture.md'),
    '# Project Big Picture\n\nThis fixture exercises Mission evidence handoff in a Git-backed Node.js CLI project. It provides enough durable context for a fresh successor Assignment to cross the normal project-context gate.\n'
  )
  const missionPath = join(cliRoot, created.path)
  prepareMissionFixture(cliRoot, missionPath, { terminal: true })
  const sourceBeforeHandoff = directorySnapshot(missionPath)
  const handoffResult = run(cliRoot, [
    'mission',
    'handoff',
    created.id,
    '--successor-assignment',
    '--json',
  ])
  assert.equal(handoffResult.status, 'successor-drafted')
  assert.deepEqual(handoffResult.unresolved_criteria, ['AC-2'])
  const successorPath = join(cliRoot, handoffResult.path)
  const handoff = JSON.parse(
    readFileSync(join(successorPath, 'brainstorm', 'mission-handoff.json'), 'utf8')
  )
  assert.equal(handoff.source.mission, created.id)
  assert.equal(handoff.source.terminal_status, 'failed')
  assert.deepEqual(handoff.unresolved_criteria, ['AC-2'])
  assert.equal(handoff.receipts[0].id, 'verification-001')
  assert.equal(handoff.receipts[0].supersedable, true)
  const successorContract = readFileSync(join(successorPath, 'brainstorm', 'contract.md'), 'utf8')
  assert.match(successorContract, /^- AC-2:/m)
  assert.doesNotMatch(successorContract, /^- AC-1:/m)
  assert.deepEqual(directorySnapshot(missionPath), sourceBeforeHandoff)

  const guardRoot = mkdtempSync(join(tmpdir(), 'specdev-mission-checkpoint-guard-'))
  roots.push(guardRoot)
  git(guardRoot, ['init', '-b', 'main'])
  git(guardRoot, ['config', 'user.name', 'SpecDev Test'])
  git(guardRoot, ['config', 'user.email', 'specdev@example.test'])
  writeFileSync(join(guardRoot, 'README.md'), '# Guard fixture\n')
  git(guardRoot, ['add', 'README.md'])
  git(guardRoot, ['commit', '-m', 'base'])
  run(guardRoot, ['init', '--json'])
  git(guardRoot, ['add', '--all'])
  git(guardRoot, ['commit', '-m', 'install specdev fixture'])
  const guardCreated = run(guardRoot, ['mission', 'create', 'checkpoint guard mission', '--json'])
  prepareMissionFixture(guardRoot, join(guardRoot, guardCreated.path), { terminal: false })
  writeFileSync(join(guardRoot, 'README.md'), '# Guard fixture\n\nUncheckpointed product change.\n')
  const refused = run(guardRoot, ['mission', 'run', guardCreated.id, '--json'], 1)
  assert.match(refused.error, /Mission convergence refuses uncheckpointed product changes/)
  assert.match(refused.error, /README\.md/)
  assert.match(refused.error, new RegExp(`specdev mission checkpoint ${guardCreated.id}`))

  console.log('Mission environment tests passed.')
} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
}
