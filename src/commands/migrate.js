import { join } from 'path'
import fse from 'fs-extra'
import {
  resolveTargetDir,
  requireSpecdevDirectory,
} from '../utils/command-context.js'
import { blankLine, printBullets, printSection } from '../utils/output.js'

const LEGACY_TO_V4 = [
  { from: 'proposal.md', to: 'brainstorm/proposal.md' },
  { from: 'design.md', to: 'brainstorm/design.md' },
  { from: 'plan.md', to: 'breakdown/plan.md' },
  { from: 'implementation.md', to: 'implementation/implementation.md' },
  { from: 'validation_checklist.md', to: 'review/validation_checklist.md' },
]

export async function migrateCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const dryRun = Boolean(flags['dry-run'])
  const assignmentFilter =
    typeof flags.assignment === 'string' ? flags.assignment : null

  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  const assignmentsRoot = join(specdevPath, 'assignments')
  if (!(await fse.pathExists(assignmentsRoot))) {
    console.error('❌ No assignments directory found')
    process.exitCode = 1
    return
  }

  const allEntries = await fse.readdir(assignmentsRoot, { withFileTypes: true })
  const allAssignments = allEntries.filter((entry) => entry.isDirectory())

  const assignments = assignmentFilter
    ? allAssignments.filter((entry) => entry.name === assignmentFilter)
    : allAssignments

  if (assignmentFilter && assignments.length === 0) {
    console.error(`❌ Assignment not found: ${assignmentFilter}`)
    process.exitCode = 1
    return
  }

  if (assignments.length === 0) {
    console.log('No assignments found to migrate.')
    return
  }

  console.log(
    `🔄 Migrating ${assignments.length} assignment(s) to V4 structure${dryRun ? ' (dry run)' : ''}`
  )

  let movedCount = 0
  let skippedCount = 0
  let createdCount = 0
  let unchangedCount = 0

  for (const assignment of assignments) {
    const assignmentPath = join(assignmentsRoot, assignment.name)
    const changes = await migrateAssignment(assignmentPath, { dryRun })

    movedCount += changes.moved
    skippedCount += changes.skipped
    createdCount += changes.created
    unchangedCount += changes.unchanged ? 1 : 0

    blankLine()
    printSection(`Assignment: ${assignment.name}`)
    if (changes.lines.length === 0) {
      console.log('  · no changes')
    } else {
      printBullets(changes.lines, '  - ')
    }
  }

  blankLine()
  printSection('Summary:')
  printBullets(
    [
      `assignments scanned: ${assignments.length}`,
      `assignments unchanged: ${unchangedCount}`,
      `files moved: ${movedCount}`,
      `paths created: ${createdCount}`,
      `moves skipped (destination exists): ${skippedCount}`,
    ],
    '  - '
  )

  if (dryRun) {
    blankLine()
    console.log('Dry run only. Re-run without --dry-run to apply changes.')
  }
}

async function migrateAssignment(assignmentPath, { dryRun }) {
  const lines = []
  let moved = 0
  let skipped = 0
  let created = 0

  for (const rule of LEGACY_TO_V4) {
    const from = join(assignmentPath, rule.from)
    const to = join(assignmentPath, rule.to)

    if (!(await fse.pathExists(from))) {
      continue
    }

    if (await fse.pathExists(to)) {
      lines.push(`skip: ${rule.from} -> ${rule.to} (destination exists)`)
      skipped++
      continue
    }

    const toDir = join(assignmentPath, rule.to.split('/').slice(0, -1).join('/'))
    if (toDir && !(await fse.pathExists(toDir))) {
      if (!dryRun) {
        await fse.ensureDir(toDir)
      }
      lines.push(`create: ${rule.to.split('/').slice(0, -1).join('/')}/`)
      created++
    }

    if (!dryRun) {
      await fse.move(from, to)
    }
    lines.push(`move: ${rule.from} -> ${rule.to}`)
    moved++
  }

  const contextPath = join(assignmentPath, 'context')
  if (!(await fse.pathExists(contextPath))) {
    if (!dryRun) {
      await fse.ensureDir(contextPath)
    }
    lines.push('create: context/')
    created++
  }

  const implementationDir = join(assignmentPath, 'implementation')
  const progressPath = join(implementationDir, 'progress.json')
  if (
    (await fse.pathExists(implementationDir)) &&
    !(await fse.pathExists(progressPath))
  ) {
    if (!dryRun) {
      await fse.writeFile(progressPath, '{}\n', 'utf-8')
    }
    lines.push('create: implementation/progress.json')
    created++
  }

  return {
    lines,
    moved,
    skipped,
    created,
    unchanged: lines.length === 0,
  }
}
