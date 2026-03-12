import { join } from 'path'
import fse from 'fs-extra'

export function parseDiscussionId(name) {
  const match = name.match(/^(D\d{4})_(.+)$/)
  if (match) return { id: match[1], slug: match[2] }
  return { id: null, slug: name }
}

export async function resolveDiscussionSelector(specdevPath, selector) {
  if (!/^D\d{4}/.test(selector)) {
    return { error: 'malformed', selector }
  }

  const discussionsDir = join(specdevPath, 'discussions')
  if (!(await fse.pathExists(discussionsDir))) return null

  const exactPath = join(discussionsDir, selector)
  if (await fse.pathExists(exactPath)) {
    return { name: selector, path: exactPath }
  }

  const entries = await fse.readdir(discussionsDir, { withFileTypes: true })
  const matches = entries
    .filter(e => e.isDirectory() && e.name.startsWith(selector))
    .map(e => e.name)

  if (matches.length === 1) {
    return { name: matches[0], path: join(discussionsDir, matches[0]) }
  }

  return null
}

export async function getNextDiscussionId(specdevPath) {
  const discussionsDir = join(specdevPath, 'discussions')
  await fse.ensureDir(discussionsDir)

  const entries = await fse.readdir(discussionsDir, { withFileTypes: true })
  const ids = entries
    .filter(e => e.isDirectory())
    .map(e => {
      const parsed = parseDiscussionId(e.name)
      return parsed.id ? Number(parsed.id.slice(1)) : 0
    })
    .filter(n => n > 0)

  const nextNum = ids.length > 0 ? Math.max(...ids) + 1 : 1
  return `D${String(nextNum).padStart(4, '0')}`
}
