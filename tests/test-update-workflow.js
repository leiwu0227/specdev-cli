import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { installGraphPackages, installWorkspaceEngine } from '../src/utils/engine.js'

const repoRoot = resolve(import.meta.dirname, '..')
const bin = join(repoRoot, 'bin', 'specdev.js')
const roots = []

function fixture(label) {
  const root = mkdtempSync(join(tmpdir(), `specdev-update-workflow-${label}-`))
  roots.push(root)
  return root
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

function json(root, args, expectedStatus = 0) {
  const result = run(root, args, expectedStatus)
  return JSON.parse(result.stdout)
}

function initialize(root) {
  const initialized = json(root, ['init', '--json'])
  assert.equal(initialized.status, 'ok')
}

function writeBigPicture(root) {
  writeFileSync(
    join(root, '.specdev', 'project_notes', 'big_picture.md'),
    '# Project Big Picture\n\nThis fixture models a Node.js CLI workspace with durable workflow state, supported platform adapters, and isolated command-level verification for update completion.\n',
    'utf8'
  )
}

function installSyntheticNextPackage(root) {
  const source = join(root, 'next-workflows')
  cpSync(join(repoRoot, 'templates', '.specdev', 'workflows'), source, { recursive: true })
  const graphPath = join(source, 'update-completion', 'graph.json')
  const graph = JSON.parse(readFileSync(graphPath, 'utf8'))
  graph.version = '2.0.0'
  writeFileSync(graphPath, `${JSON.stringify(graph, null, 2)}\n`, 'utf8')
  return installGraphPackages(source, join(root, '.specdev', 'workflows')).then(() =>
    installWorkspaceEngine(root)
  )
}

try {
  const mixed = fixture('mixed')
  initialize(mixed)
  writeBigPicture(mixed)
  json(mixed, ['do', 'start an assignment'])
  const assignment = json(mixed, ['assignment', 'Keep this workflow focused', '--json'])
  const focusBefore = readFileSync(join(mixed, '.specdev', '.current'), 'utf8')
  const graphBefore = readFileSync(join(mixed, '.specdev', '.ripplegraph', 'current.json'), 'utf8')

  writeFileSync(
    join(mixed, 'AGENTS.md'),
    '# Repository instructions\n\nKeep project-owned release rules unchanged.\n\n## SpecDev\n\nRead `.specdev/_router.md` and `.specdev/project_notes/assignment_progress.md`.\n',
    'utf8'
  )
  const started = json(mixed, ['update', '--json'])
  assert.equal(started.status, 'agent_action_required')
  assert.equal(started.runtime_status, 'updated')
  assert.equal(started.adapter_status, 'reconciliation_required')
  assert.match(started.operation, /^UPD\d{5}$/)
  assert.equal(started.graph, 'update-completion@1.0.0')
  assert.match(started.next_action, new RegExp(`--operation=${started.operation}`))
  assert.equal(readFileSync(join(mixed, '.specdev', '.current'), 'utf8'), focusBefore)
  assert.equal(
    readFileSync(join(mixed, '.specdev', '.ripplegraph', 'current.json'), 'utf8'),
    graphBefore
  )
  assert.match(readFileSync(join(mixed, 'AGENTS.md'), 'utf8'), /_router\.md/)

  const indexPath = join(mixed, '.specdev', '_index.md')
  writeFileSync(indexPath, `${readFileSync(indexPath, 'utf8')}\nPINNED RESUME SENTINEL\n`, 'utf8')
  await installSyntheticNextPackage(mixed)
  writeFileSync(
    join(mixed, 'AGENTS.md'),
    '# Repository instructions\n\nKeep project-owned release rules unchanged.\n\n## SpecDev\n\nRead `.specdev/_main.md` for the current workflow.\n',
    'utf8'
  )
  const statusBeforeDryResume = json(mixed, ['update', '--status', '--json'])
  const dryResume = json(
    mixed,
    ['update', '--dry-run', `--operation=${started.operation}`, '--json'],
    1
  )
  assert.equal(dryResume.status, 'error')
  assert.match(dryResume.error, /--dry-run cannot be combined with --operation/)
  assert.deepEqual(json(mixed, ['update', '--status', '--json']), statusBeforeDryResume)
  assert.equal(
    existsSync(
      join(
        mixed,
        '.specdev',
        '.ripplegraph',
        'calls',
        started.operation,
        'artifacts',
        'validate-adapters',
        'output.json'
      )
    ),
    false
  )
  const completed = json(mixed, ['update', `--operation=${started.operation}`, '--json'])
  assert.equal(completed.status, 'ok')
  assert.equal(completed.adapter_status, 'current')
  assert.equal(completed.graph, 'update-completion@1.0.0')
  assert.match(completed.receipt, /UPD\d{5}/)
  assert.match(readFileSync(indexPath, 'utf8'), /PINNED RESUME SENTINEL/)
  assert.match(readFileSync(join(mixed, 'AGENTS.md'), 'utf8'), /project-owned release rules/)
  assert.equal(readFileSync(join(mixed, '.specdev', '.current'), 'utf8'), focusBefore)
  assert.equal(
    readFileSync(join(mixed, '.specdev', '.ripplegraph', 'current.json'), 'utf8'),
    graphBefore
  )
  assert.equal(assignment.status, 'ok')

  rmSync(join(mixed, 'CLAUDE.md'))
  const backfilled = json(mixed, ['update', '--json'])
  assert.equal(backfilled.status, 'ok')
  assert.equal(backfilled.adapter_status, 'current')
  assert.deepEqual(backfilled.adapters_created, ['CLAUDE.md'])
  assert.equal(backfilled.operation, null)

  const ambiguous = fixture('ambiguous')
  initialize(ambiguous)
  writeFileSync(
    join(ambiguous, 'AGENTS.md'),
    '# Repository deployment\n\nUse `.specdev/_router.md` while applying project release rules.\n',
    'utf8'
  )
  const ambiguousStart = json(ambiguous, ['update', '--json'])
  assert.equal(ambiguousStart.status, 'agent_action_required')
  assert.equal(ambiguousStart.adapter_status, 'ambiguous')
  const ambiguousResume = json(ambiguous, [
    'update',
    `--operation=${ambiguousStart.operation}`,
    '--json',
  ])
  assert.equal(ambiguousResume.status, 'agent_action_required')
  assert.match(ambiguousResume.issues.join('\n'), /obtain user direction/)

  const dry = fixture('dry')
  initialize(dry)
  writeFileSync(
    join(dry, 'AGENTS.md'),
    '# Project\n\nKeep this.\n\n## SpecDev\n\nRead `.specdev/_router.md`.\n',
    'utf8'
  )
  const beforeDry = json(dry, ['update', '--status', '--json']).operations.length
  const dryRun = json(dry, ['update', '--dry-run', '--json'])
  assert.equal(dryRun.dry_run, true)
  assert.equal(dryRun.adapter_status, 'would_require_reconciliation')
  assert.equal(json(dry, ['update', '--status', '--json']).operations.length, beforeDry)
  assert.match(readFileSync(join(dry, 'AGENTS.md'), 'utf8'), /_router\.md/)
  assert.match(run(dry, ['update', '--status']).stdout, /No update completion operations/)
} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
}

console.log('Update workflow tests passed.')
