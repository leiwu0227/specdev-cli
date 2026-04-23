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
import { resolveRoundFocus } from '../utils/review-focus.js'

function printDesignDigressionPrompt(name) {
  blankLine()
  printSection('Design digression check:')
  console.log(`   Read ${name}/review/brainstorm-changelog*.md and ${name}/brainstorm/design.md.`)
  console.log('   Summarize only important digressions from the original design to the user.')
  console.log('   Skip minor fixes, wording changes, and trivial adjustments.')
  blankLine()
}

function printSimplificationPrompt() {
  blankLine()
  printSection('Post-review simplification:')
  console.log('   Review all changes made during the review rounds.')
  console.log('   Consolidate patch-stacked fixes into clean solutions.')
  console.log('   Remove any unnecessary complexity added to satisfy review findings.')
  console.log('   The goal: code should be simpler after review, not more complex.')
  blankLine()
}

/**
 * Run a single reviewer for a given phase.
 * @returns {Promise<{approved: boolean, error: boolean, message: string}>}
 */
async function runSingleReviewer({
  targetDir, assignmentPath, name, phase, reviewerName,
  feedbackFilename, changelogFilename, extraEnv,
}) {
  const specdevPath = join(targetDir, '.specdev')
  const reviewerConfigPath = join(specdevPath, 'skills', 'core', 'reviewloop', 'reviewers', `${reviewerName}.json`)

  if (!(await fse.pathExists(reviewerConfigPath))) {
    console.error(`Reviewer config not found: ${reviewerName}`)
    console.log(`   Expected: ${reviewerConfigPath}`)
    return { approved: false, error: true, message: 'config not found' }
  }

  let config
  try {
    config = await fse.readJson(reviewerConfigPath)
  } catch {
    console.error(`Invalid reviewer config: ${reviewerConfigPath}`)
    return { approved: false, error: true, message: 'invalid config' }
  }

  if (!config.command) {
    console.error(`Reviewer config missing required field 'command'`)
    return { approved: false, error: true, message: 'missing command' }
  }

  const maxRounds = config.max_rounds || 3

  const reviewDir = join(assignmentPath, 'review')
  await fse.ensureDir(reviewDir)

  const feedbackPath = join(reviewDir, feedbackFilename)
  const changelogPath = join(reviewDir, changelogFilename)

  const feedbackContent = (await fse.pathExists(feedbackPath))
    ? await fse.readFile(feedbackPath, 'utf-8')
    : ''
  const changelogContent = (await fse.pathExists(changelogPath))
    ? await fse.readFile(changelogPath, 'utf-8')
    : ''

  if (hasUnaddressedFindings(feedbackContent, changelogContent)) {
    console.error('Previous review findings have not been addressed. Run specdev check-review.')
    return { approved: false, error: true, message: 'unaddressed findings' }
  }

  const { rounds } = parseReviewFeedback(feedbackContent)
  const round = rounds.length + 1

  if (round > maxRounds) {
    console.error('Max rounds reached. Escalating to user.')
    return { approved: false, error: true, message: 'max rounds' }
  }

  console.log(`Reviewloop: ${name}`)
  console.log(`   Phase: ${phase}`)
  console.log(`   Reviewer: ${reviewerName}`)
  console.log(`   Round: ${round}/${maxRounds}`)
  blankLine()

  await writeCurrent(specdevPath, name)

  const focusText = await resolveRoundFocus(specdevPath, round)

  const childEnv = {
    ...process.env,
    SPECDEV_PHASE: phase,
    SPECDEV_ASSIGNMENT: name,
    SPECDEV_ROUND: String(round),
    SPECDEV_FOCUS: focusText,
    ...extraEnv,
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
    return { approved: false, error: true, message: 'reviewer failed' }
  }

  const updatedFeedback = (await fse.pathExists(feedbackPath))
    ? await fse.readFile(feedbackPath, 'utf-8')
    : ''

  const latestRound = getLatestRound(updatedFeedback)

  if (!latestRound || latestRound.round !== round) {
    console.error(
      `Expected round ${round} in ${feedbackFilename} but found ${latestRound ? `round ${latestRound.round}` : 'no rounds'}`,
    )
    return { approved: false, error: true, message: 'wrong round' }
  }

  blankLine()

  if (latestRound.verdict === 'approved') {
    return { approved: true, error: false, message: 'approved' }
  } else if (latestRound.verdict === 'needs-changes') {
    if (round >= maxRounds) {
      console.error('Max rounds reached. Escalating to user.')
    } else {
      printSection('Run specdev check-review to address findings')
    }
    return { approved: false, error: false, message: 'needs-changes' }
  } else {
    printSection(`Unexpected verdict: ${latestRound.verdict}`)
    console.log('   Run specdev check-review to inspect results')
    return { approved: false, error: false, message: 'unexpected verdict' }
  }
}

/**
 * Run a list of reviewers sequentially. Skip already-approved reviewers.
 * @returns {Promise<boolean>} true if all reviewers approved
 */
async function runReviewerChain({
  targetDir, assignmentPath, name, phase, feedbackPhase, reviewerNames, isMulti, extraEnv,
}) {
  const fbPhase = feedbackPhase || phase
  for (const reviewerName of reviewerNames) {
    const feedbackFilename = isMulti
      ? `${fbPhase}-feedback-${reviewerName}.md`
      : `${fbPhase}-feedback.md`
    const changelogFilename = isMulti
      ? `${fbPhase}-changelog-${reviewerName}.md`
      : `${fbPhase}-changelog.md`

    // Check if already approved (for resume capability)
    if (isMulti) {
      const reviewDir = join(assignmentPath, 'review')
      const fbPath = join(reviewDir, feedbackFilename)
      if (await fse.pathExists(fbPath)) {
        const fbContent = await fse.readFile(fbPath, 'utf-8')
        const latest = getLatestRound(fbContent)
        if (latest && latest.verdict === 'approved') {
          console.log(`Reviewer ${reviewerName} already approved, skipping`)
          continue
        }
      }
    }

    const result = await runSingleReviewer({
      targetDir, assignmentPath, name, phase, reviewerName,
      feedbackFilename, changelogFilename, extraEnv,
    })

    if (result.error) {
      process.exitCode = 1
      return false
    }

    if (!result.approved) {
      return false
    }
  }

  return true
}

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
        ? `Invalid discussion ID "${flags.discussion}". Expected format: D00001`
        : `Discussion ${flags.discussion} not found.`
      console.error(msg)
      process.exitCode = 1
      return
    }

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
    const discussionId = discussionName.match(/^(D\d{4,5})/)?.[1] || discussionName
    const reviewerNames = flags.reviewer.split(',').map(r => r.trim())
    const isMulti = reviewerNames.length > 1

    const allApproved = await runReviewerChain({
      targetDir,
      assignmentPath: discussionPath,
      name: discussionName,
      phase: 'discussion',
      feedbackPhase: 'brainstorm',
      reviewerNames,
      isMulti,
      extraEnv: { SPECDEV_DISCUSSION: discussionId },
    })

    if (allApproved) {
      printSection('Discussion review approved!')
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

  const reviewerNames = flags.reviewer.split(',').map(r => r.trim())
  const isMulti = reviewerNames.length > 1

  const allApproved = await runReviewerChain({
    targetDir,
    assignmentPath,
    name,
    phase,
    reviewerNames,
    isMulti,
  })

  if (allApproved) {
    if (phase === 'brainstorm') {
      printDesignDigressionPrompt(name)
    } else if (phase === 'implementation') {
      printSimplificationPrompt()
    }

    const approveResult = await approvePhase(assignmentPath, phase)
    if (approveResult.approved) {
      printSection(`Review approved! Phase '${phase}' has been approved.`)
    } else {
      printSection('Review approved, but phase approval had errors:')
      for (const err of approveResult.errors) {
        console.log(`   - ${err}`)
      }
    }
  }
}
