import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const cli = join(root, 'bin', 'specdev.js')
const tempRoot = mkdtempSync(join(tmpdir(), 'specdev-update-skill-roots-'))

function prepareFixture(name, codexContent) {
  const target = join(tempRoot, name)
  mkdirSync(join(target, '.specdev', '_guides'), { recursive: true })
  mkdirSync(join(target, '.specdev', 'project_notes'), { recursive: true })
  mkdirSync(join(target, '.claude', 'skills', 'specdev-assignment'), { recursive: true })
  writeFileSync(
    join(target, '.claude', 'skills', 'specdev-assignment', 'SKILL.md'),
    '# managed marker\n',
    'utf8'
  )
  writeFileSync(join(target, '.codex'), codexContent, 'utf8')
  return target
}

function update(target) {
  return spawnSync('node', [cli, 'update', `--target=${target}`, '--json'], {
    cwd: root,
    encoding: 'utf8',
  })
}

try {
  const repairable = prepareFixture('repairable', '')
  const repaired = update(repairable)
  assert.equal(repaired.status, 0, repaired.stderr || repaired.stdout)
  const payload = JSON.parse(repaired.stdout)
  assert.deepEqual(payload.repaired_skill_roots, ['.codex'])
  assert.equal(statSync(join(repairable, '.codex')).isDirectory(), true)
  assert.equal(existsSync(join(repairable, '.codex', 'skills', 'specdev-adhoc', 'SKILL.md')), true)
  assert.equal(existsSync(join(repairable, '.specdev', 'workflow.json')), true)

  const protectedTarget = prepareFixture('protected', 'preserve this file\n')
  const sentinelPath = join(protectedTarget, '.specdev', '_main.md')
  writeFileSync(sentinelPath, 'unchanged sentinel\n', 'utf8')
  const protectedResult = update(protectedTarget)
  assert.equal(protectedResult.status, 1)
  const errorPayload = JSON.parse(protectedResult.stdout)
  assert.match(errorPayload.error, /\.codex.*must be a directory/)
  assert.equal(readFileSync(join(protectedTarget, '.codex'), 'utf8'), 'preserve this file\n')
  assert.equal(readFileSync(sentinelPath, 'utf8'), 'unchanged sentinel\n')
  assert.equal(existsSync(join(protectedTarget, '.specdev', 'workflow.json')), false)
} finally {
  rmSync(tempRoot, { recursive: true, force: true })
}

console.log('Update skill-root migration tests passed.')
