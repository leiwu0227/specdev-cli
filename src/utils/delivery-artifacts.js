import { join } from 'node:path'
import fse from 'fs-extra'
import { resolveGuides } from './guides.js'

export async function validateDeliveryArtifacts(specdevPath, assignmentPath, acceptanceIds) {
  const planPath = join(assignmentPath, 'design', 'plan.md')
  const progressPath = join(assignmentPath, 'implementation', 'progress.json')
  const outcomePath = join(assignmentPath, 'outcome.md')
  for (const path of [planPath, progressPath, outcomePath]) {
    if (!(await fse.pathExists(path))) throw new Error(`Worker did not create ${path}`)
  }

  const plan = await fse.readFile(planPath, 'utf-8')
  if (!/\bT-\d+\b/.test(plan)) {
    throw new Error('design/plan.md requires Task IDs such as T-1')
  }
  for (const id of acceptanceIds) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (!new RegExp(`\\b${escaped}\\b`).test(plan)) {
      throw new Error(`design/plan.md does not cover ${id}`)
    }
  }
  const knownAcceptanceIds = new Set(acceptanceIds.map((id) => id.toUpperCase()))
  const referencedAcceptanceIds = new Set(
    [...plan.matchAll(/\bAC-\d+\b/gi)].map((match) => match[0].toUpperCase())
  )
  for (const id of referencedAcceptanceIds) {
    if (!knownAcceptanceIds.has(id)) {
      throw new Error(`design/plan.md references unknown acceptance criterion ${id}`)
    }
  }

  const progress = await fse.readJson(progressPath)
  if (!Array.isArray(progress.tasks) || progress.tasks.length === 0) {
    throw new Error('implementation/progress.json requires a non-empty tasks array')
  }
  if (progress.tasks.some((task) => task.status !== 'completed')) {
    throw new Error('implementation/progress.json still has incomplete Tasks')
  }
  const selected = progress.selected_guides
  if (!selected || !Array.isArray(selected.implementation) || !Array.isArray(selected.review)) {
    throw new Error(
      'implementation/progress.json requires selected_guides.implementation and selected_guides.review arrays'
    )
  }
  const implementationGuides = await resolveGuides(specdevPath, selected.implementation, {
    phase: 'implementation',
  })
  const reviewGuides = await resolveGuides(specdevPath, selected.review, {
    phase: 'implementation',
  })
  assertPlanGuideSelection(plan, 'Implementation', implementationGuides)
  assertPlanGuideSelection(plan, 'Review', reviewGuides)
  progress.selected_guide_versions = {
    implementation: implementationGuides.map(({ id, version }) => ({ id, version })),
    review: reviewGuides.map(({ id, version }) => ({ id, version })),
  }
  if (!Array.isArray(progress.verification)) {
    throw new Error(
      'implementation/progress.json requires a verification receipts array (which may be empty when authorized evidence is not needed)'
    )
  }
  if (!Array.isArray(progress.deviations)) {
    throw new Error(
      'implementation/progress.json requires a deviations array (use [] when there are none)'
    )
  }
  if (!['none', 'required'].includes(progress.follow_up)) {
    throw new Error('implementation/progress.json requires follow_up: none or required')
  }
  for (const receipt of progress.verification) {
    for (const field of ['command', 'revision', 'scope', 'status', 'duration_ms']) {
      if (receipt[field] === undefined || receipt[field] === null || receipt[field] === '') {
        throw new Error(`verification receipt is missing ${field}`)
      }
    }
    if (!['passed', 'failed', 'skipped'].includes(receipt.status)) {
      throw new Error(`invalid verification receipt status: ${receipt.status}`)
    }
  }
  await writeJsonAtomic(progressPath, progress)

  const outcome = await fse.readFile(outcomePath, 'utf-8')
  for (const id of acceptanceIds) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (
      !new RegExp(
        `^\\|\\s*${escaped}\\s*\\|.*\\|\\s*(Passed|Failed|Blocked)[.!]?\\s*\\|\\s*$`,
        'mi'
      ).test(outcome)
    ) {
      throw new Error(`outcome.md has no final Passed, Failed, or Blocked table result for ${id}`)
    }
  }
  return {
    planPath,
    progressPath,
    outcomePath,
    outcome,
    progress,
    implementationGuides,
    reviewGuides,
  }
}

export function assertReviewWaiverEvidence(delivery, acceptanceIds) {
  if (delivery.progress.follow_up !== 'none') {
    throw new Error('Implementation review cannot be waived when follow_up is required')
  }
  if (delivery.progress.deviations.length > 0) {
    throw new Error('Implementation review cannot be waived when delivery reports deviations')
  }
  if (delivery.progress.verification.some((receipt) => receipt.status !== 'passed')) {
    throw new Error(
      'Implementation review cannot be waived unless every verification receipt passed'
    )
  }
  const outcome = delivery.outcome || ''
  for (const id of acceptanceIds) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (
      !new RegExp(`^\\|\\s*${escaped}\\s*\\|.*\\|\\s*Passed[.!]?\\s*\\|\\s*$`, 'mi').test(outcome)
    ) {
      throw new Error(`Implementation review cannot be waived because ${id} is not Passed`)
    }
  }
}

function assertPlanGuideSelection(plan, label, guides) {
  const line =
    plan.match(new RegExp(`^(?:\\*\\*)?${label} Guides:(?:\\*\\*)?\\s*(.+)$`, 'mi'))?.[1] || ''
  if (!line) throw new Error(`design/plan.md requires a **${label} Guides:** selection`)
  for (const guide of guides) {
    const escaped = guide.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (!new RegExp(`(^|[^A-Za-z0-9_-])${escaped}([^A-Za-z0-9_-]|$)`, 'i').test(line)) {
      throw new Error(`design/plan.md ${label} Guides does not record selected guide ${guide.id}`)
    }
  }
}

async function writeJsonAtomic(path, value) {
  const temporary = `${path}.tmp-${process.pid}`
  await fse.writeJson(temporary, value, { spaces: 2 })
  await fse.move(temporary, path, { overwrite: true })
}
