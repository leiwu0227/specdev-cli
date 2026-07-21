import { dirname, isAbsolute, join, relative } from 'node:path'
import fse from 'fs-extra'
import { parse } from 'yaml'

const MAX_GUIDES = 3

export async function loadGuideCatalog(specdevPath) {
  const catalogs = [
    { owner: 'library', path: join(specdevPath, 'guides', 'library', 'catalog.yaml') },
    { owner: 'project', path: join(specdevPath, 'guides', 'project', 'catalog.yaml') },
  ]
  const entries = []
  for (const catalog of catalogs) {
    if (!(await fse.pathExists(catalog.path))) continue
    const decoded = parse(await fse.readFile(catalog.path, 'utf-8'))
    if (!decoded || decoded.version !== 1 || !Array.isArray(decoded.guides)) {
      throw new Error(`invalid guide catalog: ${catalog.path}`)
    }
    for (const entry of decoded.guides) {
      entries.push(validateGuideEntry(specdevPath, catalog, entry))
    }
  }
  const seen = new Set()
  for (const guide of entries) {
    if (seen.has(guide.id)) throw new Error(`duplicate guide ID: ${guide.id}`)
    seen.add(guide.id)
  }
  return entries
}

export async function resolveGuides(specdevPath, ids, { phase } = {}) {
  const requested = [...new Set((ids || []).filter(Boolean))]
  if (requested.length > MAX_GUIDES) throw new Error(`at most ${MAX_GUIDES} guides may be selected`)
  const catalog = await loadGuideCatalog(specdevPath)
  const byId = new Map(catalog.map((entry) => [entry.id, entry]))
  return requested.map((id) => {
    const guide = byId.get(id)
    if (!guide) throw new Error(`unknown guide: ${id}`)
    if (phase && !guide.phases.includes(phase)) {
      throw new Error(`guide ${id} does not apply to ${phase}`)
    }
    return guide
  })
}

function validateGuideEntry(specdevPath, catalog, entry) {
  if (!entry || typeof entry !== 'object') throw new Error(`invalid guide in ${catalog.path}`)
  for (const field of ['id', 'version', 'summary', 'path']) {
    if (!String(entry[field] || '').trim())
      throw new Error(`guide in ${catalog.path} is missing ${field}`)
  }
  if (!Array.isArray(entry.signals) || !Array.isArray(entry.phases)) {
    throw new Error(`guide ${entry.id} requires signals and phases arrays`)
  }
  const catalogDir = join(specdevPath, 'guides', catalog.owner)
  const absolutePath = isAbsolute(entry.path) ? entry.path : join(catalogDir, entry.path)
  const rel = relative(specdevPath, absolutePath)
  if (catalog.owner === 'library' && (rel.startsWith('..') || isAbsolute(rel))) {
    throw new Error(`library guide must stay under .specdev: ${entry.id}`)
  }
  const repoRelative = relative(dirname(specdevPath), absolutePath)
  if (repoRelative.startsWith('..') || isAbsolute(repoRelative)) {
    throw new Error(`project guide must stay inside the repository: ${entry.id}`)
  }
  if (!fse.existsSync(absolutePath)) throw new Error(`guide file not found: ${entry.path}`)
  return {
    id: entry.id,
    version: String(entry.version),
    summary: entry.summary,
    signals: entry.signals.map(String),
    phases: entry.phases.map(String),
    source: entry.source || null,
    license: entry.license || null,
    reviewed: entry.reviewed || null,
    path: absolutePath,
    owner: catalog.owner,
  }
}
