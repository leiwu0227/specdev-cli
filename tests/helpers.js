import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

export function cleanupDir(path) {
  if (existsSync(path)) rmSync(path, { recursive: true, force: true })
}

export function runSpecdev(args, options = {}) {
  return spawnSync(process.execPath, ['./bin/specdev.js', ...args], {
    encoding: 'utf-8',
    ...options,
  })
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
