import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import fse from 'fs-extra'
import { recordSideChannelAction } from 'ripplegraph'
import { assignmentBoundaryCommand } from '../src/commands/assignment-boundary.js'
import { assertBoundaryEvidence } from '../src/utils/assignment-boundary.js'
import { fileDigest } from '../src/utils/assignment-boundary.js'

const bin = resolve('bin/specdev.js')
const roots = []
const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
function run(root, args, code = 0) {
  const result = spawnSync(process.execPath, [bin, ...args, '--json'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${join(root, '.specdev/cache/fake-bin')}:${process.env.PATH}` },
  })
  assert.equal(result.status, code, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`)
  return JSON.parse(result.stdout)
}
function write(path, value) {
  writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value, null, 2))
}
function fixture(review = 'required') {
  const root = mkdtempSync(join(tmpdir(), 'specdev-boundary-'))
  roots.push(root)
  git(root, ['init', '-q', '-b', 'main'])
  git(root, ['config', 'user.name', 'SpecDev Test'])
  git(root, ['config', 'user.email', 'specdev@example.invalid'])
  run(root, ['init', '--platform=none'])
  write(
    join(root, '.specdev/agents.yaml'),
    'implementation:\n  mode: inline\nreviewer:\n  provider: claude\n  model: fixture\n  effort: low\n  timeout: 10s\n'
  )
  const fake = join(root, '.specdev/cache/fake-bin/claude')
  mkdirSync(join(root, '.specdev/cache/fake-bin'), { recursive: true })
  write(
    fake,
    `#!/usr/bin/env node
const fs = require('node:fs')
fs.readFileSync(0, 'utf8')
const count = '.specdev/cache/reviewer-count'
fs.writeFileSync(count, String((fs.existsSync(count) ? Number(fs.readFileSync(count)) : 0) + 1))
const result = '---\\nverdict: approved\\nmaterial_divergence: false\\nscope_divergence: none\\nprocedure_divergence: none\\nevidence_integrity: complete\\nuser_reapproval_required: false\\n---\\n\\n## Findings\\n\\nNo blocking findings in the recovery fixture.\\n'
process.stdout.write(process.argv.includes('json') ? JSON.stringify({ session_id: 'boundary_review_fixture', result }) : result)
`
  )
  chmodSync(fake, 0o755)
  write(
    join(root, '.specdev/project_notes/big_picture.md'),
    '# Project Big Picture\n\n## Overview\nBoundary recovery for a small Node CLI with durable contracts and explicit user approval.\n\n## Tech Stack\nNode.js and JSON files with local Git storage and no external services.\n'
  )
  write(join(root, 'product.txt'), 'baseline\n')
  git(root, ['add', '.'])
  git(root, ['commit', '-qm', 'baseline'])
  const a = run(root, ['assignment', 'Recover a boundary', '--implementation-review=' + review])
  const path = join(root, a.path)
  const contract =
    '# Assignment contract\n\n' +
    [
      ['Objective and context', 'Recover repository boundaries.'],
      ['Scope and non-goals', 'Change product.txt only.'],
      ['Expected behavior', 'Keep the same Assignment.'],
      ['Important decisions', 'Explicit recovery.'],
      ['Constraints and invariants', 'Keep unrelated work.'],
      ['Delegated and reserved authority', 'User approves changes.'],
      ['Risks and assumptions', 'Local Git repository.'],
      ['Verification authority', 'Focused tests are authorized.'],
      ['Acceptance criteria', '- AC-1: The owned product change is delivered.'],
    ]
      .map(([title, body]) => `## ${title}\n\n${body}\n`)
      .join('\n')
  write(join(path, 'brainstorm/contract.md'), contract)
  run(root, ['checkpoint', 'brainstorm'])
  run(root, ['approve', 'brainstorm'])
  run(root, ['implement'])
  const before = git(root, ['rev-parse', 'HEAD'])
  write(join(root, 'design.md'), '# Approved design publication\n')
  git(root, ['add', 'design.md'])
  git(root, ['commit', '-qm', 'publish approved design'])
  write(join(root, 'product.txt'), 'implemented\n')
  const assessment = join(root, '.specdev/cache/assessment.json')
  write(assessment, {
    contract: 'compatible',
    reason: 'Publication clarifies existing scope without changing AC-1.',
    owned_paths: ['product.txt'],
    reuse_evidence: [],
  })
  const args = ['assignment', 'revalidate-boundary', a.id, '--assessment=' + assessment]
  return { root, path, a, before, assessment, args }
}
try {
  const f = fixture()
  const preview = run(f.root, f.args)
  assert.equal(preview.plan.original_boundary, f.before)
  assert.equal(preview.plan.commits.length, 1)
  assert(preview.plan.changed_paths.includes('design.md'))
  const statusBefore = readFileSync(join(f.path, 'status.json'), 'utf8')
  write(join(f.root, 'product.txt'), 'candidate changed\n')
  assert.match(run(f.root, [...f.args, '--confirm=' + preview.plan.digest], 1).error, /Stale/)
  assert.equal(readFileSync(join(f.path, 'status.json'), 'utf8'), statusBefore)
  const beforeEvent = run(f.root, f.args).plan
  recordSideChannelAction({
    workflowRoot: join(f.root, '.specdev'),
    actionId: 'test-observation',
    note: 'New evidence after preview',
  })
  assert.match(run(f.root, [...f.args, '--confirm=' + beforeEvent.digest], 1).error, /Stale/)
  write(join(f.root, 'unrelated.txt'), 'staged unrelated\n')
  git(f.root, ['add', 'unrelated.txt'])
  write(join(f.root, 'unrelated.txt'), 'unstaged unrelated\n')
  const index = git(f.root, ['diff', '--cached', '--', 'unrelated.txt'])
  mkdirSync(join(f.path, 'review'), { recursive: true })
  write(
    join(f.path, 'review/implementation-verdict.md'),
    '# Previous review\nHistorical finding.\n'
  )
  const ready = run(f.root, f.args)
  const result = run(f.root, [...f.args, '--confirm=' + ready.plan.digest])
  assert.equal(result.status, 'applied')
  assert.equal(run(f.root, [...f.args, '--confirm=' + ready.plan.digest]).status, 'applied')
  let status = JSON.parse(readFileSync(join(f.path, 'status.json')))
  assert.equal(status.git_boundary.original_git_commit_hash, f.before)
  assert.equal(status.git_boundary.starting_git_commit_hash, git(f.root, ['rev-parse', 'HEAD']))
  assert.equal(status.review_policy.implementation, 'required')
  assert.equal(run(f.root, ['implement']).status, 'action_required')
  mkdirSync(join(f.path, 'design'), { recursive: true })
  mkdirSync(join(f.path, 'implementation'), { recursive: true })
  write(
    join(f.path, 'design/plan.md'),
    '# Plan\n\n**Implementation Guides:** []\n**Review Guides:** []\n\n## Tasks\n\n- T-1 covers AC-1.\n'
  )
  execFileSync(process.execPath, ['--version'], { cwd: f.root })
  write(join(f.path, 'implementation/progress.json'), {
    version: 1,
    tasks: [{ id: 'T-1', status: 'completed' }],
    selected_guides: { implementation: [], review: [] },
    verification: [
      {
        command: 'node --version',
        revision: git(f.root, ['rev-parse', 'HEAD']),
        scope: 'fixture',
        role: 'authoritative_acceptance',
        status: 'passed',
        duration_ms: 1,
      },
    ],
    deviations: [],
    follow_up: 'none',
  })
  write(
    join(f.path, 'outcome.md'),
    '# Outcome\n\n## Delivered behavior\nOwned product change completed.\n\n## Deviations\nNone.\n\n## Unresolved risks\nNone.\n\n| Acceptance | Evidence | Result |\n| --- | --- | --- |\n| AC-1 | Focused fixture | Passed |\n'
  )
  write(
    join(f.path, 'implementation/worker-result.md'),
    '---\nstatus: completed\nrevision: null\nfollow_up: none\n---\n\n## Changes\n\nCompleted recovery fixture.\n'
  )
  const delivered = run(f.root, ['implement'])
  assert.equal(delivered.status, 'approved')
  assert.match(git(f.root, ['show', '-s', '--format=%B', 'HEAD']), /SpecDev-Commit-Type: delivery/)
  assert.equal(readFileSync(join(f.root, '.specdev/cache/reviewer-count'), 'utf8'), '1')
  assert.match(
    readFileSync(
      join(f.path, 'boundary-history', ready.plan.digest, 'review/implementation-verdict.md'),
      'utf8'
    ),
    /Historical finding/
  )
  assert.equal(git(f.root, ['diff', '--cached', '--', 'unrelated.txt']), index)
  assert.equal(readFileSync(join(f.root, 'unrelated.txt'), 'utf8'), 'unstaged unrelated\n')
  const changed = git(f.root, ['show', '--format=', '--name-only', 'HEAD']).split('\n')
  assert(changed.includes('product.txt'))
  assert(!changed.includes('unrelated.txt'))
  assert(changed.some((path) => path.includes('boundary-history')))

  const material = fixture()
  write(material.assessment, {
    contract: 'changed',
    reason: 'New scope needs explicit approval.',
    owned_paths: ['product.txt'],
    reuse_evidence: [],
  })
  const plan = run(material.root, material.args).plan
  run(material.root, [...material.args, '--confirm=' + plan.digest])
  const blocked = spawnSync(process.execPath, [bin, 'implement', '--json'], {
    cwd: material.root,
    encoding: 'utf8',
  })
  assert.notEqual(blocked.status, 0)
  assert.match(blocked.stdout + blocked.stderr, /reapproval/)
  write(
    join(material.path, 'brainstorm/contract.md'),
    readFileSync(join(material.path, 'brainstorm/contract.md'), 'utf8').replace(
      'Change product.txt only.',
      'Change product.txt and revised behavior.'
    )
  )
  run(material.root, ['checkpoint', 'brainstorm'])
  run(material.root, ['approve', 'brainstorm'])
  assert.equal(run(material.root, ['implement']).status, 'action_required')

  for (const phase of ['review', 'applied']) {
    const interrupted = fixture()
    const pending = run(interrupted.root, interrupted.args).plan
    const move = fse.move
    const log = console.log
    fse.move = async (source, destination, ...rest) => {
      if (
        (phase === 'review' &&
          destination === join(interrupted.path, 'review/implementation-state.json')) ||
        (phase === 'applied' &&
          destination === join(interrupted.path, 'status.json') &&
          JSON.parse(readFileSync(source)).boundary_recovery?.phase === 'applied')
      )
        throw new Error('injected storage failure')
      return move(source, destination, ...rest)
    }
    console.log = () => {}
    try {
      const result = await assignmentBoundaryCommand(
        interrupted.root,
        join(interrupted.root, '.specdev'),
        [interrupted.a.id],
        { assessment: interrupted.assessment, confirm: pending.digest, json: true }
      )
      assert.equal(result.status, 'blocked')
    } finally {
      fse.move = move
      console.log = log
      process.exitCode = 0
    }
    const pendingStatus = JSON.parse(readFileSync(join(interrupted.path, 'status.json')))
    assert.equal(pendingStatus.boundary_recovery.original_status, undefined)
    if (phase === 'applied') {
      // Older pending records carried this extra field outside the confirmed plan.
      pendingStatus.boundary_recovery.original_status =
        pendingStatus.boundary_recovery.plan.snapshot.status
      write(join(interrupted.path, 'status.json'), pendingStatus)
    }
    assert.equal(
      run(interrupted.root, [
        'assignment',
        'revalidate-boundary',
        interrupted.a.id,
        '--confirm=' + pending.digest,
      ]).status,
      'applied'
    )
    const recoveredStatus = JSON.parse(readFileSync(join(interrupted.path, 'status.json')))
    const logPath = join(
      interrupted.root,
      '.specdev/.ripplegraph/runs',
      recoveredStatus.run_id,
      'transition-log.jsonl'
    )
    assert.equal(
      readFileSync(logPath, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(JSON.parse)
        .filter((event) => event.output?.actionId === 'assignment-boundary').length,
      1
    )
  }

  const evidence = fixture()
  mkdirSync(join(evidence.path, 'implementation'), { recursive: true })
  const receipt = {
    command: 'node --version',
    revision: evidence.before,
    status: 'passed',
    role: 'authoritative_acceptance',
    scope: 'fixture',
    duration_ms: 1,
  }
  write(join(evidence.path, 'implementation/progress.json'), { verification: [receipt] })
  const evidencePlan = run(evidence.root, evidence.args).plan
  run(evidence.root, [...evidence.args, '--confirm=' + evidencePlan.digest])
  await assert.rejects(assertBoundaryEvidence(evidence.path, [receipt]), /invalidated/)
  await assertBoundaryEvidence(evidence.path, [
    { ...receipt, revision: git(evidence.root, ['rev-parse', 'HEAD']) },
  ])

  const reusable = fixture()
  mkdirSync(join(reusable.path, 'implementation'), { recursive: true })
  const reusableReceipt = {
    ...receipt,
    input_digests: { 'product.txt': await fileDigest(reusable.root, 'product.txt') },
  }
  write(join(reusable.path, 'implementation/progress.json'), { verification: [reusableReceipt] })
  write(reusable.assessment, {
    contract: 'compatible',
    reason: 'The recorded input content still matches.',
    owned_paths: ['product.txt'],
    reuse_evidence: [0],
  })
  const reusePlan = run(reusable.root, reusable.args).plan
  run(reusable.root, [...reusable.args, '--confirm=' + reusePlan.digest])
  await assertBoundaryEvidence(reusable.path, [reusableReceipt])
  write(join(reusable.root, 'product.txt'), 'new input\n')
  await assert.rejects(assertBoundaryEvidence(reusable.path, [reusableReceipt]), /input changed/)

  const active = fixture()
  await fse.outputFile(
    join(active.root, '.specdev/processes/Attempt-99999.yaml'),
    `id: Attempt-99999\nstatus: running\nkind: reviewer\nassignment: ${active.a.name}\n`
  )
  assert.match(run(active.root, active.args, 1).error, /Live or ambiguous/)

  const divergent = fixture()
  git(divergent.root, ['checkout', '--orphan', 'divergent'])
  git(divergent.root, ['add', '.'])
  git(divergent.root, ['commit', '-qm', 'unrelated history'])
  assert.equal(run(divergent.root, divergent.args, 1).status, 'blocked')
  console.log('Assignment boundary recovery tests passed.')
} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
}
