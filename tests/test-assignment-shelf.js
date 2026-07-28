import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repoRoot = resolve(import.meta.dirname, '..')
const bin = join(repoRoot, 'bin', 'specdev.js')
const roots = []

function tempProject(label) {
  const root = mkdtempSync(join(tmpdir(), `specdev-assignment-shelf-${label}-`))
  roots.push(root)
  runGit(root, ['init', '--quiet'])
  runGit(root, ['config', 'user.name', 'SpecDev Test'])
  runGit(root, ['config', 'user.email', 'specdev@example.invalid'])
  runJson(root, ['init', '--platform=none', '--json'])
  writeFileSync(
    join(root, '.specdev', 'project_notes', 'big_picture.md'),
    '# Project Big Picture\n\n## Overview\nA fixture project with a filled durable context.\n\n## Tech Stack\nNode.js and JSON files with no external services.\n',
    'utf8'
  )
  writeFileSync(join(root, 'work.txt'), 'baseline\n', 'utf8')
  commitAll(root, 'fixture baseline')
  return root
}

function createAssignment(root, objective) {
  runJson(root, ['do', 'start an assignment'])
  return runJson(root, ['assignment', objective, '--json'])
}

function run(root, args, expectedStatus = 0) {
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

function runJson(root, args, expectedStatus = 0) {
  const result = run(root, args, expectedStatus)
  return JSON.parse(result.stdout)
}

function runGit(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, `git ${args.join(' ')} failed:\n${result.stderr}`)
  return result.stdout.trim()
}

function commitAll(root, message) {
  runGit(root, ['add', '-A'])
  runGit(root, ['commit', '--quiet', '-m', message])
}

try {
  const cleanRoot = tempProject('clean')
  assert.match(
    readFileSync(join(cleanRoot, '.codex', 'skills', 'specdev-continue', 'SKILL.md'), 'utf8'),
    /specdev assignment --from-assignment=<shelved-id>/
  )
  const clean = createAssignment(cleanRoot, 'Preserve useful unfinished work')
  const cleanPath = join(cleanRoot, clean.path)
  commitAll(cleanRoot, 'active assignment fixture')

  const processDir = join(cleanRoot, '.specdev', 'processes')
  const markerDir = join(cleanRoot, '.specdev', 'cache', 'processes')
  mkdirSync(processDir, { recursive: true })
  mkdirSync(markerDir, { recursive: true })
  writeFileSync(
    join(processDir, 'ATT-999.yaml'),
    `id: ATT-999\nkind: worker\nstatus: running\nworkspace: .\nstarted_at: 2026-07-28T00:00:00.000Z\nassignment: ${clean.name}\n`,
    'utf8'
  )
  writeFileSync(
    join(markerDir, 'ATT-999.json'),
    JSON.stringify({ attempt: 'ATT-999', pid: process.pid, cwd: cleanRoot }),
    'utf8'
  )
  assert.match(
    run(cleanRoot, ['assignment', 'shelf', clean.id, '--reason=wait for product decision'], 1)
      .stderr,
    /live or unverified worker\/reviewer/
  )
  rmSync(join(processDir, 'ATT-999.yaml'))
  rmSync(join(markerDir, 'ATT-999.json'))

  const shelf = runJson(cleanRoot, [
    'assignment',
    'shelf',
    clean.id,
    '--reason=wait for product decision',
    '--json',
  ])
  assert.equal(shelf.status, 'shelved')
  assert.equal(shelf.immutable, true)
  assert.equal(shelf.shelf.repository.boundary, 'clean-head')
  assert.equal(existsSync(join(cleanPath, 'shelf.md')), true)
  assert.equal(
    existsSync(join(cleanRoot, '.specdev', '.ripplegraph', 'runs', shelf.shelf.run_id)),
    false
  )
  assert.equal(runJson(cleanRoot, ['assignment', 'shelf', clean.id, '--json']).idempotent, true)

  const continued = runJson(cleanRoot, ['continue', '--json'])
  assert.equal(continued.lifecycle, 'shelved')
  assert.equal(continued.next_action, `specdev assignment --from-assignment=${clean.id}`)
  const focused = runJson(cleanRoot, ['focus', clean.id, '--json'])
  assert.equal(focused.lifecycle, 'shelved')
  assert.equal(focused.immutable, true)
  const status = runJson(cleanRoot, ['status', '--json'])
  assert.equal(status.artifact_focus.lifecycle, 'shelved')

  const beforeHelp = readFileSync(join(cleanPath, 'status.json'), 'utf8')
  run(cleanRoot, ['cancel', '--help'])
  run(cleanRoot, ['assignment', 'shelf', clean.id, '--help'])
  assert.equal(readFileSync(join(cleanPath, 'status.json'), 'utf8'), beforeHelp)

  const successor = runJson(cleanRoot, [
    'assignment',
    `Continue ${clean.id}`,
    `--from-assignment=${clean.id}`,
    '--json',
  ])
  assert.notEqual(successor.id, clean.id)
  assert.equal(successor.predecessor_assignment.id, clean.id)
  const successorStatus = JSON.parse(
    readFileSync(join(cleanRoot, successor.path, 'status.json'), 'utf8')
  )
  assert.equal(successorStatus.predecessor_assignment.id, clean.id)
  const successorContract = readFileSync(
    join(cleanRoot, successor.path, 'brainstorm', 'contract.md'),
    'utf8'
  )
  assert.match(successorContract, /Shelf handoff \(historical, not current authority\)/)
  assert.match(successorContract, new RegExp(`Shelf Git commit: ${shelf.shelf.repository.commit}`))
  assert.doesNotMatch(successorContract, /approved_at|implementation-review/)
  assert.match(
    run(cleanRoot, ['assignment', `--from-assignment=${successor.id}`, '--json'], 1).stdout,
    /is not shelved/
  )

  const dirtyRoot = tempProject('dirty')
  const dirty = createAssignment(dirtyRoot, 'Snapshot bounded unfinished work')
  commitAll(dirtyRoot, 'active dirty assignment fixture')
  writeFileSync(join(dirtyRoot, 'work.txt'), 'unfinished\n', 'utf8')
  const decision = run(
    dirtyRoot,
    ['assignment', 'shelf', dirty.id, '--reason=pause bounded work'],
    1
  )
  assert.match(decision.stderr, /explicit snapshot decision/)
  const dirtyShelf = runJson(dirtyRoot, [
    'assignment',
    'shelf',
    dirty.id,
    '--reason=pause bounded work',
    '--snapshot-paths=["work.txt"]',
    '--json',
  ])
  assert.equal(dirtyShelf.shelf.repository.boundary, 'authorized-snapshot')
  assert.equal(
    runGit(dirtyRoot, ['log', '-1', '--pretty=%s']),
    `specdev(assignment): shelf ${dirty.id}`
  )
  assert.equal(runGit(dirtyRoot, ['show', 'HEAD:work.txt']), 'unfinished')

  const cancelRoot = tempProject('cancel')
  const abandoned = createAssignment(cancelRoot, 'Reject accidental cancellation')
  const missingReason = runJson(cancelRoot, ['cancel', '--json'], 1)
  assert.equal(missingReason.state, 'requires_reason')
  run(cancelRoot, ['cancel', '--help'])
  assert.equal(runJson(cancelRoot, ['next', '--json']).status, 'ok')
  assert.equal(runJson(cancelRoot, ['cancel', 'work is obsolete', '--json']).state, 'cancelled')
  const abandonedStatus = JSON.parse(
    readFileSync(join(cancelRoot, abandoned.path, 'status.json'), 'utf8')
  )
  assert.equal(abandonedStatus.status, 'abandoned')
  assert.equal(abandonedStatus.abandon_reason, 'work is obsolete')
  const abandonedContinue = runJson(cancelRoot, ['continue', '--json'])
  assert.equal(abandonedContinue.lifecycle, 'abandoned')
  assert.match(abandonedContinue.next_action, /specdev assignment/)

  console.log('assignment shelf tests passed')
} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
}
