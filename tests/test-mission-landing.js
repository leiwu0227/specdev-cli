import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectMissionLanding, landMission } from '../src/utils/mission-landing.js'

const CLI = fileURLToPath(new URL('../bin/specdev.js', import.meta.url))
const roots = []

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf-8' }).trim()
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'specdev-mission-landing-'))
  roots.push(root)
  git(root, ['init', '-b', 'main'])
  git(root, ['config', 'user.name', 'SpecDev Test'])
  git(root, ['config', 'user.email', 'specdev@example.test'])
  writeFileSync(join(root, 'base.txt'), 'base\n')
  git(root, ['add', 'base.txt'])
  git(root, ['commit', '-m', 'base'])
  const baseRevision = git(root, ['rev-parse', 'HEAD'])
  git(root, ['switch', '-c', 'specdev/M00001-land'])
  writeFileSync(join(root, 'delivery.txt'), 'delivered\n')
  git(root, ['add', 'delivery.txt'])
  git(root, [
    'commit',
    '-m',
    'specdev: checkpoint M00001',
    '-m',
    'SpecDev-Mission: M00001\nSpecDev-Commit-Type: completion',
  ])
  const finalRevision = git(root, ['rev-parse', 'HEAD'])
  return {
    root,
    baseRevision,
    finalRevision,
    mission: {
      id: 'M00001',
      status: 'completed',
      base_branch: 'main',
      base_revision: baseRevision,
      branch: 'specdev/M00001-land',
      final_revision: finalRevision,
    },
  }
}

function revisions(root, mission) {
  return {
    base: git(root, ['rev-parse', mission.base_branch]),
    mission: git(root, ['rev-parse', mission.branch]),
  }
}

function runCli(root, args) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd: root,
    encoding: 'utf-8',
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return JSON.parse(result.stdout)
}

try {
  {
    const { root, mission, finalRevision } = fixture()
    const landed = await landMission(root, mission)
    assert.equal(landed.status, 'landed')
    assert.equal(landed.reason, 'fast_forwarded')
    assert.equal(git(root, ['branch', '--show-current']), 'main')
    assert.equal(git(root, ['rev-parse', 'main']), finalRevision)
    assert.equal(git(root, ['rev-parse', mission.branch]), finalRevision)

    const repeated = await landMission(root, mission)
    assert.equal(repeated.status, 'already_landed')
    assert.equal(repeated.reason, 'base_at_final')
  }

  {
    const { root, mission, baseRevision, finalRevision } = fixture()
    git(root, ['switch', 'main'])
    assert.equal(git(root, ['rev-parse', 'main']), baseRevision)
    const recovered = await landMission(root, mission)
    assert.equal(recovered.status, 'landed')
    assert.equal(git(root, ['rev-parse', 'main']), finalRevision)
  }

  {
    const { root, mission } = fixture()
    const before = revisions(root, mission)
    writeFileSync(join(root, 'dirty.txt'), 'dirty\n')
    const dirty = await inspectMissionLanding(root, mission)
    assert.equal(dirty.status, 'pending')
    assert.equal(dirty.reason, 'dirty_worktree')
    assert.deepEqual(revisions(root, mission), before)
  }

  {
    const { root, mission } = fixture()
    git(root, ['branch', '-D', 'main'])
    const beforeMission = git(root, ['rev-parse', mission.branch])
    const missing = await inspectMissionLanding(root, mission)
    assert.equal(missing.status, 'pending')
    assert.equal(missing.reason, 'missing_base_branch')
    assert.equal(git(root, ['rev-parse', mission.branch]), beforeMission)
  }

  {
    const { root, mission } = fixture()
    git(root, ['switch', '-c', 'unrelated'])
    const before = revisions(root, mission)
    const wrong = await inspectMissionLanding(root, mission)
    assert.equal(wrong.status, 'pending')
    assert.equal(wrong.reason, 'wrong_branch')
    assert.deepEqual(revisions(root, mission), before)
  }

  {
    const { root, mission } = fixture()
    git(root, ['switch', 'main'])
    writeFileSync(join(root, 'diverged.txt'), 'diverged\n')
    git(root, ['add', 'diverged.txt'])
    git(root, ['commit', '-m', 'diverge base'])
    git(root, ['switch', mission.branch])
    const before = revisions(root, mission)
    const diverged = await landMission(root, mission)
    assert.equal(diverged.status, 'pending')
    assert.equal(diverged.reason, 'diverged')
    assert.deepEqual(revisions(root, mission), before)
  }

  {
    const { root, mission } = fixture()
    runCli(root, ['init', '--json'])
    const missionPath = join(root, '.specdev', 'missions', 'M00001_land')
    mkdirSync(missionPath, { recursive: true })
    writeFileSync(
      join(missionPath, 'mission.yaml'),
      [
        'version: 1',
        'id: M00001',
        'status: completed',
        `base_branch: ${mission.base_branch}`,
        `base_revision: ${mission.base_revision}`,
        `branch: ${mission.branch}`,
        '',
      ].join('\n')
    )
    git(root, ['add', '--all'])
    git(root, [
      'commit',
      '-m',
      'specdev: checkpoint M00001',
      '-m',
      'SpecDev-Mission: M00001\nSpecDev-Commit-Type: completion',
    ])
    const finalRevision = git(root, ['rev-parse', 'HEAD'])
    const landed = runCli(root, ['mission', 'land', 'M00001', '--json'])
    assert.equal(landed.status, 'landed')
    assert.equal(landed.landing.status, 'landed')
    assert.equal(git(root, ['rev-parse', 'main']), finalRevision)

    const status = runCli(root, ['mission', 'status', 'M00001', '--json'])
    assert.equal(status.landing.status, 'already_landed')
    assert.equal(status.landing.reason, 'base_at_final')
  }

  {
    const root = mkdtempSync(join(tmpdir(), 'specdev-mission-landing-cli-recovery-'))
    roots.push(root)
    git(root, ['init', '-b', 'main'])
    git(root, ['config', 'user.name', 'SpecDev Test'])
    git(root, ['config', 'user.email', 'specdev@example.test'])
    writeFileSync(join(root, 'base.txt'), 'base\n')
    git(root, ['add', 'base.txt'])
    git(root, ['commit', '-m', 'base'])
    runCli(root, ['init', '--json'])
    const currentPath = join(root, '.specdev', '.ripplegraph', 'current.json')
    rmSync(currentPath, { force: true })
    git(root, ['add', '--all'])
    git(root, ['commit', '-m', 'initialize specdev without current focus'])
    const baseRevision = git(root, ['rev-parse', 'HEAD'])
    const branch = 'specdev/M00001-land'
    git(root, ['switch', '-c', branch])
    const missionPath = join(root, '.specdev', 'missions', 'M00001_land')
    mkdirSync(missionPath, { recursive: true })
    writeFileSync(
      join(missionPath, 'mission.yaml'),
      [
        'version: 1',
        'id: M00001',
        'status: completed',
        'base_branch: main',
        `base_revision: ${baseRevision}`,
        `branch: ${branch}`,
        '',
      ].join('\n')
    )
    writeFileSync(join(root, 'delivery.txt'), 'delivered\n')
    git(root, ['add', '--all'])
    git(root, [
      'commit',
      '-m',
      'specdev: checkpoint M00001',
      '-m',
      'SpecDev-Mission: M00001\nSpecDev-Commit-Type: completion',
    ])
    const finalRevision = git(root, ['rev-parse', 'HEAD'])
    git(root, ['switch', 'main'])
    assert.equal(git(root, ['rev-parse', 'main']), baseRevision)
    assert.equal(existsSync(currentPath), false)
    const statusBefore = git(root, ['status', '--porcelain=v1', '--untracked-files=all'])
    const pending = runCli(root, ['mission', 'status', 'M00001', '--json'])
    assert.equal(pending.status, 'completed')
    assert.equal(pending.landing.status, 'ready')
    assert.equal(existsSync(currentPath), false)
    assert.equal(git(root, ['status', '--porcelain=v1', '--untracked-files=all']), statusBefore)

    const recovered = runCli(root, ['mission', 'land', 'M00001', '--json'])
    assert.equal(recovered.status, 'landed')
    assert.equal(recovered.landing.status, 'landed')
    assert.equal(git(root, ['rev-parse', 'main']), finalRevision)
  }

  console.log('Mission landing tests passed.')
} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
}
