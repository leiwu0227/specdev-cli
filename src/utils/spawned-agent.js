import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { execFile as execFileCallback } from 'node:child_process'
import { dirname, join, relative } from 'node:path'
import { promisify } from 'node:util'
import fse from 'fs-extra'
import { buildProviderInvocation } from './provider-adapters.js'
import {
  parseResultEnvelope,
  resultEnvelopeBlockedFallback,
  resultEnvelopeInstructions,
} from './result-envelope.js'
import { parseGitPorcelainPaths, workspaceChangeSummaryLines } from './workspace-changes.js'
import {
  ATTEMPT_PROGRESS_INTERVAL_MS,
  attemptMilestonePrompt,
  attemptProgressPaths,
  buildAttemptProgress,
  formatAttemptProgress,
  readAttemptMilestone,
  writeAttemptProgress,
} from './attempt-progress.js'
import {
  attemptLiveness,
  clearLocalProcessMarker,
  createAttemptRecord,
  listAttemptRecords,
  updateAttemptRecord,
  writeLocalProcessMarker,
} from './process-record.js'

const execFile = promisify(execFileCallback)
const TERMINATION_GRACE_MS = 5_000
const MAX_CAPTURE_BYTES = 2 * 1024 * 1024

export async function runSpawnedAgent(options) {
  const {
    targetDir,
    specdevPath,
    role,
    profile,
    prompt,
    resultPath,
    resultKind = role,
    assignment,
    mission,
    discussion,
    guides = [],
    allowFormatCorrection = true,
    progressFormat = requestedProgressFormat(),
  } = options
  if (!targetDir || !specdevPath || !resultPath) {
    throw new Error('runSpawnedAgent requires targetDir, specdevPath, and resultPath')
  }

  if (role === 'worker') await warnAboutConcurrentWriters(specdevPath, { assignment, mission })
  if (role === 'reviewer') {
    await assertNoConcurrentReviewer(specdevPath, { assignment, mission, discussion })
  }

  const digestExclusions = [repoRelative(targetDir, resultPath)].filter(Boolean)
  const reviewCandidate = role === 'reviewer' ? reviewerCandidateRoot(targetDir, resultPath) : null
  const beforeReview =
    role === 'reviewer'
      ? await reviewerStateDigest(targetDir, reviewCandidate, digestExclusions)
      : null
  const primary = await executeInvocation({
    targetDir,
    specdevPath,
    role,
    profile,
    prompt: appendResultContract(prompt, resultKind, guides),
    resultPath,
    resultKind,
    assignment,
    mission,
    discussion,
    guides,
    attemptKind: role,
    progressFormat,
  })
  if (primary.status !== 'completed') return primary

  if (beforeReview) {
    const violation = await reviewerWriteViolation({
      targetDir,
      specdevPath,
      attempt: primary.attempt,
      beforeReview,
      reviewCandidate,
      digestExclusions,
    })
    if (violation) return { ...primary, ...violation }
  }

  try {
    const parsed = parseResultEnvelope(await fse.readFile(resultPath, 'utf-8'), resultKind)
    let attempt
    try {
      attempt = await persistSemanticAttemptOutcome(
        specdevPath,
        primary.attempt.id,
        resultKind,
        parsed.frontmatter
      )
    } catch (error) {
      return {
        ...primary,
        status: 'failed',
        error: `Agent result was valid but its durable outcome could not be recorded: ${error.message}`,
      }
    }
    return { ...primary, attempt, result: parsed }
  } catch (error) {
    if (!allowFormatCorrection) {
      const artifact = repoRelative(targetDir, resultPath) || resultPath
      const validationError = `invalid result envelope at ${artifact}: ${error.message}`
      await updateAttemptRecord(specdevPath, primary.attempt.id, {
        status: 'failed',
        error: validationError,
      })
      return { ...primary, status: 'failed', error: validationError }
    }

    await updateAttemptRecord(specdevPath, primary.attempt.id, {
      status: 'failed',
      error: `invalid result envelope: ${error.message}`,
    })

    const malformed = await fse.readFile(resultPath, 'utf-8')
    const beforeCorrection = await reviewerStateDigest(targetDir, reviewCandidate, digestExclusions)
    const correction = await executeInvocation({
      targetDir,
      specdevPath,
      role: 'reviewer',
      profile,
      prompt: formattingCorrectionPrompt(malformed, resultKind, error.message),
      resultPath,
      resultKind,
      assignment,
      mission,
      discussion,
      guides,
      attemptKind: 'format-correction',
      progressFormat,
    })
    if (correction.status !== 'completed') return correction
    if (beforeCorrection) {
      const violation = await reviewerWriteViolation({
        targetDir,
        specdevPath,
        attempt: correction.attempt,
        beforeReview: beforeCorrection,
        reviewCandidate,
        digestExclusions,
      })
      if (violation) return { ...correction, ...violation }
    }
    try {
      const parsed = parseResultEnvelope(await fse.readFile(resultPath, 'utf-8'), resultKind)
      let attempt
      try {
        attempt = await persistSemanticAttemptOutcome(
          specdevPath,
          correction.attempt.id,
          resultKind,
          parsed.frontmatter
        )
      } catch (error) {
        return {
          ...correction,
          status: 'failed',
          error: `Corrected result was valid but its durable outcome could not be recorded: ${error.message}`,
        }
      }
      return { ...correction, attempt, corrected_attempt: primary.attempt.id, result: parsed }
    } catch (correctionError) {
      const artifact = repoRelative(targetDir, resultPath) || resultPath
      const validationError = `corrected result is still invalid at ${artifact}: ${correctionError.message}`
      await updateAttemptRecord(specdevPath, correction.attempt.id, {
        status: 'failed',
        error: validationError,
      })
      return { ...correction, status: 'failed', error: validationError }
    }
  }
}

export function durableAttemptStatusForResult(kind, frontmatter = {}) {
  if (kind === 'worker' && frontmatter.status === 'blocked') return 'blocked'
  if (kind === 'reviewer' && frontmatter.verdict === 'blocked') return 'blocked'
  return 'completed'
}

async function persistSemanticAttemptOutcome(specdevPath, attemptId, kind, frontmatter) {
  const resultStatus = kind === 'reviewer' ? frontmatter.verdict : frontmatter.status
  return updateAttemptRecord(specdevPath, attemptId, {
    status: durableAttemptStatusForResult(kind, frontmatter),
    ...(resultStatus ? { result_status: resultStatus } : {}),
  })
}

async function warnAboutConcurrentWriters(specdevPath, current) {
  const targetDir = dirname(specdevPath)
  const revision = await gitRevision(targetDir)
  const dirtyPaths = await gitDirtyPaths(targetDir)
  process.stderr.write(`SpecDev workspace: HEAD ${revision || 'unborn'}\n`)
  for (const line of workspaceChangeSummaryLines(dirtyPaths))
    process.stderr.write(`SpecDev ${line}\n`)

  const running = await listAttemptRecords(specdevPath, { status: 'running' })
  const candidates = running.filter((record) => {
    if (!['worker', 'mission-controller'].includes(record.kind)) return false
    if (
      record.kind === 'mission-controller' &&
      current.mission &&
      record.mission === current.mission
    )
      return false
    return true
  })
  const live = []
  for (const record of candidates) {
    if ((await attemptLiveness(specdevPath, record.id)).state === 'live_local') live.push(record.id)
  }
  if (live.length > 0) {
    process.stderr.write(
      `SpecDev warning: other live write Attempts may be changing this repository: ${live.join(', ')}\n`
    )
  }
}

async function gitDirtyPaths(targetDir) {
  try {
    const { stdout } = await execFile(
      'git',
      ['status', '--porcelain=v1', '--untracked-files=all'],
      { cwd: targetDir }
    )
    return parseGitPorcelainPaths(stdout)
  } catch {
    return []
  }
}

async function assertNoConcurrentReviewer(specdevPath, scope) {
  const running = (await listAttemptRecords(specdevPath, { status: 'running' })).filter((record) =>
    ['reviewer', 'format-correction'].includes(record.kind)
  )
  for (const record of running) {
    const sameScope = scope.assignment
      ? record.assignment === scope.assignment
      : scope.mission
        ? record.mission === scope.mission
        : scope.discussion
          ? record.discussion === scope.discussion
          : false
    if (!sameScope) continue
    if ((await attemptLiveness(specdevPath, record.id)).state === 'live_local') {
      throw new Error(`Reviewer ${record.id} is already running for this work item`)
    }
  }
}

async function executeInvocation({
  targetDir,
  specdevPath,
  role,
  profile,
  prompt,
  resultPath,
  assignment,
  mission,
  discussion,
  guides,
  attemptKind,
  progressFormat,
}) {
  await fse.ensureDir(dirname(resultPath))
  if (profile.provider === 'codex' && process.env.CODEX_SANDBOX) {
    return {
      status: 'failed',
      attempt: null,
      error:
        'Cannot launch a nested Codex provider from inside a sandboxed Codex session. Run this SpecDev automatic/review command from the foreground terminal, or configure a different provider.',
    }
  }
  let invocation
  try {
    invocation = buildProviderInvocation({
      profile,
      role,
      cwd: targetDir,
      resultPath: join(specdevPath, 'cache', 'attempts', 'preflight-result.md'),
    })
  } catch (error) {
    return { status: 'failed', attempt: null, error: `agent preflight failed: ${error.message}` }
  }
  const baseRevision = await gitRevision(targetDir)
  const attempt = await createAttemptRecord(specdevPath, {
    kind: attemptKind,
    workspace: '.',
    base_revision: baseRevision,
    profile: role,
    provider: profile.provider,
    model: profile.model,
    effort: profile.effort,
    network: profile.network,
    result_path: repoRelative(targetDir, resultPath),
    assignment,
    mission,
    discussion,
    guides,
  })
  const cacheDir = join(specdevPath, 'cache', 'attempts')
  const providerResultPath = join(cacheDir, `${attempt.id}-result.md`)
  const stdoutPath = join(cacheDir, `${attempt.id}.stdout.log`)
  const stderrPath = join(cacheDir, `${attempt.id}.stderr.log`)
  const progressPaths = attemptProgressPaths(specdevPath, attempt.id)
  await fse.ensureDir(cacheDir)
  await writeLocalProcessMarker(specdevPath, attempt.id)

  let processResult
  const startedAt = Date.now()
  try {
    invocation = buildProviderInvocation({
      profile,
      role,
      cwd: targetDir,
      resultPath: providerResultPath,
    })
    process.stderr.write(
      `SpecDev ${attempt.id}: ${role} agent started (${profile.provider}/${profile.model}).\n`
    )
    processResult = await spawnInvocation({
      ...invocation,
      cwd: targetDir,
      prompt: `${prompt.trim()}\n\n${attemptMilestonePrompt(targetDir, progressPaths.milestone)}\n`,
      timeoutMs: profile.timeout_ms,
      stdoutPath,
      stderrPath,
      attemptId: attempt.id,
      role,
      startedAt: attempt.started_at,
      milestonePath: progressPaths.milestone,
      progressPath: progressPaths.progress,
      progressFormat,
    })
  } catch (error) {
    process.stderr.write(`SpecDev ${attempt.id}: agent launch failed: ${error.message}\n`)
    await updateAttemptRecord(specdevPath, attempt.id, {
      status: 'failed',
      error: error.message,
      duration_ms: Date.now() - startedAt,
    })
    await clearLocalProcessMarker(specdevPath, attempt.id)
    return { status: 'failed', attempt, error: error.message }
  }
  await clearLocalProcessMarker(specdevPath, attempt.id)
  process.stderr.write(
    `SpecDev ${attempt.id}: agent finished after ${Math.max(1, Math.round((Date.now() - startedAt) / 1000))}s.\n`
  )

  if (processResult.timedOut) {
    await updateAttemptRecord(specdevPath, attempt.id, {
      status: 'interrupted',
      error: 'timeout',
      duration_ms: Date.now() - startedAt,
      ...usagePatch(processResult),
    })
    return { status: 'interrupted', attempt, error: 'agent invocation timed out' }
  }
  if (processResult.exitCode !== 0) {
    await updateAttemptRecord(specdevPath, attempt.id, {
      status: 'failed',
      error: `provider exited with status ${processResult.exitCode}`,
      duration_ms: Date.now() - startedAt,
      ...usagePatch(processResult),
    })
    return {
      status: 'failed',
      attempt,
      error: `agent provider exited with status ${processResult.exitCode}`,
    }
  }

  const resultText =
    invocation.resultMode === 'file' && (await fse.pathExists(providerResultPath))
      ? await fse.readFile(providerResultPath, 'utf-8')
      : processResult.stdout
  const temporaryResult = `${resultPath}.tmp-${process.pid}`
  await fse.writeFile(temporaryResult, resultText, 'utf-8')
  await fse.move(temporaryResult, resultPath, { overwrite: true })
  const resultRevision = await gitRevision(targetDir)
  await updateAttemptRecord(specdevPath, attempt.id, {
    status: 'completed',
    duration_ms: Date.now() - startedAt,
    ...usagePatch(processResult),
    result_revision:
      (await gitDirtyPaths(targetDir)).length > 0
        ? `working-tree@${resultRevision || 'unborn'}`
        : resultRevision,
  })
  return { status: 'completed', attempt, resultPath }
}

function spawnInvocation({
  command,
  args,
  cwd,
  prompt,
  timeoutMs,
  stdoutPath,
  stderrPath,
  attemptId,
  role,
  startedAt,
  milestonePath,
  progressPath,
  progressFormat,
}) {
  return new Promise((resolvePromise, reject) => {
    const stdoutLog = createWriteStream(stdoutPath, { flags: 'a' })
    const stderrLog = createWriteStream(stderrPath, { flags: 'a' })
    let stdout = Buffer.alloc(0)
    let stderr = Buffer.alloc(0)
    let settled = false
    let timedOut = false
    let killTimer
    let lastLogActivityAt = null
    let lastValidMilestone = null
    let progressEmission = null
    const streamProviderOutput = process.env.SPECDEV_AGENT_STREAM === '1'
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
    })

    const timeoutTimer = setTimeout(() => {
      timedOut = true
      try {
        process.kill(-child.pid, 'SIGTERM')
      } catch {}
      killTimer = setTimeout(() => {
        try {
          process.kill(-child.pid, 'SIGKILL')
        } catch {}
      }, TERMINATION_GRACE_MS)
      killTimer.unref?.()
    }, timeoutMs)
    const emitProgress = () => {
      if (progressEmission) return progressEmission
      progressEmission = (async () => {
        const milestoneResult = await readAttemptMilestone(milestonePath, {
          lastValidMilestone,
        })
        lastValidMilestone = milestoneResult.milestone
        const progress = buildAttemptProgress({
          attemptId,
          role,
          startedAt,
          processLiveness: 'live_local',
          logActivityAt: lastLogActivityAt,
          milestone: lastValidMilestone,
          diagnostic: milestoneResult.diagnostic,
        })
        await writeAttemptProgress(progressPath, progress)
        process.stderr.write(`${formatAttemptProgress(progress, progressFormat)}\n`)
      })()
        .catch(() => {
          const fallback =
            progressFormat === 'structured'
              ? JSON.stringify({
                  type: 'specdev.attempt_progress',
                  progress: {
                    version: 1,
                    attempt: attemptId,
                    role,
                    classification: 'stale',
                    diagnostic: 'progress_io_error',
                  },
                })
              : `SpecDev ${attemptId} progress unavailable: progress_io_error.`
          process.stderr.write(`${fallback}\n`)
        })
        .finally(() => {
          progressEmission = null
        })
      return progressEmission
    }
    void emitProgress()
    const progressTimer = setInterval(emitProgress, ATTEMPT_PROGRESS_INTERVAL_MS)
    progressTimer.unref?.()

    child.stdin.end(prompt)
    child.stdout.on('data', (chunk) => {
      lastLogActivityAt = Date.now()
      stdoutLog.write(chunk)
      if (streamProviderOutput) process.stderr.write(chunk)
      stdout = appendCapped(stdout, chunk)
    })
    child.stderr.on('data', (chunk) => {
      lastLogActivityAt = Date.now()
      stderrLog.write(chunk)
      if (streamProviderOutput) process.stderr.write(chunk)
      stderr = appendCapped(stderr, chunk)
    })
    child.on('error', async (error) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutTimer)
      clearInterval(progressTimer)
      if (killTimer) clearTimeout(killTimer)
      await closeStreams(stdoutLog, stderrLog)
      reject(error)
    })
    child.on('close', async (exitCode) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutTimer)
      clearInterval(progressTimer)
      if (killTimer) clearTimeout(killTimer)
      await closeStreams(stdoutLog, stderrLog)
      resolvePromise({
        exitCode: timedOut ? null : exitCode,
        timedOut,
        stdout: stdout.toString('utf-8'),
        stderr: stderr.toString('utf-8'),
      })
    })
  })
}

function usagePatch(processResult) {
  const text = `${processResult.stdout || ''}\n${processResult.stderr || ''}`
  const matches = [
    ...text.matchAll(/tokens\s+used\s*:?\s*([\d,]+)/gi),
    ...text.matchAll(/"total_tokens"\s*:\s*([\d,]+)/gi),
  ]
  const tokens = matches
    .map((match) => Number(match[1].replaceAll(',', '')))
    .filter((value) => Number.isSafeInteger(value) && value >= 0)
    .at(-1)
  return tokens === undefined ? {} : { usage: { provider_reported_tokens: tokens } }
}

function appendResultContract(prompt, kind, guides) {
  const guideLines =
    guides.length > 0
      ? guides.map((guide) => `- ${guide.id}@${guide.version}: ${guide.path}`).join('\n')
      : '- none'
  const inspectionNote =
    kind === 'reviewer'
      ? 'Use `git status` and read relevant untracked files directly; `git diff` alone may omit an untracked candidate.\n'
      : ''
  return `${prompt.trim()}\n\nKeep tool output narrow. Do not repeatedly print full files or full diffs; inspect targeted ranges and return as soon as the required evidence and artifacts are complete.\n${inspectionNote}\nGuides supplied by the host for this invocation:\n${guideLines}\n\nReturn only the strict result envelope below. Invalid formatting cannot advance the workflow.\n\n${resultEnvelopeInstructions(kind)}\n`
}

function requestedProgressFormat() {
  return process.argv.some((arg) => arg === '--json' || arg.startsWith('--json='))
    ? 'structured'
    : 'human'
}

function formattingCorrectionPrompt(malformed, kind, error) {
  return `Reformat the result below. Do not inspect the repository, rerun work, or change its meaning. Copy semantic values only when the original states them explicitly and unambiguously. If any required semantic value is absent or ambiguous, return the blocked fallback exactly and explain the ambiguity in its required section.\n\nValidation error: ${error}\n\nStrict result contract:\n\n${resultEnvelopeInstructions(kind)}\n\nSafe blocked fallback:\n\n${resultEnvelopeBlockedFallback(kind)}\n\nOriginal result:\n\n${malformed}`
}

async function trackedStateDigest(targetDir, { includes = ['.'], exclusions = [] } = {}) {
  try {
    const excluded = ['.specdev/cache/**', '.specdev/.id-counters.json', ...exclusions]
    const pathspecs = excluded.map((path) => `:(exclude)${path}`)
    const hasHead = await gitHasHead(targetDir)
    const diffCommands = hasHead
      ? [['diff', '--binary', '--no-ext-diff', 'HEAD', '--', ...includes, ...pathspecs]]
      : [
          ['diff', '--binary', '--no-ext-diff', '--cached', '--', ...includes, ...pathspecs],
          ['diff', '--binary', '--no-ext-diff', '--', ...includes, ...pathspecs],
        ]
    const [diffs, { stdout: untracked }] = await Promise.all([
      Promise.all(
        diffCommands.map((args) =>
          execFile('git', args, {
            cwd: targetDir,
            maxBuffer: 32 * 1024 * 1024,
            encoding: 'buffer',
          })
        )
      ),
      execFile(
        'git',
        ['ls-files', '--others', '--exclude-standard', '-z', '--', ...includes, ...pathspecs],
        {
          cwd: targetDir,
          maxBuffer: 8 * 1024 * 1024,
          encoding: 'buffer',
        }
      ),
    ])
    const hash = createHash('sha256')
    for (const { stdout } of diffs) hash.update(stdout)
    const paths = untracked.toString('utf-8').split('\0').filter(Boolean).sort()
    for (const path of paths) {
      hash.update('\0')
      hash.update(path)
      hash.update('\0')
      hash.update(await fse.readFile(join(targetDir, path)))
    }
    return hash.digest('hex')
  } catch {
    return null
  }
}

export async function productStateDigest(targetDir) {
  return trackedStateDigest(targetDir, { exclusions: ['.specdev/**'] })
}

async function reviewerStateDigest(targetDir, candidateRoot, exclusions) {
  const [product, candidate] = await Promise.all([
    trackedStateDigest(targetDir, { exclusions: ['.specdev/**'] }),
    trackedStateDigest(targetDir, {
      includes: [candidateRoot],
      exclusions,
    }),
  ])
  if (!product || !candidate) return null
  return createHash('sha256')
    .update('product\0')
    .update(product)
    .update('\0candidate\0')
    .update(candidate)
    .digest('hex')
}

function reviewerCandidateRoot(targetDir, resultPath) {
  const relativeResult = repoRelative(targetDir, resultPath)
  const match = relativeResult?.match(
    /^\.specdev\/(assignments|missions|discussions)\/([^/]+)(?:\/|$)/
  )
  if (!match) {
    throw new Error(
      'Reviewer result must belong to an Assignment, Mission, or Discussion candidate'
    )
  }
  return `.specdev/${match[1]}/${match[2]}`
}

async function gitHasHead(targetDir) {
  try {
    await execFile('git', ['rev-parse', '--verify', 'HEAD'], { cwd: targetDir })
    return true
  } catch {
    return false
  }
}

async function reviewerWriteViolation({
  targetDir,
  specdevPath,
  attempt,
  beforeReview,
  reviewCandidate,
  digestExclusions,
}) {
  const attemptPath = repoRelative(targetDir, join(specdevPath, 'processes', `${attempt.id}.yaml`))
  const afterReview = await reviewerStateDigest(
    targetDir,
    reviewCandidate,
    [...digestExclusions, attemptPath].filter(Boolean)
  )
  if (afterReview === beforeReview) return null
  await updateAttemptRecord(specdevPath, attempt.id, {
    status: 'failed',
    error: 'reviewer modified repository state',
  })
  return {
    status: 'failed',
    error: 'Reviewer modified tracked or untracked repository state; review is invalid.',
  }
}

async function gitRevision(targetDir) {
  try {
    const { stdout } = await execFile('git', ['rev-parse', 'HEAD'], { cwd: targetDir })
    return stdout.trim() || null
  } catch {
    return null
  }
}

function repoRelative(targetDir, path) {
  const rel = relative(targetDir, path).replaceAll('\\', '/')
  return rel && !rel.startsWith('../') ? rel : null
}

function appendCapped(current, chunk) {
  const combined = Buffer.concat([current, chunk])
  return combined.length <= MAX_CAPTURE_BYTES
    ? combined
    : combined.subarray(combined.length - MAX_CAPTURE_BYTES)
}

function closeStreams(...streams) {
  return Promise.all(
    streams.map((stream) => new Promise((resolvePromise) => stream.end(resolvePromise)))
  )
}
