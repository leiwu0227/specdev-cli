import { createWriteStream } from 'fs'
import { join } from 'path'
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
import {
  preflightReviewers,
  reviewerTimeoutSeconds,
  resolveReviewerNames,
} from '../utils/reviewer-preflight.js'
import { runReviewerProcess } from '../utils/reviewer-runner.js'

const REVIEWER_HEARTBEAT_MS = 30000

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

function printAutocontinuePrompt(phase, reviewerNames) {
  const reviewerArg = reviewerNames.join(',')
  blankLine()
  printSection('Autocontinue requested:')
  if (phase === 'brainstorm') {
    console.log('   The brainstorm gate is approved. Continue immediately to breakdown and implementation.')
    console.log(`   Reuse the selected reviewer for implementation review: specdev reviewloop implementation --reviewer=${reviewerArg} --autocontinue`)
  } else if (phase === 'implementation') {
    console.log('   The implementation gate is approved. Continue immediately to summary and knowledge capture.')
  }
  blankLine()
}

function reviewerLogPath(reviewDir, feedbackPhase, reviewerName, round) {
  return join(reviewDir, `${feedbackPhase}-reviewer-${reviewerName}-round-${round}.log`)
}

function formatLogEnv(env) {
  const keys = [
    'SPECDEV_PHASE',
    'SPECDEV_ASSIGNMENT',
    'SPECDEV_ROUND',
    'SPECDEV_FEEDBACK_FILE',
    'SPECDEV_CHANGELOG_FILE',
    'SPECDEV_FOCUS',
    'SPECDEV_DISCUSSION',
  ]
  return keys
    .filter((key) => env[key])
    .map((key) => {
      const value = key === 'SPECDEV_FOCUS'
        ? env[key].replace(/\s+/g, ' ').slice(0, 160)
        : env[key]
      return `  ${key}=${value}`
    })
    .join('\n')
}

function parseStrictSalvage(stdoutBuffer, expectedRound) {
  const stdout = Buffer.isBuffer(stdoutBuffer)
    ? stdoutBuffer.toString('utf-8')
    : String(stdoutBuffer || '')
  const roundPattern = /^## Round (\d+)\b/mg
  let match
  while ((match = roundPattern.exec(stdout)) !== null) {
    if (Number(match[1]) !== expectedRound) continue
    const slice = stdout.slice(match.index)
    const verdictMatch = slice.match(/^\*\*Verdict:\*\*\s+(approved|needs-changes)\b/m)
    if (!verdictMatch) return null
    return { text: slice, verdict: verdictMatch[1] }
  }
  return null
}

async function appendSalvagedFeedback(feedbackPath, salvage) {
  await fse.ensureDir(join(feedbackPath, '..'))
  await fse.appendFile(
    feedbackPath,
    `\n<!-- salvaged from stdout (reviewer exited cleanly without writing) -->\n${salvage.text}`,
    'utf-8',
  )
}

function emitPreflightResult(result, asJson) {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  printSection(`Reviewer preflight ${result.status}`)
  for (const reviewer of result.reviewers) {
    console.log(`   ${reviewer.name}: ${reviewer.blocking ? 'blocked' : 'ready'}`)
    for (const issue of reviewer.issues) {
      const marker = issue.severity === 'error' ? '✗' : '⚠'
      console.log(`      ${marker} ${issue.code}: ${issue.detail}`)
    }
  }
}

function emitPreflightFailure(result) {
  console.error('Reviewer preflight failed')
  for (const reviewer of result.reviewers) {
    const errors = reviewer.issues.filter((issue) => issue.severity === 'error')
    for (const issue of errors) {
      console.error(`   ${reviewer.name}: ${issue.code} — ${issue.detail}`)
    }
  }
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
  const timeoutSeconds = reviewerTimeoutSeconds(config)

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
  console.log(`   Timeout: ${timeoutSeconds}s`)
  blankLine()

  await writeCurrent(specdevPath, name)

  const focusText = await resolveRoundFocus(specdevPath, round)

  const childEnv = {
    ...process.env,
    SPECDEV_PHASE: phase,
    SPECDEV_ASSIGNMENT: name,
    SPECDEV_ROUND: String(round),
    SPECDEV_FOCUS: focusText,
    SPECDEV_FEEDBACK_FILE: feedbackPath,
    SPECDEV_CHANGELOG_FILE: changelogPath,
    ...extraEnv,
  }

  const feedbackPhase = feedbackFilename.replace(/-feedback(?:-[^.]+)?\.md$/, '')
  const logPath = reviewerLogPath(reviewDir, feedbackPhase, reviewerName, round)
  console.log(`   Reviewer log: ${logPath}`)
  blankLine()

  const logStream = createWriteStream(logPath, { flags: 'a' })
  let logClosed = false
  const writeLog = (chunk) => {
    if (!logClosed) logStream.write(chunk)
  }
  const closeLog = () => {
    if (logClosed) return
    logClosed = true
    logStream.end()
  }
  writeLog([
    'Reviewloop reviewer log',
    `Reviewer:   ${reviewerName}`,
    `Phase:      ${phase}`,
    `Round:      ${round}`,
    `Started:    ${new Date().toISOString()}`,
    `Timeout:    ${timeoutSeconds}s`,
    `Command:    ${config.command}`,
    'Env:',
    formatLogEnv(childEnv),
    '',
    '----- reviewer output -----',
    '',
  ].join('\n'))

  const runResult = await runReviewerProcess({
    command: config.command,
    cwd: targetDir,
    env: childEnv,
    timeoutMs: timeoutSeconds * 1000,
    heartbeatMs: REVIEWER_HEARTBEAT_MS,
    onStdout(chunk, ctx) {
      process.stdout.write(chunk)
      writeLog(chunk)
      if (chunk.length > 0) ctx.markActivity()
    },
    onStderr(chunk, ctx) {
      process.stderr.write(chunk)
      writeLog(chunk)
      if (chunk.length > 0) ctx.markActivity()
    },
  })
  const { exitCode, timedOut, stdoutBuffer, endedAt, elapsedMs } = runResult

  let verdictForFooter = 'missing'
  const writeFooter = (verdict) => {
    writeLog([
      '',
      '----- end of reviewer output -----',
      `Ended:      ${endedAt}`,
      `Elapsed:    ${Math.ceil(elapsedMs / 1000)}s`,
      `Exit code:  ${exitCode}`,
      `Timed out:  ${timedOut}`,
      `Verdict:    ${verdict}`,
      '',
    ].join('\n'))
    closeLog()
  }

  if (timedOut) {
    verdictForFooter = 'missing'
    writeFooter(verdictForFooter)
    console.error(`Reviewer timed out after ${timeoutSeconds}s: ${reviewerName}`)
    console.error(`Reviewer log: ${logPath}`)
    return { approved: false, error: true, message: 'reviewer timed out' }
  }

  if (exitCode !== 0) {
    writeFooter(verdictForFooter)
    console.error(`Reviewer exited with code ${exitCode}`)
    console.error(`Reviewer log: ${logPath}`)
    return { approved: false, error: true, message: 'reviewer failed' }
  }

  let updatedFeedback = (await fse.pathExists(feedbackPath))
    ? await fse.readFile(feedbackPath, 'utf-8')
    : ''

  let latestRound = getLatestRound(updatedFeedback)

  if (!latestRound) {
    const salvage = parseStrictSalvage(stdoutBuffer, round)
    if (salvage) {
      await appendSalvagedFeedback(feedbackPath, salvage)
      updatedFeedback = await fse.readFile(feedbackPath, 'utf-8')
      latestRound = getLatestRound(updatedFeedback)
      verdictForFooter = `salvaged:${salvage.verdict}`
    }
  }

  if (!latestRound) {
    writeFooter(verdictForFooter)
    console.error(`Reviewer finished but did not append ## Round ${round} to ${feedbackPath}`)
    console.error('Reviewer may have written only to stdout. Read the reviewer log, then either append the missing feedback round manually or re-run reviewloop.')
    console.error(`Reviewer log: ${logPath}`)
    return { approved: false, error: true, message: 'missing verdict' }
  }

  if (latestRound.round !== round) {
    writeFooter(verdictForFooter)
    console.error(`Reviewer finished but ${feedbackPath} contains round ${latestRound.round}, expected ## Round ${round}`)
    console.error(`Reviewer log: ${logPath}`)
    return { approved: false, error: true, message: 'wrong round' }
  }

  if (!verdictForFooter.startsWith('salvaged:')) {
    verdictForFooter = latestRound.verdict || 'missing'
  }
  writeFooter(verdictForFooter)

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
      reviewers.sort()
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
      console.log('Ask reviewer type as a multiple-choice question:')
      console.log('   Use one choice per reviewer config; do not ask for free-form reviewer text.')
      reviewers.forEach((reviewer, index) => {
        console.log(`   ${index + 1}. ${reviewer} — run specdev reviewloop discussion --discussion=${flags.discussion} --reviewer=${reviewer}`)
      })
      return
    }

    // With --reviewer: run the review loop for discussion
    const discussionId = discussionName.match(/^(D\d{4,5})/)?.[1] || discussionName
    let reviewerNames
    try {
      reviewerNames = await resolveReviewerNames(specdevPath, flags.reviewer.split(','))
    } catch (error) {
      console.error(error.message)
      process.exitCode = 1
      return
    }
    const isMulti = reviewerNames.length > 1
    const preflight = await preflightReviewers({
      specdevPath,
      assignmentPath: discussionPath,
      reviewerNames,
    })

    if (flags.preflight) {
      emitPreflightResult(preflight, Boolean(flags.json))
      if (preflight.status === 'fail') process.exitCode = 1
      return
    }

    if (preflight.status === 'fail') {
      emitPreflightFailure(preflight)
      process.exitCode = 1
      return
    }

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
      if (flags.autocontinue) {
        console.log('   Autocontinue is not supported for discussions; discussions remain standalone.')
      }
    }
    return
  }

  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)

  // ── Without --reviewer: list available reviewers and exit ──

  if (!flags.reviewer) {
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
    reviewers.sort()

    if (reviewers.length === 0) {
      if (flags.json) {
        console.log(JSON.stringify({
          command: 'reviewloop',
          version: 1,
          status: 'error',
          phase,
          assignment: name,
          reviewers,
          error: 'No reviewer configs found',
        }, null, 2))
        process.exitCode = 1
        return
      }
      console.error('No reviewer configs found')
      console.log(
        '   Add reviewer JSON configs to .specdev/skills/core/reviewloop/reviewers/',
      )
      process.exitCode = 1
      return
    }

    if (flags.json) {
      console.log(JSON.stringify({
        command: 'reviewloop',
        version: 1,
        status: 'ok',
        phase,
        assignment: name,
        reviewers,
      }, null, 2))
      return
    }

    console.log(`Reviewloop: ${name}`)
    console.log(`   Phase: ${phase}`)
    blankLine()

    printSection('Available reviewers:')
    for (const r of reviewers) {
      console.log(`   - ${r}`)
    }
    blankLine()
    console.log('Ask reviewer type as a multiple-choice question:')
    console.log('   Use one choice per reviewer config; do not ask for free-form reviewer text.')
    reviewers.forEach((reviewer, index) => {
      console.log(`   ${index + 1}. ${reviewer}`)
    })
    blankLine()
    console.log('Then run one of:')
    console.log(`   Review, then continue if approved: specdev reviewloop ${phase} --reviewer=<name> --autocontinue`)
    console.log(`   Review only: specdev reviewloop ${phase} --reviewer=<name>`)
    return
  }

  // ── With --reviewer: run the review loop ──

  const specdevPath = join(targetDir, '.specdev')
  let reviewerNames
  try {
    reviewerNames = await resolveReviewerNames(specdevPath, flags.reviewer.split(','))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
    return
  }
  const isMulti = reviewerNames.length > 1
  const preflight = await preflightReviewers({
    specdevPath,
    assignmentPath,
    reviewerNames,
  })

  if (flags.preflight) {
    emitPreflightResult(preflight, Boolean(flags.json))
    if (preflight.status === 'fail') process.exitCode = 1
    return
  }

  if (preflight.status === 'fail') {
    emitPreflightFailure(preflight)
    process.exitCode = 1
    return
  }

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
      if (flags.autocontinue) {
        printAutocontinuePrompt(phase, reviewerNames)
      }
    } else {
      printSection('Review approved, but phase approval had errors:')
      for (const err of approveResult.errors) {
        console.log(`   - ${err}`)
      }
    }
  }
}
