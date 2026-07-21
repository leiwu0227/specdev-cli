import { join } from 'path'
import fse from 'fs-extra'
import { reserveEntityId } from './id-reservation.js'

export function parseDiscussionId(name) {
  const match = name.match(/^(D\d{4,5})_(.+)$/)
  if (match) return { id: match[1], slug: match[2] }
  return { id: null, slug: name }
}

export async function resolveDiscussionSelector(specdevPath, selector) {
  const wanted = String(selector || '').trim()
  if (!/^D\d{4,5}(?:_[^/\\]+)?$/.test(wanted)) {
    return { error: 'malformed', selector: wanted }
  }

  const discussionsDir = join(specdevPath, 'discussions')
  if (!(await fse.pathExists(discussionsDir))) return null

  const exactPath = join(discussionsDir, wanted)
  if (await fse.pathExists(exactPath) && (await fse.stat(exactPath)).isDirectory()) {
    return { name: wanted, path: exactPath }
  }
  if (wanted.includes('_')) return null

  const entries = await fse.readdir(discussionsDir, { withFileTypes: true })
  const matches = entries
    .filter(e => e.isDirectory() && e.name.startsWith(`${wanted}_`))
    .map(e => e.name)

  if (matches.length === 1) {
    return { name: matches[0], path: join(discussionsDir, matches[0]) }
  }

  return null
}

export async function getNextDiscussionId(specdevPath) {
  return reserveEntityId(specdevPath, 'discussion')
}
