import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync, openSync, closeSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

export function cleanupDir(path) {
  if (existsSync(path)) rmSync(path, { recursive: true, force: true })
}

export function runSpecdev(args, options = {}) {
  const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const stdoutPath = join('/tmp', `specdev-test-${token}.stdout`)
  const stderrPath = join('/tmp', `specdev-test-${token}.stderr`)
  const outFd = openSync(stdoutPath, 'w')
  const errFd = openSync(stderrPath, 'w')

  const result = spawnSync(process.execPath, ['./bin/specdev.js', ...args], {
    stdio: ['ignore', outFd, errFd],
    ...options,
  })

  closeSync(outFd)
  closeSync(errFd)

  const stdout = existsSync(stdoutPath) ? readFileSync(stdoutPath, 'utf-8') : ''
  const stderr = existsSync(stderrPath) ? readFileSync(stderrPath, 'utf-8') : ''
  rmSync(stdoutPath, { force: true })
  rmSync(stderrPath, { force: true })

  return { ...result, stdout, stderr }
}

/**
 * Create a mock tool skill in a test directory's .specdev/skills/tools/.
 * Call after `specdev init` to simulate having a tool skill available.
 */
export function createMockToolSkill(testDir, name = 'mock-tool') {
  const skillDir = join(testDir, '.specdev', 'skills', 'tools', name)
  mkdirSync(skillDir, { recursive: true })
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: A mock tool for testing\ntype: tool\n---\n\n# ${name}\n\nA mock tool skill used for testing.\n`,
    'utf-8'
  )
}

export function assertTest(condition, msg, detail = '') {
  if (!condition) {
    console.error(`  ❌ ${msg}`)
    if (detail) console.error(`     ${detail}`)
    return false
  }
  console.log(`  ✓ ${msg}`)
  return true
}
