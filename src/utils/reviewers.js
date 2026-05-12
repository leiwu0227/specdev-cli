import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'
import fse from 'fs-extra'

const REVIEWERS_SUBPATH = ['skills', 'core', 'reviewloop', 'reviewers']

export function reviewersDir(specdevPath) {
  return join(specdevPath, ...REVIEWERS_SUBPATH)
}

/**
 * List reviewer names (basenames of *.json files under reviewers/) sorted.
 */
export async function listReviewers(specdevPath) {
  const dir = reviewersDir(specdevPath)
  if (!(await fse.pathExists(dir))) return []
  const files = await fse.readdir(dir)
  return files
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort()
}

/**
 * Check that reviewer CLIs referenced in reviewers/*.json are installed.
 * Returns an array of { name, command, binary, found } objects.
 */
export async function checkReviewerCLIs(specdevPath) {
  const dir = reviewersDir(specdevPath)
  if (!await fse.pathExists(dir)) return []

  const results = []
  const files = readdirSync(dir).filter(f => f.endsWith('.json'))

  for (const file of files) {
    const name = file.replace('.json', '')
    try {
      const config = JSON.parse(readFileSync(join(dir, file), 'utf-8'))
      const command = config.command || ''
      // Extract the binary name (first word of the command)
      const binary = command.split(/\s+/)[0]
      if (!binary) {
        results.push({ name, command, binary: '', found: false })
        continue
      }

      const which = spawnSync('which', [binary], { encoding: 'utf-8' })
      results.push({ name, command, binary, found: which.status === 0 })
    } catch {
      results.push({ name, command: '', binary: '', found: false })
    }
  }

  return results
}

/**
 * Print reviewer CLI check results. Returns true if all found, false otherwise.
 */
export function printReviewerCheck(results) {
  if (results.length === 0) return true

  let allFound = true
  for (const r of results) {
    if (r.found) {
      console.log(`   ✓ ${r.name}: ${r.binary} found`)
    } else {
      console.log(`   ⚠ ${r.name}: ${r.binary || '(no command)'} not found — reviewloop will not work with this reviewer`)
      allFound = false
    }
  }
  return allFound
}
