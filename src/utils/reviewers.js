import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'
import fse from 'fs-extra'

/**
 * Check that reviewer CLIs referenced in reviewers/*.json are installed.
 * Returns an array of { name, command, binary, found } objects.
 */
export async function checkReviewerCLIs(specdevPath) {
  const reviewersDir = join(specdevPath, 'skills', 'core', 'reviewloop', 'reviewers')
  if (!await fse.pathExists(reviewersDir)) return []

  const results = []
  const files = readdirSync(reviewersDir).filter(f => f.endsWith('.json'))

  for (const file of files) {
    const name = file.replace('.json', '')
    try {
      const config = JSON.parse(readFileSync(join(reviewersDir, file), 'utf-8'))
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
