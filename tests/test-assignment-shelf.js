import assert from 'node:assert/strict'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
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

function snapshotToken(result) {
  const match = result.stderr.match(/--snapshot-token=([a-f0-9]{16})/)
  assert.ok(match, `snapshot token missing from:\n${result.stderr}`)
  return match[1]
}

function commitMessage(root, revision) {
  return runGit(root, ['show', '-s', '--format=%B', revision])
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
  const cleanBoundary = runGit(cleanRoot, ['rev-parse', 'HEAD'])

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
  assert.equal(shelf.repository.boundary_commit, cleanBoundary)
  assert.notEqual(shelf.repository.terminal_commit, cleanBoundary)
  assert.match(
    commitMessage(cleanRoot, shelf.repository.terminal_commit),
    new RegExp(`SpecDev-Assignment: ${clean.id}\\nSpecDev-Commit-Type: shelf-terminal`)
  )
  assert.equal(runGit(cleanRoot, ['status', '--short']), '')
  assert.equal(existsSync(join(cleanPath, 'shelf.md')), true)
  assert.equal(
    existsSync(join(cleanRoot, '.specdev', '.ripplegraph', 'runs', shelf.shelf.run_id)),
    false
  )
  assert.equal(runJson(cleanRoot, ['assignment', 'shelf', clean.id, '--json']).idempotent, true)

  const residualRunPath = join(cleanRoot, '.specdev', '.ripplegraph', 'runs', shelf.shelf.run_id)
  mkdirSync(residualRunPath, { recursive: true })
  writeFileSync(
    join(processDir, 'ATT-998.yaml'),
    `id: ATT-998\nkind: worker\nstatus: running\nworkspace: .\nstarted_at: 2026-07-28T00:00:00.000Z\nassignment: ${clean.name}\n`,
    'utf8'
  )
  assert.match(
    run(cleanRoot, ['assignment', 'shelf', clean.id], 1).stderr,
    /running Attempts: ATT-998/
  )
  assert.equal(existsSync(residualRunPath), true)
  rmSync(join(processDir, 'ATT-998.yaml'))
  const recoveredShelf = runJson(cleanRoot, ['assignment', 'shelf', clean.id, '--json'])
  assert.equal(recoveredShelf.idempotent, true)
  assert.equal(recoveredShelf.runtime_compaction.compacted, true)
  assert.equal(existsSync(residualRunPath), false)

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
  const shelfHelp = run(cleanRoot, ['assignment', 'shelf', clean.id, '--help'])
  assert.match(shelfHelp.stdout, /--snapshot-token=<token>/)
  assert.match(shelfHelp.stdout, /snapshot-boundary commit/)
  assert.match(shelfHelp.stdout, /Tracked \.specdev\/cache\/\*\*/)
  assert.match(shelfHelp.stdout, /live or unverified Assignment worker\/reviewer/)
  assert.match(shelfHelp.stdout, /terminal\s+metadata/)
  assert.equal(readFileSync(join(cleanPath, 'status.json'), 'utf8'), beforeHelp)

  mkdirSync(residualRunPath, { recursive: true })
  const successor = runJson(cleanRoot, [
    'assignment',
    `Continue ${clean.id}`,
    `--from-assignment=${clean.id}`,
    '--json',
  ])
  assert.notEqual(successor.id, clean.id)
  assert.equal(successor.predecessor_assignment.id, clean.id)
  assert.equal(existsSync(residualRunPath), false)
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
  assert.match(decision.stderr, /Non-disposable dirty paths: 1 \(work\.txt\)/)
  assert.doesNotMatch(decision.stderr, /snapshot-paths|\["work\.txt"\]/)
  const token = snapshotToken(decision)
  runGit(dirtyRoot, ['add', 'work.txt'])
  const dirtyShelf = runJson(dirtyRoot, [
    'assignment',
    'shelf',
    dirty.id,
    '--reason=pause bounded work',
    `--snapshot-token=${token}`,
    '--json',
  ])
  assert.equal(dirtyShelf.shelf.repository.boundary, 'authorized-snapshot')
  assert.match(
    commitMessage(dirtyRoot, dirtyShelf.repository.boundary_commit),
    new RegExp(
      `SpecDev-Assignment: ${dirty.id}\\nSpecDev-Commit-Type: shelf-snapshot\\nSpecDev-Snapshot-Token: ${token}`
    )
  )
  assert.match(
    commitMessage(dirtyRoot, dirtyShelf.repository.terminal_commit),
    new RegExp(`SpecDev-Assignment: ${dirty.id}\\nSpecDev-Commit-Type: shelf-terminal`)
  )
  assert.equal(
    runGit(dirtyRoot, ['show', `${dirtyShelf.repository.boundary_commit}:work.txt`]),
    'unfinished'
  )
  assert.equal(runGit(dirtyRoot, ['status', '--short']), '')

  const tokenRoot = tempProject('token-freshness')
  const tokenAssignment = createAssignment(tokenRoot, 'Reject stale snapshot tokens')
  commitAll(tokenRoot, 'active token assignment fixture')
  writeFileSync(join(tokenRoot, 'work.txt'), 'first version\n', 'utf8')
  const firstDecision = run(
    tokenRoot,
    ['assignment', 'shelf', tokenAssignment.id, '--reason=pause token work'],
    1
  )
  const firstToken = snapshotToken(firstDecision)
  writeFileSync(join(tokenRoot, 'added.txt'), 'new path\n', 'utf8')
  const changedPaths = run(
    tokenRoot,
    [
      'assignment',
      'shelf',
      tokenAssignment.id,
      '--reason=pause token work',
      `--snapshot-token=${firstToken}`,
    ],
    1
  )
  assert.match(changedPaths.stderr, /token no longer matches/)
  assert.notEqual(snapshotToken(changedPaths), firstToken)
  rmSync(join(tokenRoot, 'added.txt'))
  writeFileSync(join(tokenRoot, 'head.txt'), 'advance HEAD\n', 'utf8')
  runGit(tokenRoot, ['add', 'head.txt'])
  runGit(tokenRoot, ['commit', '--quiet', '-m', 'advance fixture head'])
  const changedHead = run(
    tokenRoot,
    [
      'assignment',
      'shelf',
      tokenAssignment.id,
      '--reason=pause token work',
      `--snapshot-token=${firstToken}`,
    ],
    1
  )
  assert.match(changedHead.stderr, /token no longer matches/)
  assert.notEqual(snapshotToken(changedHead), firstToken)

  const cacheRoot = tempProject('cache-only')
  const cacheAssignment = createAssignment(cacheRoot, 'Preserve disposable cache')
  commitAll(cacheRoot, 'active cache assignment fixture')
  const cacheBoundary = runGit(cacheRoot, ['rev-parse', 'HEAD'])
  mkdirSync(join(cacheRoot, '.specdev', 'cache'), { recursive: true })
  const localCache = join(cacheRoot, '.specdev', 'cache', 'local-only.txt')
  writeFileSync(localCache, 'rebuildable local cache\n', 'utf8')
  const cacheShelf = runJson(cacheRoot, [
    'assignment',
    'shelf',
    cacheAssignment.id,
    '--reason=retire cache-only assignment',
    '--json',
  ])
  assert.equal(cacheShelf.repository.boundary_commit, cacheBoundary)
  assert.equal(readFileSync(localCache, 'utf8'), 'rebuildable local cache\n')
  assert.equal(runGit(cacheRoot, ['status', '--short']), '')

  const legacyCacheRoot = tempProject('tracked-cache')
  const legacyCacheAssignment = createAssignment(legacyCacheRoot, 'Untrack legacy disposable cache')
  commitAll(legacyCacheRoot, 'active legacy cache assignment fixture')
  mkdirSync(join(legacyCacheRoot, '.specdev', 'cache'), { recursive: true })
  const legacyCache = join(legacyCacheRoot, '.specdev', 'cache', 'legacy.txt')
  writeFileSync(legacyCache, 'tracked cache baseline\n', 'utf8')
  runGit(legacyCacheRoot, ['add', '--force', '.specdev/cache/legacy.txt'])
  runGit(legacyCacheRoot, ['commit', '--quiet', '-m', 'track legacy cache fixture'])
  const legacyBoundary = runGit(legacyCacheRoot, ['rev-parse', 'HEAD'])
  writeFileSync(legacyCache, 'locally rebuilt cache\n', 'utf8')
  const legacyShelf = runJson(legacyCacheRoot, [
    'assignment',
    'shelf',
    legacyCacheAssignment.id,
    '--reason=retire tracked cache',
    '--json',
  ])
  assert.equal(legacyShelf.repository.boundary_commit, legacyBoundary)
  assert.equal(readFileSync(legacyCache, 'utf8'), 'locally rebuilt cache\n')
  assert.equal(runGit(legacyCacheRoot, ['ls-files', '.specdev/cache']), '')
  assert.equal(runGit(legacyCacheRoot, ['status', '--short']), '')

  const boundaryRecoveryRoot = tempProject('boundary-recovery')
  const boundaryRecovery = createAssignment(
    boundaryRecoveryRoot,
    'Recover an existing snapshot boundary'
  )
  commitAll(boundaryRecoveryRoot, 'active boundary recovery fixture')
  writeFileSync(join(boundaryRecoveryRoot, 'work.txt'), 'recover me\n', 'utf8')
  const boundaryDecision = run(
    boundaryRecoveryRoot,
    ['assignment', 'shelf', boundaryRecovery.id, '--reason=resume after boundary'],
    1
  )
  const boundaryToken = snapshotToken(boundaryDecision)
  runGit(boundaryRecoveryRoot, ['add', 'work.txt'])
  runGit(boundaryRecoveryRoot, [
    'commit',
    '--quiet',
    '-m',
    `specdev(assignment): shelf snapshot ${boundaryRecovery.id}`,
    '-m',
    `SpecDev-Assignment: ${boundaryRecovery.id}\nSpecDev-Commit-Type: shelf-snapshot\nSpecDev-Snapshot-Token: ${boundaryToken}`,
  ])
  const recoveredBoundary = runGit(boundaryRecoveryRoot, ['rev-parse', 'HEAD'])
  const recovered = runJson(boundaryRecoveryRoot, [
    'assignment',
    'shelf',
    boundaryRecovery.id,
    '--reason=resume after boundary',
    `--snapshot-token=${boundaryToken}`,
    '--json',
  ])
  assert.equal(recovered.repository.boundary_commit, recoveredBoundary)
  assert.equal(
    runGit(boundaryRecoveryRoot, [
      'log',
      '--format=%s',
      '--grep',
      `specdev(assignment): shelf snapshot ${boundaryRecovery.id}`,
    ])
      .split('\n')
      .filter(Boolean).length,
    1
  )

  const terminalRecoveryRoot = tempProject('terminal-recovery')
  const terminalRecovery = createAssignment(
    terminalRecoveryRoot,
    'Recover terminal metadata after commit failure'
  )
  commitAll(terminalRecoveryRoot, 'active terminal recovery fixture')
  writeFileSync(join(terminalRecoveryRoot, 'work.txt'), 'terminal recovery\n', 'utf8')
  const terminalDecision = run(
    terminalRecoveryRoot,
    ['assignment', 'shelf', terminalRecovery.id, '--reason=resume terminal commit'],
    1
  )
  const terminalToken = snapshotToken(terminalDecision)
  const hook = join(terminalRecoveryRoot, '.git', 'hooks', 'pre-commit')
  writeFileSync(
    hook,
    '#!/bin/sh\nif git diff --cached --name-only | grep -q "/shelf.md$"; then exit 1; fi\n',
    'utf8'
  )
  chmodSync(hook, 0o755)
  const interruptedTerminal = run(
    terminalRecoveryRoot,
    [
      'assignment',
      'shelf',
      terminalRecovery.id,
      '--reason=resume terminal commit',
      `--snapshot-token=${terminalToken}`,
    ],
    1
  )
  assert.match(interruptedTerminal.stderr, /terminal cleanup did not finish/)
  assert.match(
    interruptedTerminal.stderr,
    new RegExp(`Rerun: specdev assignment shelf ${terminalRecovery.id} .*${terminalToken}`)
  )
  const interruptedStatus = JSON.parse(
    readFileSync(join(terminalRecoveryRoot, terminalRecovery.path, 'status.json'), 'utf8')
  )
  assert.equal(interruptedStatus.status, 'shelved')
  rmSync(hook)
  const terminalRecovered = runJson(terminalRecoveryRoot, [
    'assignment',
    'shelf',
    terminalRecovery.id,
    '--reason=resume terminal commit',
    `--snapshot-token=${terminalToken}`,
    '--json',
  ])
  assert.equal(terminalRecovered.idempotent, true)
  assert.match(
    commitMessage(terminalRecoveryRoot, terminalRecovered.repository.terminal_commit),
    /SpecDev-Commit-Type: shelf-terminal/
  )
  assert.equal(runGit(terminalRecoveryRoot, ['status', '--short']), '')

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
