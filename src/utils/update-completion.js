import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const UPDATE_COMPLETION_GRAPH = 'update-completion'

const REQUIRED_ORIENTATION = '.specdev/_main.md'
const OBSOLETE_REFERENCES = [
  '.specdev/_router.md',
  '.specdev/project_notes/assignment_progress.md',
  '.specdev/project_notes/discussion_progress.md',
]
const STALE_SIGNATURES = [
  { id: 'legacy-specdev-version', pattern: /\bVersion:\s*0\.0\.[0-3]\b/i },
  { id: 'legacy-five-gate-workflow', pattern: /\bfive[- ]gate\b/i },
]

export function nextUpdateOperationId(calls) {
  const largest = calls.reduce((max, call) => {
    const match = /^UPD(\d{5})$/.exec(call.id)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `UPD${String(largest + 1).padStart(5, '0')}`
}

export function inspectUpdateAdapters(targetDir, adapters, created = []) {
  const createdPaths = new Set(created)
  return adapters.map((adapter) => {
    const absolutePath = join(targetDir, adapter.path)
    if (!existsSync(absolutePath)) {
      return {
        path: adapter.path,
        status: 'missing',
        orientation_present: false,
        obsolete_references: [],
        stale_signatures: [],
        before_sha256: null,
        protected_regions: [],
      }
    }

    const content = readFileSync(absolutePath, 'utf8')
    const sections = markdownSections(content)
    const obsolete = OBSOLETE_REFERENCES.filter((reference) => content.includes(reference))
    const staleSignatures = findStaleSignatures(content)
    const orientationPresent = content.includes(REQUIRED_ORIENTATION)
    const staleSections = sections.filter(
      (section) =>
        obsolete.some((reference) => section.content.includes(reference)) ||
        findStaleSignatures(section.content).length > 0
    )
    const ambiguous = staleSections.some(
      (section) => !isSpecdevSection(section) && !isGeneratedLegacyAdapter(sections)
    )
    const editableKeys = new Set(
      sections.filter((section) => isSpecdevSection(section)).map((section) => section.key)
    )
    if (isGeneratedLegacyAdapter(sections)) {
      for (const section of staleSections) editableKeys.add(section.key)
    }
    const protectedRegions = sections
      .filter((section) => !editableKeys.has(section.key))
      .map((section) => ({ key: section.key, sha256: digest(section.content) }))

    let status = 'current'
    if (createdPaths.has(adapter.path)) status = 'backfilled'
    else if (ambiguous) status = 'ambiguous'
    else if (obsolete.length > 0 || staleSignatures.length > 0) status = 'needs_reconciliation'
    else if (!orientationPresent) status = 'needs_orientation'

    return {
      path: adapter.path,
      status,
      orientation_present: orientationPresent,
      obsolete_references: obsolete,
      stale_signatures: staleSignatures,
      before_sha256: digest(content),
      protected_regions: protectedRegions,
    }
  })
}

export function adaptersNeedAction(adapters) {
  return adapters.some((adapter) =>
    ['needs_reconciliation', 'needs_orientation', 'ambiguous'].includes(adapter.status)
  )
}

export function validateUpdateAdapters(targetDir, baseline) {
  const issues = []
  const evidence = []

  for (const adapter of baseline) {
    const absolutePath = join(targetDir, adapter.path)
    if (!existsSync(absolutePath)) {
      issues.push(`${adapter.path}: adapter is missing`)
      continue
    }
    if (adapter.status === 'ambiguous') {
      issues.push(
        `${adapter.path}: stale SpecDev text is outside an identifiable SpecDev section; ` +
          'obtain user direction before rewriting project-owned instructions'
      )
      continue
    }

    const content = readFileSync(absolutePath, 'utf8')
    const currentSections = new Map(
      markdownSections(content).map((section) => [section.key, digest(section.content)])
    )
    const changedProtected = adapter.protected_regions.filter(
      (region) => currentSections.get(region.key) !== region.sha256
    )
    const obsolete = OBSOLETE_REFERENCES.filter((reference) => content.includes(reference))
    const staleSignatures = findStaleSignatures(content)
    const orientationPresent = content.includes(REQUIRED_ORIENTATION)
    if (changedProtected.length > 0) {
      issues.push(`${adapter.path}: project-owned sections changed (${changedProtected.length})`)
    }
    if (obsolete.length > 0) {
      issues.push(`${adapter.path}: obsolete references remain (${obsolete.join(', ')})`)
    }
    if (staleSignatures.length > 0) {
      issues.push(
        `${adapter.path}: stale SpecDev signatures remain (${staleSignatures.join(', ')})`
      )
    }
    if (!orientationPresent) {
      issues.push(`${adapter.path}: required orientation ${REQUIRED_ORIENTATION} is missing`)
    }
    evidence.push({
      path: adapter.path,
      before_sha256: adapter.before_sha256,
      after_sha256: digest(content),
      protected_regions_verified: adapter.protected_regions.length - changedProtected.length,
      obsolete_references_removed: obsolete.length === 0,
      stale_signatures_removed: staleSignatures.length === 0,
      orientation_present: orientationPresent,
    })
  }

  return { valid: issues.length === 0, issues, evidence }
}

export function publicAdapterStatus(adapters) {
  return adapters.map(({ protected_regions: _protected, ...adapter }) => adapter)
}

function markdownSections(content) {
  const lines = content.match(/.*(?:\n|$)/g)?.filter(Boolean) || []
  const sections = []
  let current = { heading: null, occurrence: 0, content: '' }
  const occurrences = new Map()
  let fence = null

  const push = () => {
    if (!current.content) return
    const label = current.heading ? normalizeHeading(current.heading) : '$root'
    current.key = `${label}#${current.occurrence}`
    sections.push(current)
  }

  for (const line of lines) {
    const fenceMatch = /^\s*(```+|~~~+)/.exec(line)
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0]
      else if (fence === fenceMatch[1][0]) fence = null
    }
    const headingMatch = fence ? null : /^ {0,3}#{1,6}\s+(.+?)\s*#*\s*(?:\n|$)/.exec(line)
    if (headingMatch) {
      push()
      const heading = headingMatch[1]
      const label = normalizeHeading(heading)
      const occurrence = occurrences.get(label) || 0
      occurrences.set(label, occurrence + 1)
      current = { heading, occurrence, content: line }
    } else {
      current.content += line
    }
  }
  push()
  return sections.length > 0
    ? sections
    : [{ heading: null, occurrence: 0, key: '$root#0', content }]
}

function isSpecdevSection(section) {
  return /\bspecdev\b/i.test(section.heading || '')
}

function isGeneratedLegacyAdapter(sections) {
  const knownAdapterHeading = /^(?:agents\.md|claude\.md|cursor rules)$/i
  if (
    sections.some(
      (section) =>
        section.heading &&
        !isSpecdevSection(section) &&
        !knownAdapterHeading.test(normalizeHeading(section.heading))
    )
  ) {
    return false
  }
  const body = sections.map((section) => section.content).join('')
  if (!/\bSpecDev\b/i.test(body)) return false
  const nonSpecdevLines = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .filter(
      (line) =>
        !/specdev|assignment|brainstorm|breakdown|implementation|review|gate|workflow/i.test(line)
    )
  return nonSpecdevLines.length === 0
}

function findStaleSignatures(content) {
  return STALE_SIGNATURES.filter(({ pattern }) => pattern.test(content)).map(({ id }) => id)
}

function normalizeHeading(value) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex')
}
