import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { stringify } from 'yaml'
import { readCheckpoint, writeCheckpoint, writeCurrent } from 'ripplegraph'
import {
  buildStandaloneAssignmentCandidateReceipt,
  writeStandaloneAssignmentCandidateReceipt,
} from '../src/utils/assignment-delivery.js'
import { validateAssignmentContract } from '../src/utils/assignment-vnext.js'
import { validateEvidenceOnlyObservation } from '../src/utils/mission-observation.js'

const repoRoot = resolve(import.meta.dirname, '..')
const bin = join(repoRoot, 'bin', 'specdev.js')
const root = mkdtempSync(join(tmpdir(), 'specdev-mission-adoption-'))

function run(args, expected = 0) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  })
  assert.equal(
    result.status,
    expected,
    `${args.join(' ')} exited ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  )
  return result
}

function runJson(args, expected = 0) {
  return JSON.parse(run(args, expected).stdout)
}

function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, `git ${args.join(' ')} failed:\n${result.stderr}`)
  return result.stdout.trim()
}

function contract({ objective, acceptance, mission = null }) {
  return `# Assignment contract

Kind: change
${mission ? `\nPredecessor Mission: \`${mission}\`\n` : ''}
## Objective and context

${objective}

## Scope and non-goals

Only the fixture repair; no scope expansion.

## Expected behavior

The exact authorized observation is satisfied.

## Important decisions

Preserve historical evidence.

## Constraints and invariants

Do not weaken assertions or add bypasses.

## Delegated and reserved authority

- Delegated: the bounded fixture repair.
- Reserved for the user: any broader change.

## Risks and assumptions

The fixture candidate is local and content-addressed.

## Verification authority

- Command: \`node verify.js\`

## Acceptance criteria

- AC-1: ${acceptance}
`
}

try {
  const observedFailure = {
    command: 'node verify.js',
    revision: 'working-tree@fixture',
    scope: 'integrated',
    status: 'failed',
    duration_ms: 5,
    role: 'authoritative_acceptance',
  }
  assert.equal(
    validateEvidenceOnlyObservation({
      child: {
        id: '00040',
        execution: 'evidence-only',
        observation_command: 'node verify.js',
      },
      progress: { verification: [observedFailure], follow_up: 'required' },
      result: { status: 'blocked' },
    }),
    observedFailure
  )
  assert.throws(
    () =>
      validateEvidenceOnlyObservation({
        child: { id: '00040', execution: 'implementation' },
        progress: { verification: [observedFailure], follow_up: 'required' },
        result: { status: 'blocked' },
      }),
    /Ordinary Mission children/
  )
  assert.throws(
    () =>
      validateEvidenceOnlyObservation({
        child: {
          id: '00040',
          execution: 'evidence-only',
          observation_command: 'node verify.js',
        },
        progress: { verification: [], follow_up: 'required' },
        result: { status: 'blocked' },
      }),
    /provenance is incomplete/
  )

  git(['init', '--quiet'])
  git(['config', 'user.name', 'SpecDev Test'])
  git(['config', 'user.email', 'specdev@example.test'])
  run(['init'])
  writeFileSync(join(root, 'product.txt'), 'broken\n', 'utf8')
  git(['add', '--all'])
  git(['commit', '--quiet', '-m', 'fixture base'])
  git(['branch', '-M', 'main'])
  const base = git(['rev-parse', 'HEAD'])

  const specdevPath = join(root, '.specdev')
  const successorPath = join(specdevPath, 'assignments', '00042_successor')
  mkdirSync(join(successorPath, 'brainstorm'), { recursive: true })
  mkdirSync(join(successorPath, 'design'), { recursive: true })
  mkdirSync(join(successorPath, 'implementation'), { recursive: true })
  mkdirSync(join(successorPath, 'review'), { recursive: true })
  const missionContractContent = contract({
    objective: 'Complete the repaired fixture.',
    acceptance: 'The fixture passes.',
  })
  const missionHash = createHash('sha256').update(missionContractContent).digest('hex')
  writeFileSync(
    join(successorPath, 'brainstorm', 'contract.md'),
    contract({
      objective: 'Repair the finding from Mission M00001 child 00041.',
      acceptance: 'The repaired candidate passes the exact observation.',
      mission: 'M00001 child 00041',
    }),
    'utf8'
  )
  writeFileSync(
    join(successorPath, 'design', 'plan.md'),
    '# Plan\n\n**Implementation Guides:** []\n\n**Review Guides:** []\n\n## Tasks\n\n1. **T-1 (AC-1):** Repair and verify.\n',
    'utf8'
  )
  writeFileSync(join(root, 'product.txt'), 'repaired\n', 'utf8')
  const evidence = {
    command: 'node verify.js',
    revision: `working-tree@${base}`,
    scope: 'integrated',
    status: 'passed',
    duration_ms: 12,
    role: 'authoritative_acceptance',
    policy_contract_hash: missionHash,
    allowed_bypasses: [],
    cleanup_identity: 'fixture-cleanup-v1',
  }
  writeFileSync(
    join(successorPath, 'implementation', 'progress.json'),
    `${JSON.stringify(
      {
        version: 1,
        tasks: [{ id: 'T-1', status: 'completed' }],
        selected_guides: { implementation: [], review: [] },
        verification: [evidence],
        deviations: [],
        follow_up: 'none',
      },
      null,
      2
    )}\n`,
    'utf8'
  )
  writeFileSync(
    join(successorPath, 'outcome.md'),
    '# Outcome\n\n## Delivered behavior\n\nFixture repaired.\n\n## Deviations\n\nNone.\n\n## Unresolved risks\n\nNone.\n\n| Acceptance | Evidence | Result |\n| --- | --- | --- |\n| AC-1 | Exact command passed. | Passed |\n',
    'utf8'
  )
  const successorContract = await validateAssignmentContract(successorPath)
  const status = {
    version: 1,
    id: '00042',
    kind: 'change',
    description: 'Successor fixture',
    status: 'completed',
    run_id: 'assignment-successor-fixture',
    created_at: '2026-08-11T00:00:00.000Z',
    approved_at: '2026-08-11T00:01:00.000Z',
    completed_at: '2026-08-11T00:02:00.000Z',
    git_boundary: {
      version: 1,
      starting_git_commit_hash: base,
      starting_branch: 'main',
      starting_worktree: 'clean',
      adopted_path_count: 0,
      established_at: '2026-08-11T00:01:00.000Z',
    },
  }
  writeFileSync(join(successorPath, 'status.json'), `${JSON.stringify(status, null, 2)}\n`)
  const candidate = await buildStandaloneAssignmentCandidateReceipt({
    targetDir: root,
    assignmentPath: successorPath,
    assignmentStatus: status,
  })
  await writeStandaloneAssignmentCandidateReceipt(successorPath, candidate)
  writeFileSync(
    join(successorPath, 'review', 'implementation-state.json'),
    `${JSON.stringify(
      {
        version: 1,
        round: 1,
        status: 'approved',
        disposition: 'approved',
        contract_hash: successorContract.hash,
        candidate_receipt_identity: candidate.identity,
        scope_divergence: 'none',
        procedure_divergence: 'none',
        evidence_integrity: 'complete',
        user_reapproval_required: false,
      },
      null,
      2
    )}\n`
  )
  writeFileSync(
    join(successorPath, 'review', 'implementation-verdict.md'),
    '---\nverdict: approved\nmaterial_divergence: false\nscope_divergence: none\nprocedure_divergence: none\nevidence_integrity: complete\nuser_reapproval_required: false\n---\n\n## Findings\n\nNo blocking findings.\n'
  )
  git(['add', '--all'])
  git([
    'commit',
    '--quiet',
    '-m',
    'specdev(assignment): deliver 00042',
    '-m',
    'SpecDev-Assignment: 00042\nSpecDev-Commit-Type: delivery',
  ])
  const delivery = git(['rev-parse', 'HEAD'])

  const missionPath = join(specdevPath, 'missions', 'M00001_fixture')
  const blockedPath = join(specdevPath, 'assignments', '00041_observation')
  mkdirSync(join(missionPath, 'brainstorm'), { recursive: true })
  mkdirSync(join(missionPath, 'design'), { recursive: true })
  mkdirSync(join(blockedPath, 'brainstorm'), { recursive: true })
  mkdirSync(join(blockedPath, 'implementation'), { recursive: true })
  writeFileSync(join(missionPath, 'brainstorm', 'contract.md'), missionContractContent)
  writeFileSync(
    join(missionPath, 'mission.yaml'),
    stringify({
      version: 1,
      id: 'M00001',
      objective: 'Complete the repaired fixture',
      status: 'blocked',
      run_id: 'mission-adoption-fixture',
      branch: 'main',
      base_branch: 'main',
      base_revision: base,
      approved_at: '2026-08-11T00:00:00.000Z',
      approved_contract_hash: missionHash,
      execution_policy: { allowed_bypasses: [] },
      blocker: 'Child 00041 implementation blocked',
    })
  )
  writeFileSync(
    join(missionPath, 'design', 'assignments.yaml'),
    stringify({
      version: 2,
      design_mode: 'planned',
      assignments: [
        {
          id: '00041',
          title: 'Observe the final command',
          kind: 'change',
          wave: 1,
          status: 'running',
          folder: '00041_observation',
        },
      ],
      final_verification: { command: 'node verify.js', scope: 'integrated' },
    })
  )
  writeFileSync(
    join(blockedPath, 'brainstorm', 'contract.md'),
    contract({ objective: 'Observe the command.', acceptance: 'The command passes.' })
  )
  writeFileSync(
    join(blockedPath, 'status.json'),
    `${JSON.stringify({ version: 1, id: '00041', mission: 'M00001' }, null, 2)}\n`
  )
  const failed = { ...evidence, status: 'failed', revision: delivery, duration_ms: 8 }
  writeFileSync(
    join(blockedPath, 'implementation', 'progress.json'),
    `${JSON.stringify({ verification: [failed], follow_up: 'required' }, null, 2)}\n`
  )
  writeFileSync(
    join(blockedPath, 'outcome.md'),
    '| Acceptance | Evidence | Result |\n| --- | --- | --- |\n| AC-1 | Historical command failure. | Failed |\n'
  )
  const failedBefore = readFileSync(join(blockedPath, 'implementation', 'progress.json'), 'utf8')
  writeCheckpoint(specdevPath, {
    runId: 'mission-adoption-fixture',
    status: 'active',
    rootGraph: 'mission-lifecycle',
    workflow: { id: 'specdev-workspace', version: '1.0.0' },
    position: { graph: 'assignment-lifecycle', node: 'design' },
    createdAt: '2026-08-11T00:00:00.000Z',
    updatedAt: '2026-08-11T00:01:00.000Z',
    outputs: {},
    gateDecisions: {},
    graphSource: {
      kind: 'package',
      graphId: 'mission-lifecycle',
      graphVersion: '1.5.0',
      packagePath: 'workflows/mission-lifecycle@1.5.0',
    },
    stack: [
      {
        parent: {
          graph: 'mission-lifecycle',
          node: 'child-assignment',
          graphSource: {
            kind: 'package',
            graphId: 'mission-lifecycle',
            graphVersion: '1.5.0',
            packagePath: 'workflows/mission-lifecycle@1.5.0',
          },
          scope: '',
        },
        child: {
          kind: 'package',
          graphId: 'assignment-lifecycle',
          graphVersion: '2.3.0',
          packagePath: 'workflows/assignment-lifecycle@2.3.0',
        },
        scope: 'f1',
        enteredAt: '2026-08-11T00:01:00.000Z',
      },
    ],
    frameCounter: 1,
  })
  writeCurrent(specdevPath, { focusedRunId: 'mission-adoption-fixture' })

  const beforePlan = git(['status', '--porcelain=v1'])
  const planned = runJson(['mission', 'adopt-successor', 'M00001', '--assignment=00042', '--json'])
  assert.equal(planned.status, 'planned')
  assert.equal(planned.plan.blocked_child.id, '00041')
  assert.equal(planned.plan.successor.delivery_commit, delivery)
  assert.equal(git(['status', '--porcelain=v1']), beforePlan, 'planning is mutation-free')

  const runPath = join(specdevPath, '.ripplegraph', 'runs', 'mission-adoption-fixture')
  const resetPaths = [
    join(missionPath, 'mission.yaml'),
    join(missionPath, 'design', 'assignments.yaml'),
    join(runPath, 'checkpoint.json'),
    join(runPath, 'transition-log.jsonl'),
  ]
  const resetBytes = new Map(
    resetPaths.map((path) => [path, existsSync(path) ? readFileSync(path) : null])
  )
  const generatedPaths = [
    join(missionPath, 'review', 'successor-adoption-00042.json'),
    join(missionPath, 'review', 'final-verification.json'),
    join(missionPath, 'review', 'final-verification-attempts.json'),
    join(runPath, 'artifacts', 'child-assignment', 'output.json'),
    join(specdevPath, 'cache', 'mission-adoptions', `M00001-${planned.snapshot}.json`),
  ]
  const restoreBlockedMission = () => {
    for (const [path, bytes] of resetBytes) {
      if (bytes === null) rmSync(path, { force: true })
      else writeFileSync(path, bytes)
    }
    for (const path of generatedPaths) rmSync(path, { force: true })
  }

  for (const boundary of [
    'record-written',
    'mission-written',
    'queue-written',
    'checkpoint-written',
    'transition-appended',
  ]) {
    const interrupted = runJson(
      [
        'mission',
        'adopt-successor',
        'M00001',
        '--assignment=00042',
        `--confirm=${planned.snapshot}`,
        `--interrupt-after=${boundary}`,
        '--json',
      ],
      1
    )
    assert.match(interrupted.error, new RegExp(boundary))
    const recovered = runJson([
      'mission',
      'adopt-successor',
      'M00001',
      '--assignment=00042',
      `--confirm=${planned.snapshot}`,
      '--json',
    ])
    assert.equal(recovered.status, 'adopted')
    const transitions = existsSync(join(runPath, 'transition-log.jsonl'))
      ? readFileSync(join(runPath, 'transition-log.jsonl'), 'utf8')
          .trim()
          .split(/\r?\n/)
          .filter(Boolean)
          .map((line) => JSON.parse(line))
          .filter((entry) => entry.actor === 'specdev:mission-adopt-successor')
      : []
    assert.equal(transitions.length, 1, `${boundary} recovery records one transition`)
    restoreBlockedMission()
  }

  runJson(
    ['mission', 'adopt-successor', 'M00001', '--assignment=00042', '--confirm=stale', '--json'],
    1
  )
  assert.equal(git(['status', '--porcelain=v1']), beforePlan, 'stale confirmation is mutation-free')

  const adopted = runJson([
    'mission',
    'adopt-successor',
    'M00001',
    '--assignment=00042',
    `--confirm=${planned.snapshot}`,
    '--json',
  ])
  assert.equal(adopted.status, 'adopted')
  assert.equal(adopted.idempotent, false)
  assert.equal(git(['rev-parse', 'HEAD']), delivery, 'adoption creates no delivery commit')
  assert.equal(
    readFileSync(join(blockedPath, 'implementation', 'progress.json'), 'utf8'),
    failedBefore,
    'historical failed receipt remains immutable'
  )
  const checkpoint = readCheckpoint(specdevPath, 'mission-adoption-fixture')
  assert.equal(checkpoint.stack.length, 0)
  assert.deepEqual(checkpoint.position, { graph: 'mission-lifecycle', node: 'final-verification' })

  const replay = runJson([
    'mission',
    'adopt-successor',
    'M00001',
    '--assignment=00042',
    `--confirm=${planned.snapshot}`,
    '--json',
  ])
  assert.equal(replay.idempotent, true)
  assert.equal(git(['rev-parse', 'HEAD']), delivery)

  console.log('Mission successor adoption tests passed.')
} finally {
  rmSync(root, { recursive: true, force: true })
}
