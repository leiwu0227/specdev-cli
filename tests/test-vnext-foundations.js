import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import fse from 'fs-extra'
import {
  readCurrent as readRippleCurrent,
  writeCheckpoint,
  writeCurrent as writeRippleCurrent,
} from 'ripplegraph'
import { resolveAgentProfile, validateProfile } from '../src/utils/agent-profiles.js'
import { buildProviderInvocation } from '../src/utils/provider-adapters.js'
import { parseResultEnvelope } from '../src/utils/result-envelope.js'
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
import { validateAndReserveReplannedQueue } from '../src/utils/mission.js'
import {
  createAttemptRecord,
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
} from '../src/utils/assignment-vnext.js'
import {
  classifyWorkspaceChanges,
  parseGitPorcelainPaths,
  workspaceChangeSummaryLines,
} from '../src/utils/workspace-changes.js'
import { compactCompletedWorkflowRuntime } from '../src/utils/artifact-retention.js'
import { durableAttemptStatusForResult } from '../src/utils/spawned-agent.js'

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
  assert.equal(reviewer.network, false)
  const worker = await resolveAgentProfile(specdevPath, 'worker')
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
    /supported only for the codex worker/
  )
  assert.throws(
    () =>
      validateProfile('reviewer', {
        provider: 'codex',
        model: 'gpt-test',
        effort: 'medium',
        network: true,
        timeout: '1m',
      }),
    /supported only for the codex worker/
  )

  const codexReview = buildProviderInvocation({
    profile: { provider: 'codex', model: 'gpt-test', effort: 'high' },
    role: 'reviewer',
    cwd: root,
    resultPath: join(specdevPath, 'cache', 'result.md'),
  })
  assert.equal(codexReview.command, 'codex')
  assert.equal(codexReview.args.includes('read-only'), true)
  assert.equal(
    codexReview.args.some((arg) => arg.includes('dangerously')),
    false
  )
  assert.equal(codexReview.args.includes('sandbox_workspace_write.network_access=true'), false)
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

  const result = parseResultEnvelope(
    `---\nverdict: approved\nmaterial_divergence: false\n---\n\n## Findings\n\nNo blocking findings.\n`,
    'reviewer'
  )
  assert.equal(result.frontmatter.verdict, 'approved')
  assert.throws(() => parseResultEnvelope('approved', 'reviewer'), /frontmatter/)
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
  })
  const persistedAttempt = await readAttemptRecord(specdevPath, attempt.id)
  assert.equal(persistedAttempt.discussion, 'D00001')
  assert.equal(persistedAttempt.network, false)
  assert.deepEqual(persistedAttempt.guides, [{ id: 'api-security', version: '1' }])
  const completedAttempt = await updateAttemptRecord(specdevPath, attempt.id, {
    status: 'completed',
  })
  const repeatedCompletion = await updateAttemptRecord(specdevPath, attempt.id, {
    status: 'completed',
  })
  assert.equal(repeatedCompletion.ended_at, completedAttempt.ended_at)

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
  const rebuilt = await buildKnowledgeIndex(specdevPath)
  assert.equal(rebuilt.documentCount, 4)
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
  assert.deepEqual(compaction, { compacted: true, run_id: completedRunId, attempts_removed: 1 })
  assert.equal(existsSync(join(specdevPath, '.ripplegraph', 'runs', completedRunId)), false)
  assert.equal(await readAttemptRecord(specdevPath, missionAttempt.id), null)
  assert.notEqual(await readAttemptRecord(specdevPath, attempt.id), null)
  assert.equal(readRippleCurrent(specdevPath).focusedRunId, null)
  assert.equal(await readCurrentFocus(specdevPath), null)

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
      verification: [],
      deviations: [],
      follow_up: 'none',
    })
  )
  writeFileSync(
    join(deliveryPath, 'outcome.md'),
    '# Outcome\n\n| Criterion | Evidence | Result |\n|---|---|---|\n| AC-1 | Inspection | Passed |\n'
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
    '# Outcome\n\n| Criterion | Evidence | Result |\n|---|---|---|\n| AC-1 | Inspection | Passed. |\n'
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
    /no final Passed/
  )

  const originalQueue = {
    version: 1,
    assignments: [
      {
        id: '00009',
        title: 'Completed child',
        kind: 'change',
        status: 'completed',
        outcome: '.specdev/assignments/00009_done/outcome.md',
      },
      { id: '00010', title: 'Pending child', kind: 'change', status: 'pending' },
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
  assert.equal(replanned.assignments[2].id, '00011')
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

  console.log('vNext foundation tests passed.')
} finally {
  rmSync(root, { recursive: true, force: true })
}
