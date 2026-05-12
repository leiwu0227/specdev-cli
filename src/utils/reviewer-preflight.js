import { spawnSync } from 'child_process'
import { join } from 'path'
import fse from 'fs-extra'
import { listReviewers } from './reviewers.js'

export const DEFAULT_REVIEWER_TIMEOUT_SECONDS = 900
export const VALID_REVIEWER_NAME_PATTERN = /^[A-Za-z0-9._-]+$/

export function reviewerTimeoutSeconds(config = {}) {
  const override = Number(process.env.SPECDEV_REVIEWER_TIMEOUT)
  if (Number.isInteger(override) && override > 0) {
    return override
  }

  const value = Number(config.timeout_seconds)
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_REVIEWER_TIMEOUT_SECONDS
  }
  return value
}

export async function resolveReviewerNames(specdevPath, rawList) {
  const names = rawList.map((name) => name.trim())
  for (const name of names) {
    if (!VALID_REVIEWER_NAME_PATTERN.test(name)) {
      throw new Error(
        `Invalid reviewer name: "${name}" (allowed: A-Z, a-z, 0-9, dot, underscore, hyphen)`,
      )
    }
  }

  const available = await listReviewers(specdevPath)
  const availableSet = new Set(available)
  for (const name of names) {
    if (!availableSet.has(name)) {
      const suffix = available.length > 0
        ? `\nAvailable reviewers: ${available.join(', ')}`
        : '\nAvailable reviewers: none'
      throw new Error(`Reviewer config not found: ${name}${suffix}`)
    }
  }

  return names
}

export async function preflightReviewers({ specdevPath, assignmentPath, reviewerNames }) {
  const reviewers = []
  for (const reviewerName of reviewerNames) {
    reviewers.push(await preflightReviewer({ specdevPath, assignmentPath, reviewerName }))
  }

  return {
    version: 1,
    status: reviewers.some((r) => r.blocking) ? 'fail' : 'pass',
    reviewers,
  }
}

async function preflightReviewer({ specdevPath, assignmentPath, reviewerName }) {
  const issues = []
  const reviewerConfigPath = join(
    specdevPath,
    'skills',
    'core',
    'reviewloop',
    'reviewers',
    `${reviewerName}.json`
  )

  let config = null
  let configStatus = 'pass'
  if (!(await fse.pathExists(reviewerConfigPath))) {
    configStatus = 'fail'
    issues.push({
      code: 'missing_config',
      severity: 'error',
      detail: `Reviewer config not found: ${reviewerName}`,
    })
  } else {
    try {
      config = await fse.readJson(reviewerConfigPath)
    } catch {
      configStatus = 'fail'
      issues.push({
        code: 'invalid_config',
        severity: 'error',
        detail: `Invalid reviewer config: ${reviewerConfigPath}`,
      })
    }
  }

  const commandText = config?.command || ''
  const binaryName = commandText.trim().split(/\s+/)[0] || ''
  const commandStatus = commandText ? 'pass' : 'fail'
  if (!commandText) {
    issues.push({
      code: 'missing_command',
      severity: 'error',
      detail: "Reviewer config missing required field 'command'",
    })
  }

  const which = binaryName ? spawnSync('which', [binaryName], { encoding: 'utf-8' }) : null
  const binary = { name: binaryName, found: Boolean(which && which.status === 0) }
  if (binaryName && !binary.found) {
    issues.push({
      code: 'missing_binary',
      severity: 'warning',
      detail: `${binaryName} not found on PATH`,
    })
  }

  const reviewDir = join(assignmentPath, 'review')
  let reviewDirStatus = 'pass'
  try {
    await fse.ensureDir(reviewDir)
    await fse.access(reviewDir, fse.constants.W_OK)
  } catch {
    reviewDirStatus = 'fail'
    issues.push({
      code: 'review_dir_unwritable',
      severity: 'error',
      detail: `Review directory is not writable: ${reviewDir}`,
    })
  }

  const blocking = issues.some((issue) => issue.severity === 'error')
  return {
    name: reviewerName,
    config: { status: configStatus, path: reviewerConfigPath },
    command: { status: commandStatus, value: commandText },
    binary,
    timeout_seconds: reviewerTimeoutSeconds(config || {}),
    review_dir: { status: reviewDirStatus, path: reviewDir },
    blocking,
    issues,
  }
}
