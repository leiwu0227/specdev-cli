import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, stringify } from 'yaml'
import { missionPathDigest } from '../src/utils/mission-ownership.js'
import { inspectMissionLanding, landMission } from '../src/utils/mission-landing.js'
import { checkpointMissionBoundary } from '../src/commands/mission.js'

const CLI = fileURLToPath(new URL('../bin/specdev.js', import.meta.url))
const roots = []
const git = (root, args) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
function run(root, args, expected = 0) {
  const result = spawnSync(process.execPath, [CLI, ...args, '--json'], {
    cwd: root,
    encoding: 'utf8',
  })
  assert.equal(result.status, expected, result.stderr || result.stdout)
  return JSON.parse(result.stdout)
}
function fixture({ commit = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'specdev-mission-checkout-'))
  roots.push(root)
  git(root, ['init', '-b', 'main'])
  git(root, ['config', 'user.name', 'SpecDev Test'])
  git(root, ['config', 'user.email', 'specdev@example.test'])
  run(root, ['init', '--platform=none'])
  if (commit) {
    git(root, ['add', '--all'])
    git(root, ['commit', '-m', 'initial'])
  }
  return root
}
function snapshot(root) {
  return JSON.stringify([
    git(root, ['show-ref']),
    git(root, ['status', '--porcelain=v1', '--untracked-files=all']),
    git(root, ['diff', '--cached']),
    git(root, ['config', '--local', '--list']),
    git(root, ['worktree', 'list', '--porcelain']),
  ])
}
try {
  // Removed commands reject before even resolving Mission state and preserve index/ref/config.
  const root = fixture()
  writeFileSync(join(root, 'staged.txt'), 'staged\n')
  git(root, ['add', 'staged.txt'])
  writeFileSync(join(root, 'staged.txt'), 'later unstaged\n')
  const before = snapshot(root)
  for (const command of [
    ['land', 'M00001'],
    ['checkpoint', 'M00001', '--push'],
  ]) {
    const rejected = run(root, ['mission', ...command], 1)
    assert.equal(rejected.status, 'unsupported')
    assert.equal(
      rejected.reason,
      command[0] === 'land' ? 'branch_management_removed' : 'publishing_removed'
    )
    assert.equal(snapshot(root), before)
  }
  assert.equal((await landMission(root, {})).reason, 'branch_management_removed')
  assert.equal((await inspectMissionLanding(root, {})).status, 'unsupported')

  // Creation requires a real attached HEAD before reserving IDs or starting a run.
  const unborn = fixture({ commit: false })
  const counters = join(unborn, '.specdev', '.id-counters.json')
  const oldCounters = existsSync(counters) ? readFileSync(counters, 'utf8') : null
  assert.match(
    run(unborn, ['mission', 'create', 'Unborn refusal'], 1).error,
    /Git commit is required/
  )
  assert.equal(existsSync(counters) ? readFileSync(counters, 'utf8') : null, oldCounters)
  const detached = fixture()
  git(detached, ['checkout', '--detach'])
  const detachedBefore = snapshot(detached)
  assert.match(
    run(detached, ['mission', 'create', 'Detached refusal'], 1).error,
    /attached checkout/
  )
  assert.equal(snapshot(detached), detachedBefore)

  // Exact child byte manifests commit only owned paths, preserving unrelated staged and unstaged bytes.
  const ownedRoot = fixture()
  const created = run(ownedRoot, ['mission', 'create', 'Owned checkpoint'])
  assert.equal(created.branch, 'main')
  assert.equal(git(ownedRoot, ['branch', '--format=%(refname:short)']), 'main')
  const missionPath = join(ownedRoot, created.path)
  const child = '00001_owned'
  const childPath = join(ownedRoot, '.specdev', 'assignments', child)
  mkdirSync(join(childPath, 'implementation'), { recursive: true })
  mkdirSync(join(missionPath, 'design'), { recursive: true })
  writeFileSync(
    join(childPath, 'status.json'),
    JSON.stringify({ id: '00001', mission: created.id })
  )
  writeFileSync(
    join(missionPath, 'design', 'assignments.yaml'),
    stringify({
      version: 2,
      design_mode: 'single',
      assignments: [{ id: '00001', folder: child, status: 'completed', wave: 1 }],
    })
  )
  writeFileSync(join(ownedRoot, 'owned.txt'), 'user work at approval\n')
  git(ownedRoot, ['add', 'owned.txt'])
  git(ownedRoot, ['commit', '-m', 'separately record pre-existing product work'])
  const mission = parse(readFileSync(join(missionPath, 'mission.yaml'), 'utf8'))
  mission.approval_dirty_paths = ['owned.txt']
  mission.product_boundary = { adopted_paths: [], established_at: new Date().toISOString() }
  writeFileSync(join(missionPath, 'mission.yaml'), stringify(mission))
  writeFileSync(join(ownedRoot, 'owned.txt'), 'owned\n')
  writeFileSync(
    join(childPath, 'implementation', 'progress.json'),
    JSON.stringify({
      owned_paths: [{ path: 'owned.txt', sha256: await missionPathDigest(ownedRoot, 'owned.txt') }],
    })
  )
  writeFileSync(join(ownedRoot, 'unrelated.txt'), 'index bytes\n')
  git(ownedRoot, ['add', 'unrelated.txt'])
  writeFileSync(join(ownedRoot, 'unrelated.txt'), 'working bytes\n')
  const indexBefore = git(ownedRoot, ['show', ':unrelated.txt'])
  const checkpoint = await checkpointMissionBoundary(
    { targetDir: ownedRoot, specdevPath: join(ownedRoot, '.specdev'), missionPath, mission },
    '00001'
  )
  assert.equal(checkpoint.committed, true)
  const repeated = run(ownedRoot, ['mission', 'checkpoint', created.id])
  assert.equal(repeated.committed, false)
  assert.equal(repeated.revision, checkpoint.revision)
  assert.equal(git(ownedRoot, ['show', ':unrelated.txt']), indexBefore)
  assert.equal(readFileSync(join(ownedRoot, 'unrelated.txt'), 'utf8'), 'working bytes\n')
  assert.equal(git(ownedRoot, ['ls-tree', '--name-only', 'HEAD', 'unrelated.txt']), '')
  assert.equal(git(ownedRoot, ['show', 'HEAD:owned.txt']), 'owned')
  writeFileSync(join(ownedRoot, 'owned.txt'), 'overlap\n')
  const overlapBefore = snapshot(ownedRoot)
  assert.match(
    run(ownedRoot, ['mission', 'checkpoint', created.id], 1).error,
    /changed after its worker manifest/
  )
  assert.equal(snapshot(ownedRoot), overlapBefore)

  // Historical completed-but-unlanded evidence is inspectable from another checkout.
  const historical = fixture()
  const base = git(historical, ['rev-parse', 'HEAD'])
  git(historical, ['switch', '-c', 'legacy-mission'])
  const historicalPath = join(historical, '.specdev', 'missions', 'M00001_legacy')
  mkdirSync(historicalPath, { recursive: true })
  writeFileSync(
    join(historicalPath, 'mission.yaml'),
    stringify({
      version: 1,
      id: 'M00001',
      status: 'completed',
      branch: 'legacy-mission',
      base_branch: 'main',
      base_revision: base,
    })
  )
  git(historical, ['add', '--all'])
  git(historical, [
    'commit',
    '-m',
    'completion',
    '-m',
    'SpecDev-Mission: M00001\nSpecDev-Commit-Type: completion',
  ])
  const finalRevision = git(historical, ['rev-parse', 'HEAD'])
  git(historical, ['switch', 'main'])
  const historicalBefore = snapshot(historical)
  const status = run(historical, ['mission', 'status', 'M00001'])
  assert.equal(status.final_revision, finalRevision)
  assert.equal(status.landing, undefined)
  assert(status.revision_facts.some((f) => f.revision === finalRevision && !f.contained))
  assert.equal(snapshot(historical), historicalBefore)
  console.log('Mission checkout, exact ownership, and landing compatibility tests passed.')
} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
}
