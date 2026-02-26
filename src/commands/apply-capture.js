import { join } from 'path'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { resolveTargetDir } from '../utils/command-context.js'
import { askChoice, askYesNo } from '../utils/prompt.js'

const FILE_OPTIONS = ['big_picture', 'feature_descriptions', 'both']

export async function applyCaptureCommand(flags = {}) {
  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')

  const diffPath = join(assignmentPath, 'capture', 'project-notes-diff.md')
  if (!(await fse.pathExists(diffPath))) {
    console.error('❌ No capture/project-notes-diff.md found')
    console.log('   Complete knowledge capture first, then run apply-capture')
    process.exitCode = 1
    return
  }

  const raw = await fse.readFile(diffPath, 'utf-8')
  const gaps = extractGapBullets(raw)
  if (gaps.length === 0) {
    console.error('❌ No "Gaps Found" bullet items detected in project-notes-diff.md')
    process.exitCode = 1
    return
  }

  let target = normalizeTarget(flags.file)
  if (!target) {
    if (process.stdin.isTTY && process.stdout.isTTY) {
      const idx = await askChoice('Which project notes file should receive accepted capture items?', [
        'big_picture.md',
        'feature_descriptions.md',
        'both files',
      ])
      target = FILE_OPTIONS[idx]
    } else {
      target = 'feature_descriptions'
    }
  }

  const applyAll = Boolean(flags.yes || flags.y)
  const selected = []
  for (const gap of gaps) {
    if (applyAll) {
      selected.push(gap)
      continue
    }
    if (process.stdin.isTTY && process.stdout.isTTY) {
      const keep = await askYesNo(`Apply this capture item?\n- ${gap}`)
      if (keep) selected.push(gap)
    } else {
      console.error('❌ Non-interactive mode requires --yes to apply capture items')
      process.exitCode = 1
      return
    }
  }

  if (selected.length === 0) {
    console.log('No capture items selected. Nothing applied.')
    return
  }

  const targets = resolveTargetFiles(specdevPath, target)
  const date = new Date().toISOString().slice(0, 10)
  let written = 0

  for (const filePath of targets) {
    const rel = filePath.replace(specdevPath + '/', '')
    await fse.ensureFile(filePath)
    const existing = (await fse.readFile(filePath, 'utf-8')).trimEnd()
    const existingBullets = new Set(extractBullets(existing))
    const newItems = selected.filter((item) => !existingBullets.has(normalizeBullet(item)))
    if (newItems.length === 0) {
      console.log(`No new capture items to apply for ${rel}`)
      continue
    }
    const lines = [
      `## Capture Updates — ${name} (${date})`,
      '',
      ...newItems.map((item) => `- ${item}`),
      '',
      `- Source: ${name}/capture/project-notes-diff.md`,
      '',
    ]
    const section = lines.join('\n')
    const content = existing ? `${existing}\n\n${section}` : `${section}\n`
    await fse.writeFile(filePath, content, 'utf-8')
    console.log(`Applied ${newItems.length} item(s) to ${rel}`)
    written++
  }

  if (written > 0) {
    console.log(`Applied capture updates from ${name}.`)
  }
}

function normalizeTarget(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (FILE_OPTIONS.includes(normalized)) return normalized
  if (normalized === 'big_picture.md') return 'big_picture'
  if (normalized === 'feature_descriptions.md') return 'feature_descriptions'
  return null
}

function resolveTargetFiles(specdevPath, target) {
  const projectNotes = join(specdevPath, 'project_notes')
  if (target === 'big_picture') {
    return [join(projectNotes, 'big_picture.md')]
  }
  if (target === 'feature_descriptions') {
    return [join(projectNotes, 'feature_descriptions.md')]
  }
  return [
    join(projectNotes, 'big_picture.md'),
    join(projectNotes, 'feature_descriptions.md'),
  ]
}

function extractGapBullets(content) {
  const section = content.match(/## Gaps Found\s*\n([\s\S]*?)(?=\n## |\n# |$)/i)
  if (!section) return []
  const bullets = []
  for (const line of section[1].split('\n')) {
    if (!/^\s*[-*]\s+/.test(line)) continue
    const trimmed = line.replace(/^\s*[-*]\s+/, '').trim()
    if (!trimmed) continue
    bullets.push(trimmed)
  }
  return bullets
}

function extractBullets(content) {
  const bullets = []
  for (const line of content.split(/\r?\n/)) {
    if (!/^\s*[-*]\s+/.test(line)) continue
    const trimmed = line.replace(/^\s*[-*]\s+/, '').trim()
    if (trimmed) bullets.push(normalizeBullet(trimmed))
  }
  return bullets
}

function normalizeBullet(text) {
  return text.trim().toLowerCase()
}
