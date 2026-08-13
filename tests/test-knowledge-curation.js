import assert from 'node:assert/strict'
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { missionKnowledgePaths } from '../src/commands/mission.js'
import { applyKnowledgeCuration } from '../src/utils/knowledge-curation.js'

const repoRoot = resolve(import.meta.dirname, '..')
const bin = join(repoRoot, 'bin', 'specdev.js')
const root = mkdtempSync(join(tmpdir(), 'specdev-knowledge-curation-'))
const specdevPath = join(root, '.specdev')
const today = new Date().toISOString().slice(0, 10)

function run(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: root,
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

function runJson(args, expectedStatus = 0) {
  return JSON.parse(run([...args, '--json'], expectedStatus).stdout)
}

function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, `git ${args.join(' ')} failed:\n${result.stderr}`)
}

function commit(message) {
  git(['add', '-A'])
  git(['commit', '--quiet', '-m', message])
}

function proposalPath(name) {
  const dir = join(specdevPath, 'cache', 'knowledge-curation')
  mkdirSync(dir, { recursive: true })
  return join(dir, name)
}

function evidence(kind = 'reviewed_source') {
  return [{ kind, reference: 'current repository fixture', verified_at: today }]
}

try {
  git(['init', '--quiet'])
  git(['config', 'user.name', 'SpecDev Test'])
  git(['config', 'user.email', 'specdev@example.test'])
  run(['init', '--quiet'])

  const assignment = join(specdevPath, 'assignments', '00001_knowledge-source')
  mkdirSync(assignment, { recursive: true })
  writeFileSync(
    join(assignment, 'status.json'),
    JSON.stringify({ version: 1, status: 'completed' }, null, 2) + '\n'
  )
  writeFileSync(
    join(assignment, 'outcome.md'),
    '# Outcome\n\nThe router uses one deterministic owner for retry policy.\n'
  )
  const bigPicturePath = join(specdevPath, 'project_notes', 'big_picture.md')
  writeFileSync(bigPicturePath, '# Project Big Picture\n\nCurrent project context.\n')
  const repositoryEvidencePath = join(root, 'src', 'router.js')
  mkdirSync(join(root, 'src'), { recursive: true })
  writeFileSync(
    repositoryEvidencePath,
    "const retryOwners = ['primary', 'recovery']\nexport const retryOwnerCount = retryOwners.length\n"
  )
  commit('knowledge fixture')

  const invalidEvidence = runJson(
    ['knowledge', 'curate', '--repo-evidence=src/router.js#L1-L999'],
    1
  )
  assert.match(invalidEvidence.error, /attributable lines/)

  const initialScan = runJson(['knowledge', 'curate', '--repo-evidence=src/router.js#L1-L2'])
  assert.equal(initialScan.status, 'scan_ready')
  assert.equal(initialScan.mutation_free, true)
  assert.equal(initialScan.excluded_dirt.length, 0)
  assert.equal(
    initialScan.eligible_sources.some(
      (source) => source.path === 'assignments/00001_knowledge-source/outcome.md'
    ),
    true
  )
  assert.equal(initialScan.repository_evidence.length, 1)
  assert.equal(initialScan.repository_evidence[0].path, 'src/router.js')
  assert.equal(initialScan.repository_evidence[0].revision.length, 40)
  assert.match(initialScan.repository_evidence[0].content_hash, /^[a-f0-9]{64}$/)

  const architectureContent = `---\nstatus: active\nsources:\n  - assignments/00001_knowledge-source/outcome.md\n---\n\n# Router retry ownership\n\nUse one deterministic retry owner.\n`
  const firstProposal = {
    ...initialScan.proposal_template,
    summary: 'Publish router ownership and propose a context clarification.',
    changes: [
      {
        path: 'knowledge/architecture/router-retry.md',
        action: 'create',
        previous_hash: null,
        content: architectureContent,
        owner_check: {
          query: 'router retry owner',
          matches: [],
          decision: 'create',
        },
        verification: evidence(),
        repository_evidence: [initialScan.repository_evidence[0].reference],
      },
    ],
    big_picture: {
      previous_hash: initialScan.project_context.content_hash,
      content: '# Project Big Picture\n\nCurrent project context with router ownership.\n',
      reason: 'Make the router boundary explicit for future agents.',
      verification: evidence('repository'),
    },
    conflicts: [{ topic: 'router-retry-owner', resolution: 'No existing owner matched.' }],
  }
  const firstPath = proposalPath('first.json')
  writeFileSync(firstPath, JSON.stringify(firstProposal, null, 2) + '\n')
  const prepared = runJson(['knowledge', 'curate', `--proposal=${firstPath}`])
  assert.equal(prepared.status, 'awaiting_approval')
  assert.match(prepared.proposal_id, /^[a-f0-9]{64}$/)
  assert.match(prepared.big_picture_approval, /^[a-f0-9]{64}$/)
  assert.equal(prepared.repository_evidence_count, 1)

  const originalRepositoryEvidence = readFileSync(repositoryEvidencePath, 'utf8')
  writeFileSync(repositoryEvidencePath, originalRepositoryEvidence.replace('recovery', 'fallback'))
  const changedEvidenceApproval = runJson(
    ['knowledge', 'curate', `--approve=${prepared.proposal_id}`],
    1
  )
  assert.match(changedEvidenceApproval.error, /boundary changed|Repository evidence|dirty/)
  writeFileSync(repositoryEvidencePath, originalRepositoryEvidence)

  const changedSource = join(assignment, 'outcome.md')
  const originalSource = readFileSync(changedSource, 'utf8')
  writeFileSync(changedSource, `${originalSource}\nChanged after approval.\n`)
  const staleApproval = runJson(['knowledge', 'curate', `--approve=${prepared.proposal_id}`], 1)
  assert.match(staleApproval.error, /boundary changed|changed after proposal approval/)
  assert.equal(existsSync(join(specdevPath, 'knowledge', 'architecture', 'router-retry.md')), false)
  writeFileSync(changedSource, originalSource)

  const published = runJson(['knowledge', 'curate', `--approve=${prepared.proposal_id}`])
  assert.equal(published.status, 'completed')
  assert.deepEqual(published.published_paths, ['knowledge/architecture/router-retry.md'])
  assert.equal(
    readFileSync(bigPicturePath, 'utf8'),
    firstProposal.big_picture.content.replace(' with router ownership', '')
  )
  assert.equal(
    runJson(['knowledge', 'search', 'deterministic retry owner']).results[0].path,
    'knowledge/architecture/router-retry.md'
  )
  const preciseSearch = runJson(['knowledge', 'search', 'deterministic retry owner'])
  assert.equal(preciseSearch.mode, 'precise')
  assert.equal(preciseSearch.fallback, false)
  assert.equal(preciseSearch.results[0].match_mode, 'precise')
  assert.equal(preciseSearch.results[0].match_tier, 'complete')
  assert.equal(preciseSearch.results[0].coverage, 1)
  assert.deepEqual(preciseSearch.results[0].matched_terms, ['deterministic', 'retry', 'owner'])
  const phraseSearch = runJson(['knowledge', 'search', '"deterministic retry owner"'])
  assert.equal(phraseSearch.results[0].match_tier, 'phrase')
  assert.deepEqual(phraseSearch.results[0].matched_phrases, ['deterministic retry owner'])
  const fallbackSearch = runJson(['knowledge', 'search', 'deterministic absent-token'])
  assert.equal(fallbackSearch.fallback, true)
  assert.equal(fallbackSearch.results.length <= 5, true)
  assert.equal(fallbackSearch.results[0].match_tier, 'partial_fallback')
  assert.match(fallbackSearch.refinement_hint, /--mode=broad/)
  const broadSearch = runJson(['knowledge', 'search', 'deterministic absent-token', '--mode=broad'])
  assert.equal(broadSearch.mode, 'broad')
  assert.equal(broadSearch.results[0].match_tier, 'broad')
  assert.match(broadSearch.refinement_hint, /quote a distinguishing phrase/)
  const historyFixtures = Array.from({ length: 6 }, (_, index) => {
    const path = join(specdevPath, 'assignments', `0001${index}_mission-history-${index}`)
    mkdirSync(path, { recursive: true })
    writeFileSync(
      join(path, 'status.json'),
      JSON.stringify({ version: 1, status: 'completed' }, null, 2) + '\n'
    )
    writeFileSync(
      join(path, 'outcome.md'),
      `# Outcome\n\nMission planning deterministic recovery verification historical lead ${index}.\n`
    )
    return path
  })
  const missionPaths = await missionKnowledgePaths(
    specdevPath,
    'mission planning deterministic recovery verification router ownership constraint'
  )
  assert.equal(missionPaths.includes('knowledge/architecture/router-retry.md'), true)
  for (const path of historyFixtures) rmSync(path, { recursive: true, force: true })
  const malformedSearch = run(['knowledge', 'search', '"deterministic retry'], 1)
  assert.match(malformedSearch.stderr, /quoted phrase is not closed/)

  const receipt = JSON.parse(
    readFileSync(
      join(
        specdevPath,
        'knowledge-curations',
        readdirSync(join(specdevPath, 'knowledge-curations')).find((name) => name.endsWith('.json'))
      ),
      'utf8'
    )
  )
  assert.equal(receipt.repository_evidence[0].path, 'src/router.js')
  assert.deepEqual(receipt.knowledge_changes[0].repository_evidence, ['src/router.js#L1-L2'])
  const repeated = runJson(['knowledge', 'curate', `--approve=${prepared.proposal_id}`])
  assert.equal(repeated.status, 'completed')
  assert.equal(
    readdirSync(join(specdevPath, 'knowledge-curations')).filter((name) => name.endsWith('.json'))
      .length,
    1
  )
  commit('publish curated architecture')

  const contextScan = runJson(['knowledge', 'curate'])
  const contextPath = proposalPath('context.json')
  writeFileSync(
    contextPath,
    JSON.stringify(
      {
        ...contextScan.proposal_template,
        summary: 'Approve project context separately.',
        big_picture: {
          previous_hash: contextScan.project_context.content_hash,
          content: '# Project Big Picture\n\nSeparately approved project context.\n',
          reason: 'Record the approved durable boundary.',
          verification: evidence('repository'),
        },
      },
      null,
      2
    ) + '\n'
  )
  const contextPrepared = runJson(['knowledge', 'curate', `--proposal=${contextPath}`])
  const contextPublished = runJson([
    'knowledge',
    'curate',
    `--approve=${contextPrepared.proposal_id}`,
    `--approve-big-picture=${contextPrepared.big_picture_approval}`,
  ])
  assert.equal(contextPublished.status, 'completed')
  assert.equal(
    readFileSync(bigPicturePath, 'utf8'),
    '# Project Big Picture\n\nSeparately approved project context.\n'
  )
  commit('publish approved project context')

  const failureScan = runJson(['knowledge', 'curate'])
  const owner = failureScan.owners.find(
    (candidate) => candidate.path === 'knowledge/architecture/router-retry.md'
  )
  const failurePath = proposalPath('failure.json')
  const revisedArchitecture = architectureContent.replace(
    'Use one deterministic retry owner.',
    'Use one deterministic retry owner and preserve its recovery receipt.'
  )
  writeFileSync(
    failurePath,
    JSON.stringify(
      {
        ...failureScan.proposal_template,
        summary: 'Exercise rebuild recovery.',
        changes: [
          {
            path: owner.path,
            action: 'update',
            previous_hash: owner.content_hash,
            content: revisedArchitecture,
            owner_check: {
              query: 'router retry owner',
              matches: [owner.path],
              decision: 'update',
            },
            verification: evidence(),
          },
        ],
      },
      null,
      2
    ) + '\n'
  )
  const failurePrepared = runJson(['knowledge', 'curate', `--proposal=${failurePath}`])
  const failedIndex = await applyKnowledgeCuration(
    root,
    specdevPath,
    { proposal: failurePrepared.proposal_id },
    {
      buildIndex: async () => {
        throw new Error('simulated rebuild failure')
      },
    }
  )
  assert.equal(failedIndex.status, 'published_index_stale')
  assert.equal(failedIndex.recovery_command, 'specdev knowledge rebuild')
  assert.equal(readFileSync(join(specdevPath, owner.path), 'utf8'), revisedArchitecture)
  const recovered = await applyKnowledgeCuration(root, specdevPath, {
    proposal: failurePrepared.proposal_id,
  })
  assert.equal(recovered.status, 'completed')
  assert.equal(recovered.index.status, 'ok')
  commit('recover curated index')

  const noChangeScan = runJson(['knowledge', 'curate'])
  const noChangePath = proposalPath('no-change.json')
  writeFileSync(noChangePath, JSON.stringify(noChangeScan.proposal_template, null, 2) + '\n')
  const noChangePrepared = runJson(['knowledge', 'curate', `--proposal=${noChangePath}`])
  const noChange = runJson(['knowledge', 'curate', `--approve=${noChangePrepared.proposal_id}`])
  assert.equal(noChange.status, 'completed')
  assert.equal(noChange.index.rebuilt, false)

  const staleScan = runJson(['knowledge', 'curate'])
  const stalePath = proposalPath('stale.json')
  writeFileSync(stalePath, JSON.stringify(staleScan.proposal_template, null, 2) + '\n')
  const oldBigPicture = readFileSync(bigPicturePath, 'utf8')
  writeFileSync(bigPicturePath, `${oldBigPicture}\nChanged boundary.\n`)
  const staleProposal = runJson(['knowledge', 'curate', `--proposal=${stalePath}`], 1)
  assert.match(staleProposal.error, /scan is stale/)
  writeFileSync(bigPicturePath, oldBigPicture)

  assert.match(run(['help']).stdout, /knowledge curate/)
  const assignmentSkill = readFileSync(
    join(root, '.codex', 'skills', 'specdev-assignment', 'SKILL.md'),
    'utf8'
  )
  const adhocSkill = readFileSync(
    join(root, '.codex', 'skills', 'specdev-adhoc', 'SKILL.md'),
    'utf8'
  )
  const missionSkill = readFileSync(
    join(root, '.codex', 'skills', 'specdev-mission', 'SKILL.md'),
    'utf8'
  )
  assert.match(assignmentSkill, /knowledge search.*objective terms/)
  assert.match(assignmentSkill, /historical investigation leads/)
  assert.match(assignmentSkill, /hard-coded counts/)
  assert.match(assignmentSkill, /repository-evidence-bound/)
  assert.match(adhocSkill, /unexpected symptom/)
  assert.match(adhocSkill, /closed-world assumptions/)
  assert.match(missionSkill, /Mission objective terms/)
  assert.match(missionSkill, /--mode=broad/)
  assert.equal(
    existsSync(join(root, '.codex', 'skills', 'specdev-knowledge-curation', 'SKILL.md')),
    true
  )

  console.log('Knowledge curation tests passed.')
} finally {
  rmSync(root, { recursive: true, force: true })
}
