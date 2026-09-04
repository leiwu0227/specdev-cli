import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import fse from 'fs-extra'
import {
  readCurrent as readRippleCurrent,
  writeCheckpoint,
  writeCurrent as writeRippleCurrent,
} from 'ripplegraph'
import { resolveAgentProfile, validateProfile } from '../src/utils/agent-profiles.js'
import {
  buildProviderInvocation,
  decodeProviderOutput,
  reviewerSessionCapability,
} from '../src/utils/provider-adapters.js'
import {
  parseResultEnvelope,
  resultEnvelopeBlockedFallback,
  resultEnvelopeInstructions,
} from '../src/utils/result-envelope.js'
import { reserveEntityId } from '../src/utils/id-reservation.js'
import {
  buildKnowledgeIndex,
  buildKnowledgeDistillationBrief,
  knowledgeFreshness,
  normalizeFtsQuery,
  normalizeFtsTerms,
  parseKnowledgeMetadata,
  searchKnowledgeIndex,
} from '../src/utils/knowledge.js'
import { loadGuideCatalog, resolveGuides } from '../src/utils/guides.js'
import { readCurrentFocus, writeCurrentFocus } from '../src/utils/current.js'
import {
  assertMissionTransitionRecorded,
  bindReplannedQueueToGap,
  validateAndReserveReplannedQueue,
} from '../src/utils/mission.js'
import { contractPreview } from '../src/utils/assignment-vnext.js'
import {
  currentMissionWave,
  integratableMissionPrefix,
  missionIntegrationRecoveryAction,
  missionQueueHasRemaining,
  missionWaveIsParallel,
  normalizeMissionWaves,
} from '../src/utils/mission-waves.js'
import {
  createMissionChildDelivery,
  ensureMissionWorktree,
  missionChildBranch,
  missionWorktreeRelativePath,
  removeMissionWorktree,
} from '../src/utils/mission-worktrees.js'
import {
  createAttemptRecord,
  listAttemptRecords,
  readAttemptRecord,
  summarizeAttemptActivity,
  updateAttemptRecord,
} from '../src/utils/process-record.js'
import {
  assertReviewWaiverEvidence,
  validateDeliveryArtifacts,
} from '../src/utils/delivery-artifacts.js'
import {
  assignmentContractTemplate,
  normalizeReviewPolicy,
  reviewPolicyFromFlags,
  validateContractPath,
} from '../src/utils/assignment-vnext.js'
import {
  classifyWorkspaceChanges,
  parseGitPorcelainPaths,
  workspaceChangeSummaryLines,
} from '../src/utils/workspace-changes.js'
import { compactCompletedWorkflowRuntime } from '../src/utils/artifact-retention.js'
import { durableAttemptStatusForResult, runSpawnedAgent } from '../src/utils/spawned-agent.js'
import {
  buildStandaloneAssignmentCandidateReceipt,
  summarizeRisks,
  summarizeVerification,
  validateStandaloneAssignmentCandidateReceipt,
} from '../src/utils/assignment-delivery.js'
import {
  AUTOMATIC_ARTIFACT_REPAIR_LIMIT,
  recordArtifactRepair,
} from '../src/utils/review-convergence.js'
import {
  createReviewerContinuationLease,
  preparePrimaryReviewerContinuation,
  reviewerContinuationLeasePath,
} from '../src/utils/reviewer-continuation.js'

const root = mkdtempSync(join(tmpdir(), 'specdev-vnext-foundations-'))
const specdevPath = join(root, '.specdev')
try {
  mkdirSync(join(specdevPath, 'cache'), { recursive: true })
  writeFileSync(
    join(specdevPath, 'agents.yaml'),
    `worker:\n  provider: codex\n  model: repo-worker\n  effort: medium\n  network: true\n  timeout: 30m\nreviewer:\n  provider: claude\n  model: repo-reviewer\n  effort: high\n  timeout: 10m\n`
  )
  writeFileSync(
    join(specdevPath, 'cache', 'agents.local.yaml'),
    `reviewer:\n  model: local-reviewer\n`
  )
  const reviewer = await resolveAgentProfile(specdevPath, 'reviewer')
  assert.equal(reviewer.model, 'local-reviewer')
  assert.equal(reviewer.timeout_ms, 600_000)
  assert.equal(reviewer.filesystem, 'read-only')
  assert.equal(reviewer.network, false)
  const worker = await resolveAgentProfile(specdevPath, 'worker')
  assert.equal(worker.filesystem, 'workspace-write')
  assert.equal(worker.network, true)

  assert.throws(
    () =>
      validateProfile('worker', {
        provider: 'codex',
        model: 'gpt-test',
        effort: 'medium',
        network: 'yes',
        timeout: '1m',
      }),
    /network must be true or false/
  )
  assert.throws(
    () =>
      validateProfile('worker', {
        provider: 'claude',
        model: 'sonnet',
        effort: 'medium',
        network: true,
        timeout: '1m',
      }),
    /cannot enforce network-enabled workspace-write access for the worker profile/
  )
  const networkedReviewer = validateProfile('reviewer', {
    provider: 'codex',
    model: 'gpt-test',
    effort: 'medium',
    network: true,
    timeout: '1m',
  })
  assert.equal(networkedReviewer.filesystem, 'read-only')
  assert.equal(networkedReviewer.network, true)
  assert.throws(
    () =>
      validateProfile('reviewer', {
        provider: 'claude',
        model: 'opus',
        effort: 'high',
        network: true,
        timeout: '1m',
      }),
    /cannot enforce network-enabled read-only access for the reviewer profile/
  )
  const attemptsBeforeUnsupportedReview = (await listAttemptRecords(specdevPath)).length
  const unsupportedReview = await runSpawnedAgent({
    targetDir: root,
    specdevPath,
    role: 'reviewer',
    profile: {
      provider: 'claude',
      model: 'opus',
      effort: 'high',
      filesystem: 'read-only',
      network: true,
      timeout_ms: 60_000,
    },
    prompt: 'This unsupported invocation must fail before launch.',
    resultPath: join(specdevPath, 'discussions', 'D99999_fixture', 'review', 'verdict.md'),
    resultKind: 'reviewer',
    discussion: 'D99999',
  })
  assert.equal(unsupportedReview.status, 'failed')
  assert.equal(unsupportedReview.attempt, null)
  assert.match(unsupportedReview.error, /agent preflight failed/)
  assert.equal((await listAttemptRecords(specdevPath)).length, attemptsBeforeUnsupportedReview)

  const codexReview = buildProviderInvocation({
    profile: { provider: 'codex', model: 'gpt-test', effort: 'high' },
    role: 'reviewer',
    cwd: root,
    resultPath: join(specdevPath, 'cache', 'result.md'),
  })
  assert.equal(codexReview.command, 'codex')
  assert.equal(codexReview.args.includes('read-only'), true)
  assert.deepEqual(codexReview.accessPolicy, { filesystem: 'read-only', network: false })
  assert.equal(
    codexReview.args.some((arg) => arg.includes('dangerously')),
    false
  )
  assert.equal(codexReview.args.includes('sandbox_workspace_write.network_access=true'), false)
  assert.equal(codexReview.args.includes('web_search="live"'), false)
  const codexNetworkedReview = buildProviderInvocation({
    profile: { provider: 'codex', model: 'gpt-test', effort: 'high', network: true },
    role: 'reviewer',
    cwd: root,
  })
  assert.equal(codexNetworkedReview.args[0], 'exec')
  assert.equal(codexNetworkedReview.args.includes('read-only'), true)
  const webSearchConfig = codexNetworkedReview.args.indexOf('web_search="live"')
  assert.equal(webSearchConfig > codexNetworkedReview.args.indexOf('exec'), true)
  assert.equal(codexNetworkedReview.args[webSearchConfig - 1], '--config')
  assert.equal(
    codexNetworkedReview.args.includes('sandbox_workspace_write.network_access=true'),
    false
  )
  assert.deepEqual(codexNetworkedReview.accessPolicy, {
    filesystem: 'read-only',
    network: true,
  })
  const codexWorker = buildProviderInvocation({
    profile: { provider: 'codex', model: 'gpt-test', effort: 'medium', network: true },
    role: 'worker',
    cwd: root,
  })
  assert.equal(codexWorker.args.includes('workspace-write'), true)
  assert.equal(codexWorker.args.includes('sandbox_workspace_write.network_access=true'), true)
  const claudeReview = buildProviderInvocation({
    profile: { provider: 'claude', model: 'opus', effort: 'high' },
    role: 'reviewer',
    cwd: root,
  })
  assert.deepEqual(claudeReview.args.slice(-2), ['--effort', 'high'])
  assert.equal(claudeReview.args.includes('plan'), true)
  assert.equal(claudeReview.args.includes('--no-session-persistence'), true)
  assert.equal(
    reviewerSessionCapability({
      profile: { provider: 'claude' },
      role: 'reviewer',
    }).supported,
    true
  )
  const claudeCapture = buildProviderInvocation({
    profile: { provider: 'claude', model: 'opus', effort: 'xhigh' },
    role: 'reviewer',
    cwd: root,
    providerSession: { mode: 'capture' },
  })
  assert.equal(claudeCapture.resultMode, 'claude-json')
  assert.equal(claudeCapture.args.includes('--no-session-persistence'), false)
  assert.equal(claudeCapture.args[claudeCapture.args.indexOf('--output-format') + 1], 'json')
  const sessionId = 'session_fixture_0001'
  assert.deepEqual(
    decodeProviderOutput(
      claudeCapture,
      JSON.stringify({ session_id: sessionId, result: 'strict result' })
    ),
    { resultText: 'strict result', providerSessionId: sessionId }
  )
  const claudeResume = buildProviderInvocation({
    profile: { provider: 'claude', model: 'opus', effort: 'xhigh' },
    role: 'reviewer',
    cwd: root,
    providerSession: { mode: 'resume', id: sessionId },
  })
  const claudeResumeIndex = claudeResume.args.indexOf('--resume')
  assert.deepEqual(claudeResume.args.slice(claudeResumeIndex, claudeResumeIndex + 2), [
    '--resume',
    sessionId,
  ])
  assert.throws(
    () =>
      decodeProviderOutput(
        claudeResume,
        JSON.stringify({ session_id: 'different_session', result: 'strict result' })
      ),
    /did not confirm/
  )
  assert.throws(
    () =>
      buildProviderInvocation({
        profile: { provider: 'codex', model: 'gpt-test', effort: 'high' },
        role: 'reviewer',
        cwd: root,
        providerSession: { mode: 'capture' },
      }),
    /does not support reviewer session continuation/
  )
  assert.throws(
    () =>
      buildProviderInvocation({
        profile: { provider: 'cursor', model: 'cursor-model', effort: 'high' },
        role: 'worker',
        cwd: root,
      }),
    /does not support an effort/
  )
  const cursorReview = buildProviderInvocation({
    profile: { provider: 'cursor', model: 'cursor-model', effort: null },
    role: 'reviewer',
    cwd: root,
  })
  assert.equal(cursorReview.args.includes('--trust'), true)
  assert.equal(cursorReview.args.includes('plan'), true)
  assert.equal(cursorReview.args.includes('--yolo'), false)

  const preview = contractPreview(`## Objective and context

[Repair routing](https://example.test) while keeping
the existing API stable.

## Scope and non-goals

- In scope: **fallback routing**
- Non-goals: provider billing

## Acceptance criteria

- AC-1: Requests use the first healthy endpoint.
- AC-2: Failed endpoints fall back deterministically.
- AC-3: Existing response shapes remain stable.
`)
  assert.deepEqual(preview, [
    'Objective: Repair routing while keeping the existing API stable.',
    'In scope: fallback routing',
    'Acceptance AC-1: Requests use the first healthy endpoint.',
    'Acceptance AC-2: Failed endpoints fall back deterministically.',
  ])
  assert.equal(
    preview.every((line) => line.length <= 180),
    true
  )

  const result = parseResultEnvelope(
    `---\nverdict: approved\nmaterial_divergence: false\n---\n\n## Findings\n\nNo blocking findings.\n`,
    'reviewer'
  )
  assert.equal(result.frontmatter.verdict, 'approved')
  assert.equal(result.frontmatter.taxonomy_source, 'legacy_projection')
  assert.equal(result.frontmatter.evidence_integrity, 'complete')
  const structuredReview = parseResultEnvelope(
    `---\nverdict: approved\nmaterial_divergence: false\nscope_divergence: none\nprocedure_divergence: disclosed\nevidence_integrity: complete\nuser_reapproval_required: false\n---\n\n## Findings\n\nProcedure divergence was disclosed and evidence remains complete.\n`,
    'reviewer'
  )
  assert.equal(structuredReview.frontmatter.procedure_divergence, 'disclosed')
  assert.throws(
    () =>
      parseResultEnvelope(
        `---\nverdict: approved\nmaterial_divergence: false\nscope_divergence: material\nprocedure_divergence: none\nevidence_integrity: complete\nuser_reapproval_required: true\n---\n\n## Findings\n\nUnsafe.\n`,
        'reviewer'
      ),
    /structured projection/
  )
  assert.throws(() => parseResultEnvelope('approved', 'reviewer'), /frontmatter/)
  assert.throws(
    () =>
      parseResultEnvelope(
        '\n---\nverdict: approved\nmaterial_divergence: false\n---\n\n## Findings\n\nClear.\n',
        'reviewer'
      ),
    /must start with YAML frontmatter/
  )
  assert.throws(
    () => parseResultEnvelope('---\nverdict: approved\n---\n\n## Findings\n\nClear.\n', 'reviewer'),
    /material_divergence/
  )
  assert.throws(
    () =>
      parseResultEnvelope(
        '---\nverdict: approved\nmaterial_divergence: false\nconfidence: high\n---\n\n## Findings\n\nClear.\n',
        'reviewer'
      ),
    /unknown key: confidence/
  )
  assert.throws(
    () =>
      parseResultEnvelope(
        '---\nverdict: approved\nmaterial_divergence: false\n---\n\n## Findings\n',
        'reviewer'
      ),
    /empty ## Findings/
  )
  assert.throws(
    () => parseResultEnvelope('---\nstatus: completed\n---\n\n## Changes\n\nDone.\n', 'worker'),
    /follow_up/
  )
  assert.doesNotMatch(resultEnvelopeInstructions('reviewer'), /approved \| needs_changes/)
  assert.match(resultEnvelopeInstructions('reviewer'), /first byte/)
  assert.equal(
    parseResultEnvelope(resultEnvelopeBlockedFallback('reviewer'), 'reviewer').frontmatter.verdict,
    'blocked'
  )
  assert.equal(
    parseResultEnvelope(resultEnvelopeBlockedFallback('worker'), 'worker').frontmatter.status,
    'blocked'
  )
  assert.equal(durableAttemptStatusForResult('worker', { status: 'completed' }), 'completed')
  assert.equal(durableAttemptStatusForResult('worker', { status: 'blocked' }), 'blocked')
  assert.equal(durableAttemptStatusForResult('reviewer', { verdict: 'needs_changes' }), 'completed')
  assert.equal(durableAttemptStatusForResult('reviewer', { verdict: 'blocked' }), 'blocked')

  const activity = summarizeAttemptActivity(
    [
      { kind: 'mission-controller', status: 'completed', duration_ms: 500 },
      {
        kind: 'worker',
        status: 'blocked',
        provider: 'codex',
        duration_ms: 100,
        usage: { provider_reported_tokens: 120 },
      },
      {
        kind: 'reviewer',
        status: 'completed',
        provider: 'claude',
        duration_ms: 200,
        usage: { provider_reported_tokens: 30 },
      },
    ],
    {
      startedAt: '2026-07-21T00:00:00.000Z',
      endedAt: '2026-07-21T00:00:01.000Z',
    }
  )
  assert.deepEqual(activity, {
    attempt_count: 3,
    orchestration_attempt_count: 1,
    provider_attempt_count: 2,
    provider_attempts: {
      total: 2,
      completed: 1,
      failed: 0,
      blocked: 1,
      interrupted: 0,
      running: 0,
    },
    elapsed_ms: 1_000,
    agent_duration_ms: 300,
    provider_reported_tokens: 150,
  })

  const ids = await Promise.all(
    Array.from({ length: 8 }, () => reserveEntityId(specdevPath, 'assignment'))
  )
  assert.equal(new Set(ids).size, ids.length)
  assert.deepEqual([...ids].sort(), [
    '00001',
    '00002',
    '00003',
    '00004',
    '00005',
    '00006',
    '00007',
    '00008',
  ])
  assert.equal(await reserveEntityId(specdevPath, 'test_audit'), 'TA00001')
  const previousAttemptNamespace = process.env.SPECDEV_ATTEMPT_NAMESPACE
  process.env.SPECDEV_ATTEMPT_NAMESPACE = '00031'
  const namespacedAttempt = await createAttemptRecord(specdevPath, {
    kind: 'worker',
    workspace: '.specdev/worktrees/slot-01',
    mission: 'M00001',
    assignment: '00031',
  })
  assert.equal(namespacedAttempt.id, 'Attempt-00031-00001')
  assert.equal((await readAttemptRecord(specdevPath, namespacedAttempt.id)).assignment, '00031')
  await updateAttemptRecord(specdevPath, namespacedAttempt.id, { status: 'completed' })
  if (previousAttemptNamespace === undefined) delete process.env.SPECDEV_ATTEMPT_NAMESPACE
  else process.env.SPECDEV_ATTEMPT_NAMESPACE = previousAttemptNamespace

  writeFileSync(
    join(specdevPath, 'processes', 'ATT-00007.yaml'),
    'id: ATT-00007\nkind: reviewer\nstatus: interrupted\nworkspace: .\nstarted_at: 2026-07-22T00:00:00.000Z\n'
  )
  assert.equal((await readAttemptRecord(specdevPath, 'ATT-00007')).status, 'interrupted')

  const waveQueue = {
    version: 2,
    assignments: normalizeMissionWaves([
      { id: '00031', wave: 1, status: 'completed', delivery_revision: 'delivery-31' },
      { id: '00032', wave: 1, status: 'completed', delivery_revision: 'delivery-32' },
      { id: '00033', wave: 2, status: 'pending' },
    ]),
  }
  assert.equal(currentMissionWave(waveQueue), 1)
  assert.equal(missionWaveIsParallel(waveQueue), true)
  assert.deepEqual(
    integratableMissionPrefix(waveQueue).map((item) => item.id),
    ['00031', '00032']
  )
  waveQueue.assignments[0].status = 'integrated'
  assert.deepEqual(
    integratableMissionPrefix(waveQueue).map((item) => item.id),
    ['00032']
  )
  waveQueue.assignments[1].status = 'integrated'
  assert.equal(currentMissionWave(waveQueue), 2)
  assert.equal(missionQueueHasRemaining(waveQueue), true)
  assert.equal(
    missionQueueHasRemaining({ assignments: [{ id: '00034', wave: 1, status: 'blocked' }] }),
    true
  )
  assert.equal(
    missionQueueHasRemaining({
      design_mode: 'single',
      assignments: [{ id: '00035', wave: 1, status: 'completed' }],
    }),
    false
  )
  assert.throws(
    () =>
      normalizeMissionWaves([
        { id: '00031', wave: 1 },
        { id: '00032', wave: 3 },
      ]),
    /dense positive integers/
  )
  assert.equal(missionChildBranch('M00001', '00031'), 'specdev/M00001/00031')
  assert.equal(missionWorktreeRelativePath('slot-01'), '.specdev/worktrees/slot-01')
  const integrationRecovery = {
    deliveryPaths: ['src/parallel.js', '.specdev/assignments/00031_fixture/outcome.md'],
    missionPrefix: '.specdev/missions/M00001_parallel-fixture',
  }
  assert.equal(
    missionIntegrationRecoveryAction({
      ...integrationRecovery,
      phase: 'applying',
      stagedPaths: [],
    }),
    'retry'
  )
  assert.equal(
    missionIntegrationRecoveryAction({
      ...integrationRecovery,
      phase: 'applying',
      stagedPaths: ['src/parallel.js'],
    }),
    'commit'
  )
  assert.equal(
    missionIntegrationRecoveryAction({
      ...integrationRecovery,
      phase: 'committing',
      stagedPaths: ['.specdev/missions/M00001_parallel-fixture/design/assignments.yaml'],
    }),
    'commit'
  )
  assert.throws(
    () =>
      missionIntegrationRecoveryAction({
        ...integrationRecovery,
        phase: 'committing',
        stagedPaths: ['src/unrelated.js'],
      }),
    /Unrelated staged paths/
  )

  const missionGitRoot = join(root, 'mission-worktree-fixture')
  const missionGitSpecdev = join(missionGitRoot, '.specdev')
  const missionFolderName = 'M00001_parallel-fixture'
  const missionGitFolder = join(missionGitSpecdev, 'missions', missionFolderName)
  mkdirSync(missionGitFolder, { recursive: true })
  writeFileSync(join(missionGitSpecdev, '.gitignore'), 'worktrees/\n')
  writeFileSync(join(missionGitSpecdev, '.current'), 'kind: mission\nid: M00001\n')
  writeFileSync(join(missionGitFolder, 'mission.yaml'), 'id: M00001\nstatus: running\n')
  writeFileSync(join(missionGitRoot, 'product.js'), 'export const value = 1\n')
  execFileSync('git', ['init', '-b', 'main'], { cwd: missionGitRoot })
  execFileSync('git', ['config', 'user.email', 'specdev@example.test'], {
    cwd: missionGitRoot,
  })
  execFileSync('git', ['config', 'user.name', 'SpecDev Test'], { cwd: missionGitRoot })
  execFileSync('git', ['add', '-A'], { cwd: missionGitRoot })
  execFileSync('git', ['commit', '-m', 'fixture base'], { cwd: missionGitRoot })
  const missionBase = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: missionGitRoot,
    encoding: 'utf-8',
  }).trim()
  const leased = await ensureMissionWorktree({
    projectRoot: missionGitRoot,
    specdevPath: missionGitSpecdev,
    slot: 'slot-01',
    branch: missionChildBranch('M00001', '00031'),
    baseRevision: missionBase,
  })
  writeFileSync(join(leased.path, 'product.js'), 'export const value = 2\n')
  writeFileSync(join(leased.path, '.specdev', '.current'), 'kind: assignment\nid: 00031\n')
  writeFileSync(
    join(leased.path, '.specdev', 'missions', missionFolderName, 'mission.yaml'),
    'id: M00001\nstatus: child-local\n'
  )
  const deliveredAssignment = join(leased.path, '.specdev', 'assignments', '00031_fixture')
  mkdirSync(deliveredAssignment, { recursive: true })
  writeFileSync(join(deliveredAssignment, 'outcome.md'), '# Outcome\n\nPassed.\n')
  const deliveryRevision = await createMissionChildDelivery({
    worktreePath: leased.path,
    missionPath: join(leased.path, '.specdev', 'missions', missionFolderName),
    missionId: 'M00001',
    childId: '00031',
    wave: 1,
  })
  const deliveryPaths = execFileSync(
    'git',
    ['show', '--format=', '--name-only', deliveryRevision],
    { cwd: leased.path, encoding: 'utf-8' }
  )
  assert.match(deliveryPaths, /product\.js/)
  assert.match(deliveryPaths, /\.specdev\/assignments\/00031_fixture\/outcome\.md/)
  assert.doesNotMatch(deliveryPaths, /\.specdev\/\.current/)
  assert.doesNotMatch(deliveryPaths, /\.specdev\/missions\//)
  const deliveryMessage = execFileSync('git', ['show', '-s', '--format=%B', deliveryRevision], {
    cwd: leased.path,
    encoding: 'utf-8',
  })
  assert.match(deliveryMessage, /SpecDev-Mission: M00001/)
  assert.match(deliveryMessage, /SpecDev-Assignment: 00031/)
  assert.match(deliveryMessage, /SpecDev-Commit-Type: child-delivery/)
  assert.equal(
    await createMissionChildDelivery({
      worktreePath: leased.path,
      missionPath: join(leased.path, '.specdev', 'missions', missionFolderName),
      missionId: 'M00001',
      childId: '00031',
      wave: 1,
    }),
    deliveryRevision
  )
  await removeMissionWorktree({
    projectRoot: missionGitRoot,
    specdevPath: missionGitSpecdev,
    worktreePath: leased.path,
  })
  assert.equal(existsSync(leased.path), false)

  assert.deepEqual(normalizeReviewPolicy(), { brainstorm: 'optional', implementation: 'required' })
  assert.deepEqual(reviewPolicyFromFlags({ 'implementation-review': 'waived' }), {
    brainstorm: 'optional',
    implementation: 'waived',
  })
  assert.throws(
    () => reviewPolicyFromFlags({ 'brainstorm-review': 'never' }),
    /Invalid brainstorm review policy/
  )
  assert.match(
    assignmentContractTemplate({ description: 'Small fix' }),
    /fewest independent observable acceptance criteria \(normally 1-5\)/
  )
  const contractValidationPath = join(root, 'contract-validation.md')
  writeFileSync(
    contractValidationPath,
    assignmentContractTemplate({
      description:
        'Add `.specdev/project_notes/roadmap/todo.md` with a canonical `# Todo` heading.',
    }).replace(/\bTODO\b/g, 'Complete')
  )
  const legitimateTodoContract = await validateContractPath(contractValidationPath)
  assert.equal(legitimateTodoContract.valid, true)
  writeFileSync(
    contractValidationPath,
    assignmentContractTemplate({ description: 'Retain placeholder detection.' })
  )
  const placeholderContract = await validateContractPath(contractValidationPath)
  assert.equal(placeholderContract.valid, false)
  assert.equal(
    placeholderContract.errors.includes('contract still contains TODO placeholders'),
    true
  )
  assert.deepEqual(
    parseGitPorcelainPaths(' D .specdev/.current\n M src/index.js\n?? test/new.js\n'),
    ['.specdev/.current', 'src/index.js', 'test/new.js']
  )

  const workspaceChanges = classifyWorkspaceChanges([
    'src/index.js',
    '.specdev/missions/M00001_demo/mission.yaml',
    '.specdev/missions/M00001_demo/outcome.md',
    '.specdev/assignments/00001_demo/status.json',
    '.specdev/workflows/catalog.json',
    '.specdev/.ripplegraph/checkpoint.json',
  ])
  assert.equal(workspaceChanges.projectPaths.length, 1)
  assert.equal(workspaceChanges.workItemPaths.length, 3)
  assert.equal(workspaceChanges.workItems.length, 2)
  assert.equal(workspaceChanges.infrastructurePaths.length, 2)
  const workspaceSummary = workspaceChangeSummaryLines([
    'src/index.js',
    '.specdev/missions/M00001_demo/mission.yaml',
    '.specdev/workflows/catalog.json',
  ]).join('\n')
  assert.match(workspaceSummary, /Preserve existing project changes: src\/index\.js/)
  assert.match(workspaceSummary, /Project workflow artifacts: missions\/M00001_demo/)
  assert.match(workspaceSummary, /Infrastructure details hidden/)
  assert.doesNotMatch(workspaceSummary, /workflows\/catalog\.json/)

  const attempt = await createAttemptRecord(specdevPath, {
    kind: 'reviewer',
    workspace: '.',
    discussion: 'D00001',
    provider: 'claude',
    model: 'opus',
    guides: [{ id: 'api-security', version: '1' }],
    continuity: {
      mode: 'fallback',
      source_attempt: 'Attempt-00007',
      failed_attempt: 'Attempt-00006',
      reason: 'resume_failed',
    },
  })
  assert.equal(attempt.id, 'Attempt-00008')
  const persistedAttempt = await readAttemptRecord(specdevPath, attempt.id)
  assert.equal(persistedAttempt.discussion, 'D00001')
  assert.equal(persistedAttempt.filesystem, 'read-only')
  assert.equal(persistedAttempt.network, false)
  assert.deepEqual(persistedAttempt.guides, [{ id: 'api-security', version: '1' }])
  assert.deepEqual(persistedAttempt.continuity, {
    mode: 'fallback',
    source_attempt: 'Attempt-00007',
    failed_attempt: 'Attempt-00006',
    reason: 'resume_failed',
  })
  const completedAttempt = await updateAttemptRecord(specdevPath, attempt.id, {
    status: 'completed',
  })
  const repeatedCompletion = await updateAttemptRecord(specdevPath, attempt.id, {
    status: 'completed',
  })
  assert.equal(repeatedCompletion.ended_at, completedAttempt.ended_at)
  writeFileSync(
    join(specdevPath, 'processes', 'ATT-99999.yaml'),
    'id: ATT-99999\nkind: reviewer\nstatus: completed\nworkspace: .\n'
  )
  const legacyAttempt = await readAttemptRecord(specdevPath, 'ATT-99999')
  assert.equal(legacyAttempt.filesystem, 'read-only')
  assert.equal(legacyAttempt.network, false)

  assert.deepEqual(normalizeFtsTerms('parser, parser OR foo_bar src/api.ts ???'), [
    'parser',
    'OR',
    'foo_bar',
    'src/api.ts',
  ])
  assert.equal(normalizeFtsQuery('alpha beta alpha'), '"alpha" OR "beta"')

  mkdirSync(join(specdevPath, 'knowledge', 'architecture'), { recursive: true })
  mkdirSync(join(specdevPath, 'knowledge', 'faq'), { recursive: true })
  writeFileSync(
    join(specdevPath, 'knowledge', 'architecture', 'parser.md'),
    '# Parser architecture\n\nThe command router handles keyword bags and API tokens.\n'
  )
  writeFileSync(
    join(specdevPath, 'knowledge', 'faq', 'current.md'),
    '---\nkind: faq\nstatus: active\nverified_at: 2026-07-21\nreview_after: 2999-01-01\napplies_to:\n  component: current-router\nkeywords: [currentfaq, router]\nsources:\n  - assignments/00001_documented/outcome.md\n---\n\n# Current router FAQ\n\nUse currentfaq guidance.\n'
  )
  writeFileSync(
    join(specdevPath, 'knowledge', 'faq', 'stale.md'),
    '---\nkind: faq\nstatus: active\nverified_at: 2000-01-01\nreview_after: 2000-02-01\nkeywords: [staleappkit, launchservice]\n---\n\n# Stale AppKit FAQ\n\nOld staleappkit workaround.\n'
  )
  writeFileSync(
    join(specdevPath, 'knowledge', 'faq', 'superseded.md'),
    '---\nkind: faq\nstatus: superseded\nverified_at: 2000-01-01\nkeywords: [retiredrouter]\n---\n\n# Retired router FAQ\n\nDo not use retiredrouter.\n'
  )
  writeFileSync(
    join(specdevPath, 'project_notes.md'),
    '# Outside indexed roots\n\nThis file should not be indexed.\n'
  )
  mkdirSync(join(specdevPath, 'adhoc', '2026-07'), { recursive: true })
  writeFileSync(
    join(specdevPath, 'adhoc', '2026-07', 'AH-fixture.md'),
    '# Adhoc AH-fixture\n\nReceipt-only marker: unindexedadhocsecret.\n'
  )
  const rebuilt = await buildKnowledgeIndex(specdevPath)
  assert.equal(rebuilt.documentCount, 4)
  assert.deepEqual(await searchKnowledgeIndex(specdevPath, 'unindexedadhocsecret'), [])
  const search = await searchKnowledgeIndex(specdevPath, 'unmatched router API')
  assert.equal(search[0].path, 'knowledge/architecture/parser.md')
  assert.equal(search[0].coverage, 2 / 3)
  const currentFaq = await searchKnowledgeIndex(specdevPath, 'currentfaq')
  assert.equal(currentFaq[0].freshness, 'current')
  assert.deepEqual(currentFaq[0].applies_to, { component: 'current-router' })
  assert.deepEqual(await searchKnowledgeIndex(specdevPath, 'staleappkit'), [])
  const staleFaq = await searchKnowledgeIndex(specdevPath, 'staleappkit', { includeStale: true })
  assert.equal(staleFaq[0].freshness, 'stale')
  assert.deepEqual(await searchKnowledgeIndex(specdevPath, 'retiredrouter'), [])
  const supersededFaq = await searchKnowledgeIndex(specdevPath, 'retiredrouter', {
    scope: 'history',
  })
  assert.equal(supersededFaq[0].freshness, 'superseded')
  const supersession = parseKnowledgeMetadata(
    '---\nstatus: superseded\nsuperseded_by: knowledge/faq/current.md\n---\n\n# Old\n',
    'knowledge/faq/old.md'
  )
  assert.equal(supersession.supersededBy, 'knowledge/faq/current.md')
  assert.equal(knowledgeFreshness({ reviewAfter: '2000-01-01' }, '2026-07-21'), 'stale')
  assert.throws(
    () =>
      parseKnowledgeMetadata(
        '---\nstatus: unknown\n---\n\n# Invalid\n',
        'knowledge/faq/invalid.md'
      ),
    /status must be active or superseded/
  )

  const distillationSpecdevPath = join(root, 'distillation-state')
  await fse.copy(join(specdevPath, 'knowledge'), join(distillationSpecdevPath, 'knowledge'))
  const unreferencedAssignmentPath = join(
    distillationSpecdevPath,
    'assignments',
    '00009_distill-me'
  )
  mkdirSync(unreferencedAssignmentPath, { recursive: true })
  writeFileSync(
    join(unreferencedAssignmentPath, 'status.json'),
    JSON.stringify({ status: 'completed', mission: 'M00009' })
  )
  writeFileSync(
    join(unreferencedAssignmentPath, 'outcome.md'),
    '# Distill me\n\nReusable repository behavior.\n'
  )
  let distillation = await buildKnowledgeDistillationBrief(distillationSpecdevPath, {
    now: '2026-07-21',
  })
  assert.equal(
    distillation.unreferenced_sources.some((source) => source.assignment === '00009_distill-me'),
    true
  )
  assert.equal(
    distillation.stale_faqs.some((faq) => faq.path === 'knowledge/faq/stale.md'),
    true
  )
  const missionDistillation = await buildKnowledgeDistillationBrief(distillationSpecdevPath, {
    mission: 'M00009',
    now: '2026-07-21',
  })
  assert.equal(missionDistillation.unreferenced_sources[0].assignment, '00009_distill-me')
  writeFileSync(
    join(distillationSpecdevPath, 'knowledge', 'faq', 'distilled.md'),
    '---\nkind: faq\nstatus: active\nsources:\n  - assignments/00009_distill-me/outcome.md\n---\n\n# Distilled behavior\n\nCurrent guidance.\n'
  )
  distillation = await buildKnowledgeDistillationBrief(distillationSpecdevPath, {
    now: '2026-07-21',
  })
  assert.equal(
    distillation.unreferenced_sources.some((source) => source.assignment === '00009_distill-me'),
    false
  )

  await writeCurrentFocus(specdevPath, { kind: 'mission', id: 'M00001' })
  assert.deepEqual(await readCurrentFocus(specdevPath), { kind: 'mission', id: 'M00001' })

  const completedRunId = 'mission-lifecycle-test-run'
  const now = new Date().toISOString()
  writeCheckpoint(specdevPath, {
    runId: completedRunId,
    status: 'active',
    rootGraph: 'mission-lifecycle',
    workflow: { id: 'specdev', version: '1' },
    position: { graph: 'mission-lifecycle', node: 'final-verification' },
    createdAt: now,
    updatedAt: now,
    outputs: {},
    gateDecisions: {},
    stack: [],
    frameCounter: 0,
  })
  writeRippleCurrent(specdevPath, { focusedRunId: completedRunId })
  const missionAttempt = await createAttemptRecord(specdevPath, {
    kind: 'mission-controller',
    workspace: '.',
    mission: 'M00001',
  })
  await updateAttemptRecord(specdevPath, missionAttempt.id, { status: 'completed' })
  await assert.rejects(
    compactCompletedWorkflowRuntime(specdevPath, {
      runId: completedRunId,
      attemptFilter: { mission: 'M00001' },
      focus: { kind: 'mission', id: 'M00001' },
    }),
    /cannot compact non-terminal/
  )
  writeCheckpoint(specdevPath, {
    runId: completedRunId,
    status: 'completed',
    rootGraph: 'mission-lifecycle',
    workflow: { id: 'specdev', version: '1' },
    position: { graph: 'mission-lifecycle', node: 'done' },
    createdAt: now,
    updatedAt: new Date().toISOString(),
    outputs: {},
    gateDecisions: {},
    stack: [],
    frameCounter: 0,
    finalOutput: { completed: true },
  })
  const compaction = await compactCompletedWorkflowRuntime(specdevPath, {
    runId: completedRunId,
    attemptFilter: { mission: 'M00001' },
    focus: { kind: 'mission', id: 'M00001' },
  })
  assert.deepEqual(compaction, { compacted: true, run_id: completedRunId, attempts_removed: 2 })
  assert.equal(existsSync(join(specdevPath, '.ripplegraph', 'runs', completedRunId)), false)
  assert.equal(await readAttemptRecord(specdevPath, missionAttempt.id), null)
  assert.equal(await readAttemptRecord(specdevPath, namespacedAttempt.id), null)
  assert.notEqual(await readAttemptRecord(specdevPath, attempt.id), null)
  assert.equal(readRippleCurrent(specdevPath).focusedRunId, null)
  assert.equal(await readCurrentFocus(specdevPath), null)

  const checkpointlessRunId = 'mission-lifecycle-checkpointless-run'
  const checkpointlessRunPath = join(specdevPath, '.ripplegraph', 'runs', checkpointlessRunId)
  mkdirSync(checkpointlessRunPath, { recursive: true })
  await assert.rejects(
    compactCompletedWorkflowRuntime(specdevPath, {
      runId: checkpointlessRunId,
      attemptFilter: { mission: 'M00002' },
      terminalOwner: { mission: 'M00002', status: 'active' },
    }),
    /without verified terminal owner authority/
  )
  assert.equal(existsSync(checkpointlessRunPath), true)

  writeRippleCurrent(specdevPath, { focusedRunId: checkpointlessRunId })
  await assert.rejects(
    compactCompletedWorkflowRuntime(specdevPath, {
      runId: checkpointlessRunId,
      attemptFilter: { mission: 'M00002' },
      terminalOwner: { mission: 'M00002', status: 'completed' },
    }),
    /cannot compact focused checkpoint-less/
  )
  assert.equal(existsSync(checkpointlessRunPath), true)
  writeRippleCurrent(specdevPath, { focusedRunId: null })

  const runningMissionAttempt = await createAttemptRecord(specdevPath, {
    kind: 'mission-controller',
    workspace: '.',
    mission: 'M00002',
  })
  await assert.rejects(
    compactCompletedWorkflowRuntime(specdevPath, {
      runId: checkpointlessRunId,
      attemptFilter: { mission: 'M00002' },
      terminalOwner: { mission: 'M00002', status: 'completed' },
    }),
    new RegExp(`running Attempts: ${runningMissionAttempt.id}`)
  )
  assert.equal(existsSync(checkpointlessRunPath), true)
  await updateAttemptRecord(specdevPath, runningMissionAttempt.id, { status: 'completed' })
  assert.deepEqual(
    await compactCompletedWorkflowRuntime(specdevPath, {
      runId: checkpointlessRunId,
      attemptFilter: { mission: 'M00002' },
      terminalOwner: { mission: 'M00002', status: 'completed' },
    }),
    { compacted: true, run_id: checkpointlessRunId, attempts_removed: 1 }
  )
  assert.equal(existsSync(checkpointlessRunPath), false)

  const templateGuides = resolve('templates', '.specdev', 'guides')
  await fse.copy(templateGuides, join(specdevPath, 'guides'))
  const catalog = await loadGuideCatalog(specdevPath)
  assert.deepEqual(
    catalog.map((entry) => entry.id),
    ['frontend', 'api-security']
  )
  assert.equal(
    (await resolveGuides(specdevPath, ['api-security'], { phase: 'brainstorm' })).length,
    1
  )
  await assert.rejects(
    resolveGuides(specdevPath, ['frontend'], { phase: 'brainstorm' }),
    /does not apply/
  )

  const deliveryPath = join(specdevPath, 'assignments', '00001_delivery')
  mkdirSync(join(deliveryPath, 'design'), { recursive: true })
  mkdirSync(join(deliveryPath, 'implementation'), { recursive: true })
  writeFileSync(
    join(deliveryPath, 'design', 'plan.md'),
    '# Plan\n\nImplementation Guides: [api-security]\nReview Guides: [frontend]\n\n## Tasks\n\n- T-1 covers AC-1.\n'
  )
  writeFileSync(
    join(deliveryPath, 'implementation', 'progress.json'),
    JSON.stringify({
      version: 1,
      tasks: [{ id: 'T-1', status: 'completed' }],
      selected_guides: { implementation: ['api-security'], review: ['frontend'] },
      verification: [
        {
          command: 'node focused-check.js',
          revision: 'working-tree@fixture',
          scope: 'AC-1',
          status: 'passed',
          duration_ms: 10,
          role: 'authoritative_acceptance',
        },
      ],
      deviations: [],
      follow_up: 'none',
    })
  )
  writeFileSync(
    join(deliveryPath, 'outcome.md'),
    '# Outcome\n\n## Delivered behavior\n\nDelivered.\n\n## Deviations\n\nNone.\n\n## Unresolved risks\n\nNone.\n\n| Acceptance | Evidence | Result |\n|---|---|---|\n| AC-1 | Inspection | Passed |\n'
  )
  const delivery = await validateDeliveryArtifacts(specdevPath, deliveryPath, ['AC-1'])
  assert.doesNotThrow(() => assertReviewWaiverEvidence(delivery, ['AC-1']))
  assert.deepEqual(delivery.progress.selected_guide_versions.review, [
    { id: 'frontend', version: '1' },
  ])
  writeFileSync(
    join(deliveryPath, 'design', 'plan.md'),
    '# Plan\n\n**Implementation Guides:** [api-security]\n**Review Guides:** [frontend]\n\n1. **T-1: Deliver it.** Covers AC-1.\n'
  )
  await validateDeliveryArtifacts(specdevPath, deliveryPath, ['AC-1'])
  writeFileSync(
    join(deliveryPath, 'outcome.md'),
    '# Outcome\n\n## Delivered behavior\n\nDelivered.\n\n## Deviations\n\nNone.\n\n## Unresolved risks\n\nNone.\n\n| Acceptance | Evidence | Result |\n|---|---|---|\n| AC-1 | Inspection | Passed. |\n'
  )
  await validateDeliveryArtifacts(specdevPath, deliveryPath, ['AC-1'])
  writeFileSync(
    join(deliveryPath, 'design', 'plan.md'),
    '# Plan\n\n**Implementation Guides:** [api-security]\n**Review Guides:** [frontend]\n\n## Tasks\n\n- T-1 covers AC-1 and unknown AC-99.\n'
  )
  await assert.rejects(
    validateDeliveryArtifacts(specdevPath, deliveryPath, ['AC-1']),
    /unknown acceptance criterion AC-99/
  )
  writeFileSync(
    join(deliveryPath, 'design', 'plan.md'),
    '# Plan\n\n**Implementation Guides:** [api-security]\n**Review Guides:** [frontend]\n\n## Tasks\n\n- T-1 covers AC-1.\n'
  )
  writeFileSync(join(deliveryPath, 'outcome.md'), '# Outcome\n\nNo acceptance table.\n')
  await assert.rejects(
    validateDeliveryArtifacts(specdevPath, deliveryPath, ['AC-1']),
    /requires ## Delivered behavior|no final Passed/
  )

  const legacyRiskIssues = []
  assert.deepEqual(
    summarizeRisks('# Outcome\n\nUnresolved risks: none blocking.\n', legacyRiskIssues),
    { status: 'none', items: [], source: 'legacy_inline' }
  )
  assert.deepEqual(legacyRiskIssues, [])
  const caveatIssues = []
  assert.equal(
    summarizeRisks(
      '# Outcome\n\nUnresolved risks: none blocking. This remains a smoke test.\n',
      caveatIssues
    ).status,
    'present'
  )
  const verificationIssues = []
  const verificationSummary = summarizeVerification(
    [
      {
        command: 'node harness-probe.js',
        revision: 'working-tree@fixture',
        scope: 'harness',
        status: 'failed',
        duration_ms: 2,
        role: 'qualification',
      },
      {
        command: 'node acceptance.js',
        revision: 'working-tree@fixture',
        scope: 'AC-1',
        status: 'passed',
        duration_ms: 3,
        role: 'authoritative_acceptance',
      },
    ],
    verificationIssues
  )
  assert.equal(verificationSummary.by_role.qualification.failed, 1)
  assert.equal(verificationSummary.by_role.authoritative_acceptance.passed, 1)
  assert.deepEqual(verificationIssues, [])

  const retryLedger = [
    {
      command: 'node retry-acceptance.js',
      revision: 'working-tree@fixture',
      scope: 'first authoritative attempt',
      status: 'failed',
      duration_ms: 2,
      role: 'authoritative_acceptance',
    },
    {
      command: 'node retry-acceptance.js',
      revision: 'working-tree@fixture',
      scope: 'passing authoritative retry with different scope prose',
      status: 'passed',
      duration_ms: 3,
      role: 'authoritative_acceptance',
    },
    {
      command: 'node retry-qualification.js',
      revision: 'working-tree@fixture',
      scope: 'first qualification attempt',
      status: 'failed',
      duration_ms: 1,
      role: 'qualification',
    },
    {
      command: 'node retry-qualification.js',
      revision: 'working-tree@fixture',
      scope: 'passing qualification retry',
      status: 'passed',
      duration_ms: 1,
      role: 'qualification',
    },
    ...Array.from({ length: 12 }, (_, index) => ({
      command: `node acceptance-${index + 1}.js`,
      revision: 'working-tree@fixture',
      scope: `authoritative obligation ${index + 1}`,
      status: 'passed',
      duration_ms: index + 1,
      role: 'authoritative_acceptance',
    })),
  ]
  const preservedRetryLedger = structuredClone(retryLedger)
  const projectedIssues = []
  const projectedVerification = summarizeVerification(retryLedger, projectedIssues)
  assert.deepEqual(retryLedger, preservedRetryLedger)
  assert.deepEqual(projectedIssues, [])
  assert.equal(projectedVerification.raw.total, 16)
  assert.equal(projectedVerification.raw.counts.failed, 2)
  assert.equal(projectedVerification.effective.total, 14)
  assert.equal(projectedVerification.effective.counts.passed, 14)
  assert.equal(projectedVerification.superseded, 2)
  assert.equal(projectedVerification.items.length, 12)
  assert.equal(projectedVerification.omitted, 2)
  assert.equal(projectedVerification.authoritative_evidence.length, 12)
  assert.equal(projectedVerification.authoritative_evidence_omitted, 1)
  assert.equal(
    projectedVerification.items.find((item) => item.command === 'node retry-acceptance.js')
      .attempts,
    2
  )

  const distinctRevisionIssues = []
  summarizeVerification(
    [
      ...retryLedger,
      {
        ...retryLedger[0],
        revision: 'working-tree@different',
        scope: 'unresolved authoritative obligation on another revision',
      },
    ],
    distinctRevisionIssues
  )
  assert(distinctRevisionIssues.includes('authoritative_verification_not_passed'))

  const roleSeparationIssues = []
  summarizeVerification(
    [
      retryLedger[0],
      {
        ...retryLedger[1],
        role: 'qualification',
      },
    ],
    roleSeparationIssues
  )
  assert(roleSeparationIssues.includes('authoritative_verification_not_passed'))

  const skippedAuthorityIssues = []
  summarizeVerification(
    [
      retryLedger[1],
      {
        ...retryLedger[1],
        status: 'skipped',
        scope: 'latest authoritative attempt was skipped',
      },
    ],
    skippedAuthorityIssues
  )
  assert(skippedAuthorityIssues.includes('authoritative_verification_not_passed'))

  const manyUnresolvedIssues = []
  const manyUnresolved = summarizeVerification(
    Array.from({ length: 13 }, (_, index) => ({
      command: `node unresolved-${index + 1}.js`,
      revision: 'working-tree@fixture',
      scope: `unresolved authoritative obligation ${index + 1}`,
      status: 'failed',
      duration_ms: index + 1,
      role: 'authoritative_acceptance',
    })),
    manyUnresolvedIssues
  )
  assert(manyUnresolvedIssues.includes('authoritative_verification_not_passed'))
  assert.equal(manyUnresolvedIssues.includes('verification_evidence_incomplete'), false)
  assert.equal(manyUnresolved.items.length, 12)
  assert.equal(manyUnresolved.omitted, 1)

  const candidateRoot = join(root, 'candidate-repo')
  const candidateSpecdev = join(candidateRoot, '.specdev')
  const candidatePath = join(candidateSpecdev, 'assignments', '00002_candidate')
  mkdirSync(join(candidatePath, 'brainstorm'), { recursive: true })
  mkdirSync(join(candidatePath, 'design'), { recursive: true })
  mkdirSync(join(candidatePath, 'implementation'), { recursive: true })
  execFileSync('git', ['init'], { cwd: candidateRoot })
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: candidateRoot })
  execFileSync('git', ['config', 'user.name', 'SpecDev Test'], { cwd: candidateRoot })
  writeFileSync(join(candidateRoot, 'product.js'), 'export const value = 1\n')
  execFileSync('git', ['add', '.'], { cwd: candidateRoot })
  execFileSync('git', ['commit', '-m', 'fixture'], { cwd: candidateRoot })
  writeFileSync(
    join(candidatePath, 'brainstorm', 'contract.md'),
    assignmentContractTemplate({ description: 'Candidate fixture' }).replace(/TODO/g, 'None')
  )
  writeFileSync(
    join(candidatePath, 'design', 'plan.md'),
    readFileSync(join(deliveryPath, 'design', 'plan.md'))
  )
  const candidateProgressPath = join(candidatePath, 'implementation', 'progress.json')
  const candidateProgress = JSON.parse(
    readFileSync(join(deliveryPath, 'implementation', 'progress.json'), 'utf8')
  )
  candidateProgress.verification = retryLedger
  writeFileSync(candidateProgressPath, `${JSON.stringify(candidateProgress, null, 2)}\n`)
  const canonicalOutcome =
    '# Outcome\n\n## Delivered behavior\n\nDelivered.\n\n## Deviations\n\nNone.\n\n## Unresolved risks\n\nNone.\n\n| Acceptance | Evidence | Result |\n| --- | --- | --- |\n| AC-1 | Focused evidence. | Passed |\n'
  writeFileSync(join(candidatePath, 'outcome.md'), canonicalOutcome)
  writeFileSync(join(candidateRoot, 'product.js'), 'export const value = 2\n')
  const firstCandidate = await buildStandaloneAssignmentCandidateReceipt({
    targetDir: candidateRoot,
    assignmentPath: candidatePath,
    assignmentStatus: { id: '00002' },
  })
  assert.equal(firstCandidate.completeness, 'complete')
  assert.equal(firstCandidate.verification.raw.total, 16)
  assert.equal(firstCandidate.verification.effective.total, 14)
  assert.equal(firstCandidate.verification.superseded, 2)
  const preservedProgressBytes = readFileSync(candidateProgressPath, 'utf8')
  await buildStandaloneAssignmentCandidateReceipt({
    targetDir: candidateRoot,
    assignmentPath: candidatePath,
    assignmentStatus: { id: '00002' },
  })
  assert.equal(readFileSync(candidateProgressPath, 'utf8'), preservedProgressBytes)
  const legacyCandidate = structuredClone(firstCandidate)
  delete legacyCandidate.verification.raw
  delete legacyCandidate.verification.effective
  delete legacyCandidate.verification.superseded
  delete legacyCandidate.verification.authoritative_evidence_omitted
  assert.doesNotThrow(() => validateStandaloneAssignmentCandidateReceipt(legacyCandidate))
  writeFileSync(join(candidatePath, 'outcome.md'), canonicalOutcome.replace('Focused', 'Changed'))
  const changedCandidate = await buildStandaloneAssignmentCandidateReceipt({
    targetDir: candidateRoot,
    assignmentPath: candidatePath,
    assignmentStatus: { id: '00002' },
  })
  assert.notEqual(changedCandidate.identity, firstCandidate.identity)

  const reviewerProfile = {
    provider: 'claude',
    model: 'fixture',
    effort: 'high',
    timeout_ms: 60_000,
    filesystem: 'read-only',
    network: false,
  }
  const reviewerFindingsIdentity = 'a'.repeat(64)
  const fakeProviderBin = join(root, 'candidate-fake-bin')
  const fakeProviderArgs = join(candidateRoot, '.git', 'claude-args.jsonl')
  mkdirSync(fakeProviderBin, { recursive: true })
  writeFileSync(
    join(fakeProviderBin, 'claude'),
    `#!/usr/bin/env node
const { appendFileSync, readFileSync } = require('node:fs')
readFileSync(0, 'utf8')
const args = process.argv.slice(2)
appendFileSync(${JSON.stringify(fakeProviderArgs)}, JSON.stringify(args) + '\\n')
const resumeIndex = args.indexOf('--resume')
const resumed = resumeIndex >= 0
const requestedSessionId = resumed ? args[resumeIndex + 1] : null
const sessionId = requestedSessionId === 'session_force_failure' ? 'different_session' : (requestedSessionId || ${JSON.stringify(sessionId)})
const verdict = resumed ? 'approved' : 'needs_changes'
const findings = resumed ? 'The repaired candidate closes the finding.' : 'Repair the bounded candidate.'
const result = ['---', 'verdict: ' + verdict, 'material_divergence: false', 'scope_divergence: none', 'procedure_divergence: none', 'evidence_integrity: complete', 'user_reapproval_required: false', '---', '', '## Findings', '', findings, ''].join('\\n')
process.stdout.write(JSON.stringify({ session_id: sessionId, result }))
`
  )
  chmodSync(join(fakeProviderBin, 'claude'), 0o755)
  const previousPath = process.env.PATH
  process.env.PATH = `${fakeProviderBin}:${previousPath}`
  let freshSessionReview
  let continuedSessionReview
  let repairedCandidate
  try {
    freshSessionReview = await runSpawnedAgent({
      targetDir: candidateRoot,
      specdevPath: candidateSpecdev,
      role: 'reviewer',
      profile: reviewerProfile,
      prompt: 'Review the first candidate in a fresh provider session.',
      resultPath: join(candidatePath, 'review', 'session-verdict.md'),
      resultKind: 'reviewer',
      assignment: '00002_candidate',
      providerSession: { mode: 'capture' },
      continuity: { mode: 'fresh' },
    })
    assert.equal(freshSessionReview.status, 'completed')
    assert.equal(freshSessionReview.providerSessionId, sessionId)
    assert.equal(freshSessionReview.result.frontmatter.verdict, 'needs_changes')

    await createReviewerContinuationLease({
      targetDir: candidateRoot,
      specdevPath: candidateSpecdev,
      assignmentPath: candidatePath,
      assignmentId: '00002',
      profile: reviewerProfile,
      contractHash: changedCandidate.contract.hash,
      candidateReceipt: changedCandidate,
      findingsIdentity: reviewerFindingsIdentity,
      sourceAttempt: freshSessionReview.attempt.id,
      round: 1,
      providerSessionId: sessionId,
    })
    assert.equal(existsSync(reviewerContinuationLeasePath(candidateSpecdev, candidatePath)), true)
    writeFileSync(join(candidateRoot, 'product.js'), 'export const value = 3\n')
    writeFileSync(
      join(candidatePath, 'outcome.md'),
      canonicalOutcome.replace('Focused', 'Repaired')
    )
    repairedCandidate = await buildStandaloneAssignmentCandidateReceipt({
      targetDir: candidateRoot,
      assignmentPath: candidatePath,
      assignmentStatus: { id: '00002' },
    })
    const continuation = await preparePrimaryReviewerContinuation({
      targetDir: candidateRoot,
      specdevPath: candidateSpecdev,
      assignmentPath: candidatePath,
      assignmentId: '00002',
      profile: reviewerProfile,
      contractHash: changedCandidate.contract.hash,
      candidateReceipt: repairedCandidate,
      reviewState: {
        stage: 'primary',
        status: 'converging',
        primary_round: 1,
        attempt: freshSessionReview.attempt.id,
        candidate_receipt_identity: changedCandidate.identity,
        findings_digest: reviewerFindingsIdentity,
      },
    })
    assert.equal(continuation.status, 'eligible')
    assert.equal(continuation.session.id, sessionId)
    assert.match(continuation.prompt, /Bounded reviewed-to-repaired delta/)
    assert.equal(existsSync(reviewerContinuationLeasePath(candidateSpecdev, candidatePath)), false)

    continuedSessionReview = await runSpawnedAgent({
      targetDir: candidateRoot,
      specdevPath: candidateSpecdev,
      role: 'reviewer',
      profile: reviewerProfile,
      prompt: continuation.prompt,
      resultPath: join(candidatePath, 'review', 'session-verdict.md'),
      resultKind: 'reviewer',
      assignment: '00002_candidate',
      providerSession: continuation.session,
      continuity: { mode: 'continued', source_attempt: continuation.sourceAttempt },
      allowFormatCorrection: false,
    })
    assert.equal(continuedSessionReview.status, 'completed')
    assert.equal(continuedSessionReview.result.frontmatter.verdict, 'approved')
    assert.notEqual(continuedSessionReview.attempt.id, freshSessionReview.attempt.id)
    assert.deepEqual(continuedSessionReview.attempt.continuity, {
      mode: 'continued',
      source_attempt: freshSessionReview.attempt.id,
    })
  } finally {
    process.env.PATH = previousPath
  }
  process.env.PATH = `${fakeProviderBin}:${previousPath}`
  let failedResume
  let freshFallback
  try {
    failedResume = await runSpawnedAgent({
      targetDir: candidateRoot,
      specdevPath: candidateSpecdev,
      role: 'reviewer',
      profile: reviewerProfile,
      prompt: 'Attempt one exact resume that the provider cannot confirm.',
      resultPath: join(candidatePath, 'review', 'fallback-verdict.md'),
      resultKind: 'reviewer',
      assignment: '00002_candidate',
      providerSession: { mode: 'resume', id: 'session_force_failure' },
      continuity: { mode: 'continued', source_attempt: freshSessionReview.attempt.id },
      allowFormatCorrection: false,
    })
    assert.equal(failedResume.status, 'failed')
    freshFallback = await runSpawnedAgent({
      targetDir: candidateRoot,
      specdevPath: candidateSpecdev,
      role: 'reviewer',
      profile: reviewerProfile,
      prompt: 'Perform the single fresh fallback review.',
      resultPath: join(candidatePath, 'review', 'fallback-verdict.md'),
      resultKind: 'reviewer',
      assignment: '00002_candidate',
      providerSession: { mode: 'capture' },
      continuity: {
        mode: 'fallback',
        source_attempt: freshSessionReview.attempt.id,
        failed_attempt: failedResume.attempt.id,
        reason: 'resume_failed',
      },
    })
    assert.equal(freshFallback.status, 'completed')
    assert.deepEqual(freshFallback.attempt.continuity, {
      mode: 'fallback',
      source_attempt: freshSessionReview.attempt.id,
      failed_attempt: failedResume.attempt.id,
      reason: 'resume_failed',
    })
  } finally {
    process.env.PATH = previousPath
  }
  const providerInvocations = readFileSync(fakeProviderArgs, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  assert.equal(providerInvocations[0].includes('--resume'), false)
  assert.deepEqual(
    providerInvocations[1].slice(
      providerInvocations[1].indexOf('--resume'),
      providerInvocations[1].indexOf('--resume') + 2
    ),
    ['--resume', sessionId]
  )
  assert.equal(providerInvocations.length, 4)
  assert.equal(providerInvocations[2].includes('session_force_failure'), true)
  assert.equal(providerInvocations[3].includes('--resume'), false)
  assert.equal(
    (
      await preparePrimaryReviewerContinuation({
        targetDir: candidateRoot,
        specdevPath: candidateSpecdev,
        assignmentPath: candidatePath,
        assignmentId: '00002',
        profile: reviewerProfile,
        contractHash: changedCandidate.contract.hash,
        candidateReceipt: repairedCandidate,
        reviewState: {
          stage: 'primary',
          status: 'converging',
          primary_round: 1,
          attempt: freshSessionReview.attempt.id,
          candidate_receipt_identity: changedCandidate.identity,
          findings_digest: reviewerFindingsIdentity,
        },
      })
    ).reason,
    'lease_missing'
  )

  await createReviewerContinuationLease({
    targetDir: candidateRoot,
    specdevPath: candidateSpecdev,
    assignmentPath: candidatePath,
    assignmentId: '00002',
    profile: reviewerProfile,
    contractHash: repairedCandidate.contract.hash,
    candidateReceipt: repairedCandidate,
    findingsIdentity: reviewerFindingsIdentity,
    sourceAttempt: continuedSessionReview.attempt.id,
    round: 1,
    providerSessionId: sessionId,
  })
  writeFileSync(join(candidateRoot, 'unrelated.js'), 'export const unrelated = true\n')
  const unrelatedCandidate = await buildStandaloneAssignmentCandidateReceipt({
    targetDir: candidateRoot,
    assignmentPath: candidatePath,
    assignmentStatus: { id: '00002' },
  })
  const unrelatedContinuation = await preparePrimaryReviewerContinuation({
    targetDir: candidateRoot,
    specdevPath: candidateSpecdev,
    assignmentPath: candidatePath,
    assignmentId: '00002',
    profile: reviewerProfile,
    contractHash: repairedCandidate.contract.hash,
    candidateReceipt: unrelatedCandidate,
    reviewState: {
      stage: 'primary',
      status: 'converging',
      primary_round: 1,
      attempt: continuedSessionReview.attempt.id,
      candidate_receipt_identity: repairedCandidate.identity,
      findings_digest: reviewerFindingsIdentity,
    },
  })
  assert.equal(unrelatedContinuation.reason, 'unrelated_candidate_change')
  rmSync(join(candidateRoot, 'unrelated.js'))

  const invalidationCases = [
    ['lease_expired', (lease) => (lease.expires_at = '2000-01-01T00:00:00.000Z'), reviewerProfile],
    ['assignment_mismatch', (lease) => (lease.assignment.id = '99999'), reviewerProfile],
    ['role_mismatch', (lease) => (lease.role = 'arbiter'), reviewerProfile],
    ['profile_mismatch', (lease) => (lease.profile.model = 'other-model'), reviewerProfile],
    [
      'permission_mismatch',
      (lease) => (lease.permissions.filesystem = 'workspace-write'),
      reviewerProfile,
    ],
    ['contract_mismatch', (lease) => (lease.contract_hash = 'b'.repeat(64)), reviewerProfile],
    ['cwd_mismatch', (lease) => (lease.cwd = '/different/workspace'), reviewerProfile],
    [
      'candidate_baseline_mismatch',
      (lease) => (lease.reviewed_candidate.identity = 'b'.repeat(64)),
      reviewerProfile,
    ],
    ['findings_mismatch', (lease) => (lease.findings_identity = 'b'.repeat(64)), reviewerProfile],
    [
      'source_attempt_mismatch',
      (lease) => (lease.source_attempt = 'Attempt-99999'),
      reviewerProfile,
    ],
    ['round_mismatch', (lease) => (lease.round = 2), reviewerProfile],
    ['lease_invalid', (lease) => (lease.provider_session_id = 'bad id'), reviewerProfile],
    [
      'provider_unsupported',
      () => {},
      { ...reviewerProfile, provider: 'cursor', model: 'cursor-model', effort: null },
    ],
  ]
  for (const [expectedReason, mutateLease, activeProfile] of invalidationCases) {
    await createReviewerContinuationLease({
      targetDir: candidateRoot,
      specdevPath: candidateSpecdev,
      assignmentPath: candidatePath,
      assignmentId: '00002',
      profile: reviewerProfile,
      contractHash: repairedCandidate.contract.hash,
      candidateReceipt: repairedCandidate,
      findingsIdentity: reviewerFindingsIdentity,
      sourceAttempt: continuedSessionReview.attempt.id,
      round: 1,
      providerSessionId: sessionId,
    })
    const leasePath = reviewerContinuationLeasePath(candidateSpecdev, candidatePath)
    const lease = JSON.parse(readFileSync(leasePath, 'utf8'))
    mutateLease(lease)
    writeFileSync(leasePath, `${JSON.stringify(lease, null, 2)}\n`)
    const invalidated = await preparePrimaryReviewerContinuation({
      targetDir: candidateRoot,
      specdevPath: candidateSpecdev,
      assignmentPath: candidatePath,
      assignmentId: '00002',
      profile: activeProfile,
      contractHash: repairedCandidate.contract.hash,
      candidateReceipt: repairedCandidate,
      reviewState: {
        stage: 'primary',
        status: 'converging',
        primary_round: 1,
        attempt: continuedSessionReview.attempt.id,
        candidate_receipt_identity: repairedCandidate.identity,
        findings_digest: reviewerFindingsIdentity,
      },
    })
    assert.equal(invalidated.reason, expectedReason)
  }
  for (const [expectedReason, candidateReceipt] of [
    ['candidate_incomplete', { ...repairedCandidate, completeness: 'incomplete' }],
    ['candidate_unchanged', repairedCandidate],
  ]) {
    await createReviewerContinuationLease({
      targetDir: candidateRoot,
      specdevPath: candidateSpecdev,
      assignmentPath: candidatePath,
      assignmentId: '00002',
      profile: reviewerProfile,
      contractHash: repairedCandidate.contract.hash,
      candidateReceipt: repairedCandidate,
      findingsIdentity: reviewerFindingsIdentity,
      sourceAttempt: continuedSessionReview.attempt.id,
      round: 1,
      providerSessionId: sessionId,
    })
    const invalidated = await preparePrimaryReviewerContinuation({
      targetDir: candidateRoot,
      specdevPath: candidateSpecdev,
      assignmentPath: candidatePath,
      assignmentId: '00002',
      profile: reviewerProfile,
      contractHash: repairedCandidate.contract.hash,
      candidateReceipt,
      reviewState: {
        stage: 'primary',
        status: 'converging',
        primary_round: 1,
        attempt: continuedSessionReview.attempt.id,
        candidate_receipt_identity: repairedCandidate.identity,
        findings_digest: reviewerFindingsIdentity,
      },
    })
    assert.equal(invalidated.reason, expectedReason)
  }

  const firstArtifactRepair = recordArtifactRepair(
    {},
    { issue: 'authoritative_verification_missing', updatedAt: '2026-08-08T00:00:00.000Z' }
  )
  assert.equal(AUTOMATIC_ARTIFACT_REPAIR_LIMIT, 1)
  assert.equal(firstArtifactRepair.disposition, 'repair')
  assert.equal(firstArtifactRepair.state.artifact_repair_round, 1)
  assert.equal(firstArtifactRepair.state.artifact_repair_limit, 1)
  const exhaustedArtifactRepair = recordArtifactRepair(firstArtifactRepair.state, {
    issue: 'authoritative_verification_missing',
    updatedAt: '2026-08-08T00:01:00.000Z',
  })
  assert.equal(exhaustedArtifactRepair.disposition, 'exhausted')
  assert.equal(exhaustedArtifactRepair.state.disposition, 'blocked')
  assert.equal(exhaustedArtifactRepair.state.artifact_repair_round, 2)

  const originalQueue = {
    version: 2,
    assignments: [
      {
        id: '00009',
        title: 'Completed child',
        kind: 'change',
        wave: 1,
        status: 'completed',
        outcome: '.specdev/assignments/00009_done/outcome.md',
      },
      {
        id: '00010',
        title: 'Pending child',
        kind: 'change',
        wave: 2,
        status: 'pending',
        gap_id: 'gap-earlier',
        gap_stage: 'resolution',
      },
    ],
    final_verification: { command: 'node focused-check.js', scope: 'integrated' },
  }
  assert.equal(await reserveEntityId(specdevPath, 'assignment'), '00009')
  assert.equal(await reserveEntityId(specdevPath, 'assignment'), '00010')
  const replanned = await validateAndReserveReplannedQueue(specdevPath, originalQueue, {
    ...originalQueue,
    assignments: [
      originalQueue.assignments[0],
      { id: '00010', title: 'Refined pending child', kind: 'bugfix', status: 'pending' },
      { title: 'New runtime-owned child', kind: 'documentation', status: 'pending' },
    ],
  })
  assert.equal(replanned.assignments[1].id, '00010')
  assert.equal(replanned.assignments[1].gap_id, 'gap-earlier')
  assert.equal(replanned.assignments[1].gap_stage, 'resolution')
  assert.equal(replanned.assignments[2].id, '00011')
  assert.equal(replanned.assignments[2].wave, 3)
  const gapChild = bindReplannedQueueToGap(originalQueue, replanned, {
    gapId: 'gap-stable',
    stage: 'resolver',
  })
  assert.equal(gapChild.id, '00011')
  assert.equal(gapChild.gap_id, 'gap-stable')
  assert.equal(gapChild.gap_stage, 'resolver')
  assert.throws(
    () =>
      bindReplannedQueueToGap(originalQueue, originalQueue, {
        gapId: 'gap-empty',
        stage: 'resolution',
      }),
    /exactly one focused Assignment/
  )
  await assert.rejects(
    validateAndReserveReplannedQueue(specdevPath, originalQueue, {
      ...originalQueue,
      assignments: [
        { ...originalQueue.assignments[0], title: 'Illegally changed' },
        originalQueue.assignments[1],
      ],
    }),
    /changed protected Assignment/
  )

  assert.throws(
    () =>
      assertMissionTransitionRecorded(
        { synchronized: true, state: { status: 'validation_error' } },
        'replan'
      ),
    /Invalid durable Mission transition/
  )

  console.log('vNext foundation tests passed.')
} finally {
  rmSync(root, { recursive: true, force: true })
}
