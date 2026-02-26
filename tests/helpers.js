import { existsSync, rmSync } from 'fs'
import { spawnSync } from 'child_process'

export function cleanupDir(path) {
  if (existsSync(path)) rmSync(path, { recursive: true, force: true })
}

export function runSpecdev(args, options = {}) {
  return spawnSync('node', ['./bin/specdev.js', ...args], {
    encoding: 'utf-8',
    ...options,
  })
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
