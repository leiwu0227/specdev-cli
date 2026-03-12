import { join } from 'path'
import { spawn } from 'child_process'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { resolveDiscussionSelector } from '../utils/discussion.js'
import { resolveTargetDir } from '../utils/command-context.js'
import { writeCurrent } from '../utils/current.js'
import { blankLine, printSection } from '../utils/output.js'
import {
  parseReviewFeedback,
  getLatestRound,
  hasUnaddressedFindings,
} from '../utils/review-feedback.js'
import { approvePhase } from '../utils/approve-phase.js'

/**
 * specdev reviewloop <phase> — Automated external review loop
 *
 * Spawns an external reviewer process, reads its verdict from
 * {phase}-feedback.md, and auto-approves on pass.
 */
export async function reviewloopCommand(positionalArgs = [], flags = {}) {
  const VALID_PHASES = ['brainstorm', 'implementation', 'discussion']
  const phase = positionalArgs[0]

  if (!phase) {
    console.error('Missing required phase argument')
    console.log(`   Usage: specdev reviewloop <${VALID_PHASES.join(' | ')}>`)
    process.exitCode = 1
    return
  }

  if (!VALID_PHASES.includes(phase)) {
    console.error(`Unknown reviewloop phase: ${phase}`)
    console.log(`   Valid phases: ${VALID_PHASES.join(', ')}`)
    process.exitCode = 1
    return
  }

  const targetDir = resolveTargetDir(flags)

  if (phase === 'discussion') {
    if (!flags.discussion) {
      console.error('--discussion flag is required. Use specdev discussion --list to see available discussions.')
      process.exitCode = 1
      return
    }
    const specdevPath = join(targetDir, '.specdev')
    const resolved = await resolveDiscussionSelector(specdevPath, flags.discussion)
    if (!resolved || resolved.error) {
      const msg = resolved?.error === 'malformed'
        ? `Invalid discussion ID "${flags.discussion}". Expected format: D0001`
        : `Discussion ${flags.discussion} not found.`
      console.error(msg)
      process.exitCode = 1
      return
    }

    // Run the review loop using discussion path instead of assignment path
    // Reuse the existing reviewloop logic but with discussion path
    const discussionName = resolved.name
    const discussionPath = resolved.path

    if (!flags.reviewer) {
      console.log(`Reviewloop: ${discussionName}`)
      console.log(`   Phase: discussion`)
      blankLine()
      const reviewersDir = join(targetDir, '.specdev', 'skills', 'core', 'reviewloop', 'reviewers')
      const reviewers = []
      if (await fse.pathExists(reviewersDir)) {
        const files = await fse.readdir(reviewersDir)
        for (const f of files) {
          if (f.endsWith('.json')) reviewers.push(f.replace('.json', ''))
        }
      }
      if (reviewers.length === 0) {
        console.error('No reviewer configs found')
        process.exitCode = 1
        return
      }
      printSection('Available reviewers:')
      for (const r of reviewers) {
        console.log(`   - ${r}`)
      }
      blankLine()
      console.log('Ask the user which reviewer to use, then run:')
      console.log(`   specdev reviewloop discussion --discussion=${flags.discussion} --reviewer=<name>`)
      return
    }

    // With --reviewer: run the review loop for discussion
    const reviewerName = flags.reviewer
    const reviewerConfigPath = join(targetDir, '.specdev', 'skills', 'core', 'reviewloop', 'reviewers', `${reviewerName}.json`)
    if (!(await fse.pathExists(reviewerConfigPath))) {
      console.error(`Reviewer config not found: ${reviewerName}`)
      process.exitCode = 1
      return
    }
    let config
    try { config = await fse.readJson(reviewerConfigPath) } catch {
      console.error(`Invalid reviewer config: ${reviewerConfigPath}`)
      process.exitCode = 1
      return
    }
    if (!config.command) {
      console.error("Reviewer config missing required field 'command'")
      process.exitCode = 1
      return
    }

    const maxRounds = config.max_rounds || 3
    const reviewDir = join(discussionPath, 'review')
    await fse.ensureDir(reviewDir)
    const feedbackPath = join(reviewDir, 'brainstorm-feedback.md')
    const changelogPath = join(reviewDir, 'brainstorm-changelog.md')
    const feedbackContent = (await fse.pathExists(feedbackPath)) ? await fse.readFile(feedbackPath, 'utf-8') : ''
    const changelogContent = (await fse.pathExists(changelogPath)) ? await fse.readFile(changelogPath, 'utf-8') : ''

    if (hasUnaddressedFindings(feedbackContent, changelogContent)) {
      console.error('Previous review findings have not been addressed. Run specdev check-review.')
      process.exitCode = 1
      return
    }

    const { rounds } = parseReviewFeedback(feedbackContent)
    const round = rounds.length + 1
    if (round > maxRounds) {
      console.error('Max rounds reached. Escalating to user.')
      process.exitCode = 1
      return
    }

    console.log(`Reviewloop: ${discussionName}`)
    console.log(`   Phase: discussion`)
    console.log(`   Reviewer: ${reviewerName}`)
    console.log(`   Round: ${round}/${maxRounds}`)
    blankLine()

    // Set SPECDEV env vars for discussion reviewloop
    const discussionId = discussionName.match(/^(D\d{4})/)?.[1] || discussionName
    const childEnv = {
      ...process.env,
      SPECDEV_PHASE: 'discussion',
      SPECDEV_ASSIGNMENT: discussionName,
      SPECDEV_DISCUSSION: discussionId,
      SPECDEV_ROUND: String(round),
    }

    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn('bash', ['-c', config.command], {
        cwd: targetDir,
        env: childEnv,
        stdio: 'inherit',
      })
      child.on('error', reject)
      child.on('close', (code) => resolve(code))
    })

    if (exitCode !== 0) {
      console.error(`Reviewer exited with code ${exitCode}`)
      process.exitCode = 1
      return
    }

    const updatedFeedback = (await fse.pathExists(feedbackPath)) ? await fse.readFile(feedbackPath, 'utf-8') : ''
    const latestRound = getLatestRound(updatedFeedback)

    if (!latestRound || latestRound.round !== round) {
      console.error(`Expected round ${round} in brainstorm-feedback.md but found ${latestRound ? `round ${latestRound.round}` : 'no rounds'}`)
      process.exitCode = 1
      return
    }

    blankLine()
    if (latestRound.verdict === 'approved') {
      printSection('Discussion review approved!')
    } else if (latestRound.verdict === 'needs-changes') {
      if (round >= maxRounds) {
        console.error('Max rounds reached. Escalating to user.')
      } else {
        printSection('Run specdev check-review to address findings')
      }
    } else {
      printSection(`Unexpected verdict: ${latestRound.verdict}`)
    }
    return
  }

  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)

  // ── Without --reviewer: list available reviewers and exit ──

  if (!flags.reviewer) {
    console.log(`Reviewloop: ${name}`)
    console.log(`   Phase: ${phase}`)
    blankLine()

    const reviewersDir = join(
      targetDir,
      '.specdev',
      'skills',
      'core',
      'reviewloop',
      'reviewers',
    )
    const reviewers = []
    if (await fse.pathExists(reviewersDir)) {
      const files = await fse.readdir(reviewersDir)
      for (const f of files) {
        if (f.endsWith('.json')) reviewers.push(f.replace('.json', ''))
      }
    }

    if (reviewers.length === 0) {
      console.error('No reviewer configs found')
      console.log(
        '   Add reviewer JSON configs to .specdev/skills/core/reviewloop/reviewers/',
      )
      process.exitCode = 1
      return
    }

    printSection('Available reviewers:')
    for (const r of reviewers) {
      console.log(`   - ${r}`)
    }
    blankLine()
    console.log('Ask the user which reviewer to use, then run:')
    console.log(`   specdev reviewloop ${phase} --reviewer=<name>`)
    return
  }

  // ── With --reviewer: run the review loop ──

  const reviewerName = flags.reviewer
  const reviewerConfigPath = join(
    targetDir,
    '.specdev',
    'skills',
    'core',
    'reviewloop',
    'reviewers',
    `${reviewerName}.json`,
  )

  if (!(await fse.pathExists(reviewerConfigPath))) {
    console.error(`Reviewer config not found: ${reviewerName}`)
    console.log(`   Expected: ${reviewerConfigPath}`)
    process.exitCode = 1
    return
  }

  let config
  try {
    config = await fse.readJson(reviewerConfigPath)
  } catch {
    console.error(`Invalid reviewer config: ${reviewerConfigPath}`)
    process.exitCode = 1
    return
  }

  if (!config.command) {
    console.error(`Reviewer config missing required field 'command'`)
    process.exitCode = 1
    return
  }

  const maxRounds = config.max_rounds || 3

  // Read review artifacts
  const reviewDir = join(assignmentPath, 'review')
  await fse.ensureDir(reviewDir)

  const feedbackPath = join(reviewDir, `${phase}-feedback.md`)
  const changelogPath = join(reviewDir, `${phase}-changelog.md`)

  const feedbackContent = (await fse.pathExists(feedbackPath))
    ? await fse.readFile(feedbackPath, 'utf-8')
    : ''
  const changelogContent = (await fse.pathExists(changelogPath))
    ? await fse.readFile(changelogPath, 'utf-8')
    : ''

  // Stale feedback guard
  if (hasUnaddressedFindings(feedbackContent, changelogContent)) {
    console.error(
      'Previous review findings have not been addressed. Run specdev check-review.',
    )
    process.exitCode = 1
    return
  }

  // Derive round number
  const { rounds } = parseReviewFeedback(feedbackContent)
  const round = rounds.length + 1

  if (round > maxRounds) {
    console.error('Max rounds reached. Escalating to user.')
    process.exitCode = 1
    return
  }

  console.log(`Reviewloop: ${name}`)
  console.log(`   Phase: ${phase}`)
  console.log(`   Reviewer: ${reviewerName}`)
  console.log(`   Round: ${round}/${maxRounds}`)
  blankLine()

  // Ensure .current is set so the reviewer subprocess can read it
  const specdevPath = join(targetDir, '.specdev')
  await writeCurrent(specdevPath, name)

  // Build environment for the reviewer process
  const childEnv = {
    ...process.env,
    SPECDEV_PHASE: phase,
    SPECDEV_ASSIGNMENT: name,
    SPECDEV_ROUND: String(round),
  }

  // Spawn the reviewer command
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn('bash', ['-c', config.command], {
      cwd: targetDir,
      env: childEnv,
      stdio: 'inherit',
    })
    child.on('error', reject)
    child.on('close', (code) => resolve(code))
  })

  if (exitCode !== 0) {
    console.error(`Reviewer exited with code ${exitCode}`)
    process.exitCode = 1
    return
  }

  // Re-read feedback after reviewer ran
  const updatedFeedback = (await fse.pathExists(feedbackPath))
    ? await fse.readFile(feedbackPath, 'utf-8')
    : ''

  const latestRound = getLatestRound(updatedFeedback)

  if (!latestRound || latestRound.round !== round) {
    console.error(
      `Expected round ${round} in ${phase}-feedback.md but found ${latestRound ? `round ${latestRound.round}` : 'no rounds'}`,
    )
    process.exitCode = 1
    return
  }

  blankLine()

  if (latestRound.verdict === 'approved') {
    const result = await approvePhase(assignmentPath, phase)
    if (result.approved) {
      printSection(`Review approved! Phase '${phase}' has been approved.`)
    } else {
      printSection('Review approved, but phase approval had errors:')
      for (const err of result.errors) {
        console.log(`   - ${err}`)
      }
    }
  } else if (latestRound.verdict === 'needs-changes') {
    if (round >= maxRounds) {
      console.error('Max rounds reached. Escalating to user.')
    } else {
      printSection('Run specdev check-review to address findings')
    }
  } else {
    printSection(`Unexpected verdict: ${latestRound.verdict}`)
    console.log('   Run specdev check-review to inspect results')
  }
}
