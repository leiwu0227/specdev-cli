import { createHash } from 'node:crypto'
import { join } from 'node:path'
import fse from 'fs-extra'
import { reserveEntityId } from './id-reservation.js'

export async function reserveTestAuditId(specdevPath) {
  return reserveEntityId(specdevPath, 'test_audit')
}

export async function resolveTestAuditSelector(specdevPath, selector) {
  const wanted = String(selector || '').trim()
  if (!/^TA\d{5}(?:_[^/\\]+)?$/.test(wanted)) return null
  const root = join(specdevPath, 'test-audits')
  if (!(await fse.pathExists(root))) return null
  const exact = join(root, wanted)
  if ((await fse.pathExists(exact)) && (await fse.stat(exact)).isDirectory()) {
    return { id: wanted.slice(0, 7), name: wanted, path: exact }
  }
  if (wanted.includes('_')) return null
  const matches = (await fse.readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(`${wanted}_`))
    .map((entry) => entry.name)
  if (matches.length !== 1) return matches.length > 1 ? { ambiguous: true, matches } : null
  return { id: wanted, name: matches[0], path: join(root, matches[0]) }
}

export async function testAuditArtifactHash(auditPath) {
  const hash = createHash('sha256')
  for (const name of ['audit.md', 'assignment-contract.md']) {
    const path = join(auditPath, name)
    if (!(await fse.pathExists(path))) throw new Error(`Test Audit artifact is missing: ${name}`)
    hash.update(name)
    hash.update('\0')
    hash.update(await fse.readFile(path))
    hash.update('\0')
  }
  return hash.digest('hex')
}
