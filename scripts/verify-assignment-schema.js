#!/usr/bin/env node

import { existsSync, readFileSync, statSync, writeSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const schemaPath = join(__dirname, '..', 'specdev.assignment-schema.json')
const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'))

const assignmentPath = process.argv[2]

if (!assignmentPath) {
  writeSync(2, 'Usage: node scripts/verify-assignment-schema.js <assignment-path>\n')
  process.exit(1)
}

if (!existsSync(assignmentPath) || !statSync(assignmentPath).isDirectory()) {
  writeSync(2, `❌ Assignment directory not found: ${assignmentPath}\n`)
  process.exit(1)
}

let failures = 0
let warnings = 0

function pass(msg) {
  writeSync(1, `  ✅ ${msg}\n`)
}

function fail(msg) {
  failures++
  writeSync(1, `  ❌ ${msg}\n`)
}

function warn(msg) {
  warnings++
  writeSync(1, `  ⚠️  ${msg}\n`)
}

function section(name) {
  writeSync(1, '\n')
  writeSync(1, `── ${name} ──\n`)
}

function checkPath(path) {
  return existsSync(join(assignmentPath, path))
}

function phaseSatisfied(phase) {
  const checks = phase.artifacts.map(checkPath)
  return phase.mode === 'all' ? checks.every(Boolean) : checks.some(Boolean)
}

section('Required Directories')
for (const dir of schema.required_directories || []) {
  if (checkPath(dir)) pass(`${dir}/ exists`)
  else fail(`${dir}/ missing`)
}

section('Phase Detection')
let highestPhaseIdx = -1
for (let i = 0; i < schema.phases.length; i++) {
  const phase = schema.phases[i]
  const ok = phaseSatisfied(phase)
  if (ok) highestPhaseIdx = i
  writeSync(1, `  ${ok ? '✅' : '·'} ${phase.id}\n`)
}

if (highestPhaseIdx === -1) {
  warn('No phase artifacts detected yet (assignment may be newly created)')
}

section('Phase Integrity')
for (let i = 0; i <= highestPhaseIdx; i++) {
  const phase = schema.phases[i]
  const ok = phaseSatisfied(phase)
  if (ok) {
    pass(`${phase.id} artifacts satisfy "${phase.mode}" rule`)
  } else {
    fail(`${phase.id} artifacts do not satisfy "${phase.mode}" rule`)
  }
}

if ((schema.optional_paths || []).length > 0) {
  section('Optional Paths')
  for (const path of schema.optional_paths) {
    if (checkPath(path)) pass(`${path} exists`)
    else warn(`${path} missing`)
  }
}

writeSync(1, '\n')
writeSync(1, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
if (failures === 0) {
  writeSync(1, `✅ Schema checks passed (${warnings} warning(s))\n`)
  process.exitCode = 0
} else {
  writeSync(1, `❌ Schema checks failed (${failures} failure(s), ${warnings} warning(s))\n`)
  process.exitCode = 1
}
