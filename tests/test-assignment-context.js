import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stringify } from 'yaml'
import {
  buildAssignmentContextCatalog,
  renderAssignmentContextCatalog,
  selectMissionSupportingEnvelope,
} from '../src/utils/assignment-context.js'
import { inlineImplementationObligations } from '../src/utils/assignment-execution.js'
import { validateAndReserveReplannedQueue } from '../src/utils/mission.js'
import { createAttemptRecord, readAttemptRecord } from '../src/utils/process-record.js'

const root = mkdtempSync(join(tmpdir(), 'specdev-assignment-context-'))
const specdevPath = join(root, '.specdev')
const assignmentPath = join(specdevPath, 'assignments', '00001_selective-context')

try {
  write(join(root, 'AGENTS.md'), '# Repository rules\n')
  write(join(specdevPath, '_main.md'), '# Workflow authority\n')
  write(
    join(specdevPath, 'project_notes', 'big_picture.md'),
    '# Project context\n\nThis project uses a selective Assignment context catalog.\n'
  )
  const designPath = join(
    specdevPath,
    'project_notes',
    'roadmap',
    'designs',
    'assignment_selective_context_catalog.md'
  )
  write(designPath, '# Assignment selective context catalog\n')
  write(
    join(specdevPath, 'knowledge', 'architecture', 'selective-context.md'),
    `---\nstatus: active\nreview_after: 2099-01-01\n---\n# Selective context catalog\n\nUse durable paths.\n`
  )
  write(
    join(specdevPath, 'knowledge', 'architecture', 'stale-selective-context.md'),
    `---\nstatus: active\nreview_after: 2000-01-01\n---\n# Selective context catalog stale note\n`
  )
  write(
    join(specdevPath, 'guides', 'project', 'catalog.yaml'),
    stringify({
      version: 1,
      guides: [
        {
          id: 'context-design',
          version: '1',
          summary: 'Implement selective context catalog behavior.',
          signals: ['selective', 'context', 'catalog'],
          phases: ['implementation', 'brainstorm', 'mission'],
          path: 'context-design.md',
        },
      ],
    })
  )
  write(join(specdevPath, 'guides', 'project', 'context-design.md'), '# Context guide\n')
  write(join(specdevPath, 'guides', 'review.md'), '# Common review guide\n')
  write(
    join(assignmentPath, 'status.json'),
    JSON.stringify({ version: 1, id: '00001', description: 'Selective context catalog' })
  )
  const contractPath = join(assignmentPath, 'brainstorm', 'contract.md')
  write(
    contractPath,
    `# Assignment contract\n\n## Objective and context\n\nImplement a selective Assignment context catalog.\n\n## Acceptance criteria\n\n- AC-1: Context is bounded.\n`
  )

  const implementation = await buildAssignmentContextCatalog({
    targetDir: root,
    specdevPath,
    assignmentPath,
    phase: 'implementation',
    role: 'implementation-owner',
  })
  assert.deepEqual(
    [...new Set(implementation.entries.map((entry) => entry.group))],
    ['authority', 'task', 'supporting']
  )
  assert.equal(
    implementation.entries.every((entry) => !entry.path.startsWith('/')),
    true
  )
  assert.equal(
    implementation.entries.some(
      (entry) => entry.kind === 'project-guide' && entry.path.endsWith('context-design.md')
    ),
    true
  )
  assert.equal(
    implementation.entries.some(
      (entry) => entry.kind === 'living-knowledge' && entry.path.endsWith('selective-context.md')
    ),
    true
  )
  assert.equal(
    implementation.entries.some((entry) => entry.path.endsWith('stale-selective-context.md')),
    false
  )
  assert.equal(
    implementation.entries.some(
      (entry) =>
        entry.kind === 'roadmap-design' && entry.path.endsWith(designPath.slice(root.length + 1))
    ),
    true
  )
  const rendered = renderAssignmentContextCatalog(implementation)
  assert.match(rendered, /authority:\n/)
  assert.match(rendered, /role_history:\n- none/)
  assert.equal(rendered.includes('Use durable paths.'), false)

  const inline = await inlineImplementationObligations({
    targetDir: root,
    assignmentPath,
    contract: { path: contractPath },
  })
  assert.deepEqual(
    inline.context_catalog.entries.map((entry) => entry.identity),
    implementation.entries.map((entry) => entry.identity)
  )
  const recovery = await inlineImplementationObligations({
    targetDir: root,
    assignmentPath,
    contract: { path: contractPath },
    issue: 'The delivery artifacts are incomplete.',
  })
  assert.equal(recovery.context_catalog.phase, 'implementation-recovery')
  assert.equal(
    recovery.context_catalog.entries.some((entry) => entry.kind === 'design-plan'),
    false
  )

  write(join(assignmentPath, 'review', 'brainstorm-baseline.md'), '# Frozen baseline\n')
  write(join(assignmentPath, 'review', 'brainstorm-verdict.md'), '# Durable prior findings\n')
  const firstReview = await buildAssignmentContextCatalog({
    targetDir: root,
    specdevPath,
    assignmentPath,
    phase: 'contract-review',
    role: 'primary-reviewer',
  })
  assert.equal(
    firstReview.entries.some((entry) => entry.group === 'role_history'),
    false
  )
  assert.equal(
    firstReview.entries.some((entry) => entry.kind === 'review-findings'),
    false
  )
  const laterReview = await buildAssignmentContextCatalog({
    targetDir: root,
    specdevPath,
    assignmentPath,
    phase: 'contract-review',
    role: 'primary-reviewer',
    includePriorFindings: true,
  })
  assert.deepEqual(
    laterReview.entries
      .filter((entry) => entry.group === 'role_history')
      .map((entry) => entry.kind),
    ['prior-findings']
  )
  const arbiter = await buildAssignmentContextCatalog({
    targetDir: root,
    specdevPath,
    assignmentPath,
    phase: 'contract-review',
    role: 'arbiter',
  })
  assert.equal(
    arbiter.entries.some((entry) => entry.group === 'role_history'),
    false
  )
  assert.equal(
    arbiter.entries.some((entry) => entry.kind === 'review-findings'),
    true
  )

  write(join(assignmentPath, 'design', 'plan.md'), '# Ordered plan\n')
  write(join(assignmentPath, 'implementation', 'progress.json'), '{"version":1}\n')
  write(join(assignmentPath, 'outcome.md'), '# Outcome\n')
  write(join(assignmentPath, 'review', 'candidate-receipt.json'), '{"version":1}\n')
  write(join(assignmentPath, 'review', 'implementation-verdict.md'), '# Prior findings\n')
  const candidateReview = await buildAssignmentContextCatalog({
    targetDir: root,
    specdevPath,
    assignmentPath,
    phase: 'implementation-review',
    role: 'primary-reviewer',
  })
  assert.equal(
    candidateReview.entries.some((entry) => entry.kind === 'candidate-receipt'),
    true
  )
  assert.equal(
    candidateReview.entries.some((entry) => entry.group === 'role_history'),
    false
  )
  const repeatedCandidateReview = await buildAssignmentContextCatalog({
    targetDir: root,
    specdevPath,
    assignmentPath,
    phase: 'implementation-review',
    role: 'primary-reviewer',
    includePriorFindings: true,
  })
  assert.deepEqual(
    repeatedCandidateReview.entries
      .filter((entry) => entry.group === 'role_history')
      .map((entry) => entry.kind),
    ['prior-findings']
  )

  const attempt = await createAttemptRecord(specdevPath, {
    kind: 'reviewer',
    workspace: '.',
    assignment: '00001_selective-context',
    context_catalog: laterReview,
  })
  const recorded = await readAttemptRecord(specdevPath, attempt.id)
  assert.deepEqual(
    recorded.context_catalog.entries.map((entry) => entry.identity),
    laterReview.entries.map((entry) => entry.identity)
  )
  assert.equal('expansion_policy' in recorded.context_catalog, false)

  const missionPath = join(specdevPath, 'missions', 'M00001_parent-context')
  write(join(missionPath, 'brainstorm', 'contract.md'), '# Approved Mission contract\n')
  write(
    join(missionPath, 'design', 'assignments.yaml'),
    stringify({
      version: 2,
      design_mode: 'planned',
      knowledge_paths: ['knowledge/architecture/selective-context.md'],
      context_paths: [
        '.specdev/project_notes/big_picture.md',
        '.specdev/project_notes/roadmap/designs/assignment_selective_context_catalog.md',
      ],
      assignments: [
        { id: '00001', title: 'Selective context catalog', wave: 1, status: 'running' },
      ],
      final_verification: { command: 'node focused.js', scope: 'integrated' },
    })
  )
  write(
    join(assignmentPath, 'status.json'),
    JSON.stringify({
      version: 1,
      id: '00001',
      description: 'Selective context catalog',
      mission: 'M00001',
    })
  )
  const child = await buildAssignmentContextCatalog({
    targetDir: root,
    specdevPath,
    assignmentPath,
    phase: 'implementation',
    role: 'implementation-owner',
  })
  const childSupporting = child.entries
    .filter((entry) => entry.group === 'supporting')
    .map((entry) => entry.path)
  assert.deepEqual(childSupporting, [
    '.specdev/project_notes/big_picture.md',
    '.specdev/project_notes/roadmap/designs/assignment_selective_context_catalog.md',
  ])
  assert.equal(
    child.entries.some((entry) => entry.kind === 'parent-contract'),
    true
  )
  assert.equal(
    child.entries.some((entry) => entry.kind === 'parent-delegation'),
    true
  )
  assert.equal(child.parent_bounded, true)

  const parentEnvelope = await selectMissionSupportingEnvelope({
    targetDir: root,
    specdevPath,
    objective: 'Selective Assignment context catalog',
    knowledgePaths: ['knowledge/architecture/selective-context.md'],
  })
  assert.equal(
    parentEnvelope.includes('.specdev/knowledge/architecture/selective-context.md'),
    true
  )
  assert.equal(parentEnvelope.includes('.specdev/guides/review.md'), true)

  const replanned = await validateAndReserveReplannedQueue(
    specdevPath,
    {
      version: 2,
      design_mode: 'planned',
      knowledge_paths: ['knowledge/architecture/selective-context.md'],
      context_paths: parentEnvelope,
      assignments: [
        { id: '00001', title: 'First child', kind: 'change', wave: 1, status: 'completed' },
        { id: '00002', title: 'Pending child', kind: 'change', wave: 2, status: 'pending' },
      ],
      final_verification: { command: 'node focused.js', scope: 'integrated' },
    },
    {
      assignments: [
        { id: '00001', title: 'First child', kind: 'change', wave: 1, status: 'completed' },
        { id: '00002', title: 'Narrow pending child', kind: 'change', wave: 2, status: 'pending' },
      ],
      final_verification: { command: 'node focused.js', scope: 'integrated' },
    }
  )
  assert.deepEqual(replanned.context_paths, parentEnvelope)

  rmSync(contractPath)
  await assert.rejects(
    buildAssignmentContextCatalog({
      targetDir: root,
      specdevPath,
      assignmentPath,
      phase: 'implementation',
      role: 'implementation-owner',
    }),
    /Required Assignment authority context is missing/
  )

  console.log('assignment context tests passed')
} finally {
  rmSync(root, { recursive: true, force: true })
}

function write(path, content) {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, content, 'utf8')
}
