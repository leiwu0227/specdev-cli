import { execFile as execFileCallback } from 'node:child_process'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { promisify } from 'node:util'
import fse from 'fs-extra'
import { abandonRun, readCheckpoint, readCurrent as readRippleCurrent, runDir } from 'ripplegraph'
import { compactUnsupportedWorkflowRuntime } from '../utils/artifact-retention.js'
import { resolveAssignmentSelector } from '../utils/assignment.js'
import {
  assertApprovedContract,
  relativeToRepo,
  writeAssignmentStatus,
} from '../utils/assignment-vnext.js'
import { clearCurrent, readCurrentFocus } from '../utils/current.js'
import { workflowRootFor } from '../utils/engine.js'
import {
  commitExactDelivery,
  concurrentCallablePathDetails,
  currentGitBranch,
  findCommitByTrailer,
  firstParent,
  gitChangedPathsAtCommit,
  gitStatusEntries,
  requireGitHead,
  synchronizeIndexPaths,
} from '../utils/git-delivery.js'
import {
  attemptLiveness,
  listAttemptRecords,
  updateAttemptRecord,
} from '../utils/process-record.js'

const execFile = promisify(execFileCallback)
const TERMINAL_STATUSES = new Set(['completed', 'abandoned', 'shelved', 'unsupported'])
const COMMIT_TYPE = 'unsupported-terminal'
const JOURNAL_VERSION = 1

export function closeAssignmentHelp() {
  console.log(`Usage: specdev assignment close <id> --outcome=unsupported --reason="<reason>" --evidence=<path[,path]> [--snapshot=owned]

Close an eligible standalone Assignment with an evidence-bearing unsupported conclusion.

The first invocation is a read-only planning pass over tracked workflow state. It
prints the exact HEAD, evidence identities, Assignment-owned commit manifest, and
excluded dirt with owners. Rerun the displayed command with --snapshot=owned to
authorize exactly that plan. A changed HEAD, evidence digest, path manifest, run,
or Attempt state invalidates the confirmation.

The confirmed operation prepares an ignored recovery journal, compacts only the
Assignment runtime, clears matching focus, and publishes all tracked effects in
one exact terminal commit. Rerunning the command recovers or verifies the same
closure; it never reopens the source Assignment.`)
}

export async function closeAssignmentCommand(targetDir, specdevPath, positionalArgs, flags = {}) {
  const selector = String(positionalArgs[0] || '').trim()
  if (!selector) return fail(flags, 'Usage: specdev assignment close <id> --outcome=unsupported')
  if (String(flags.outcome || '').trim() !== 'unsupported') {
    return fail(flags, 'Assignment close currently requires --outcome=unsupported')
  }

  const resolved = await resolveAssignmentSelector(specdevPath, selector)
  if (!resolved || resolved.ambiguous)
    return fail(flags, `Assignment not found or ambiguous: ${selector}`)
  let status = await fse.readJson(join(resolved.path, 'status.json')).catch(() => null)
  if (!status?.id || !status.run_id) {
    return fail(
      flags,
      `Assignment ${resolved.name} has no durable lifecycle identity and cannot be closed safely`
    )
  }

  const journalPath = closeJournalPath(specdevPath, status.id)
  const journal = await readJson(journalPath)
  if (status.status === 'unsupported') {
    try {
      assertExactRetry(flags, status)
      return emit(
        flags,
        await recoverUnsupportedClose(targetDir, specdevPath, resolved, status, journal)
      )
    } catch (error) {
      return fail(
        flags,
        `Could not recover unsupported closure: ${error.message}\nRerun: ${recoveryCommand(status.id)}`
      )
    }
  }
  if (status.mission) {
    return fail(
      flags,
      `Assignment ${status.id} is a Mission child and cannot be closed independently`
    )
  }
  if (TERMINAL_STATUSES.has(status.status)) {
    return fail(
      flags,
      `Assignment ${status.id} is already ${status.status}; create a fresh Assignment for new work`
    )
  }

  let reason
  try {
    reason = requiredFlag(flags.reason, '--reason')
  } catch (error) {
    return fail(flags, error.message)
  }
  if (!reason) return fail(flags, 'Unsupported closure requires --reason="<conclusion>"')
  let evidencePaths
  try {
    evidencePaths = parseEvidenceFlag(flags.evidence)
  } catch (error) {
    return fail(flags, error.message)
  }
  if (evidencePaths.length === 0) {
    return fail(
      flags,
      'Unsupported closure requires attributable written evidence via --evidence=<path[,path]>'
    )
  }

  let plan
  try {
    plan = await buildClosePlan(targetDir, specdevPath, resolved, status, reason, evidencePaths)
  } catch (error) {
    return fail(flags, error.message)
  }
  const confirmed = flags.snapshot === 'owned'
  if (flags.snapshot !== undefined && !confirmed) {
    return fail(flags, '--snapshot currently accepts only the semantic value "owned"')
  }
  if (!confirmed) {
    await writeJournal(journalPath, { version: JOURNAL_VERSION, phase: 'planned', plan })
    return blocked(flags, planPayload(plan, false))
  }
  if (!journal || journal.version !== JOURNAL_VERSION || journal.phase !== 'planned') {
    await writeJournal(journalPath, { version: JOURNAL_VERSION, phase: 'planned', plan })
    return blocked(
      flags,
      planPayload(
        plan,
        true,
        'No current displayed plan exists; inspect this plan before confirming it.'
      )
    )
  }
  if (journal.plan?.digest !== plan.digest) {
    await writeJournal(journalPath, { version: JOURNAL_VERSION, phase: 'planned', plan })
    return blocked(
      flags,
      planPayload(
        plan,
        true,
        'The displayed plan changed; inspect the replacement plan before confirming it.'
      )
    )
  }

  try {
    await writeJournal(journalPath, {
      ...journal,
      phase: 'authority_confirmed',
      confirmed_at: new Date().toISOString(),
    })
    status = await prepareUnsupportedState(
      targetDir,
      specdevPath,
      resolved,
      status,
      plan,
      journalPath
    )
    return emit(
      flags,
      await publishUnsupportedState(
        targetDir,
        specdevPath,
        resolved,
        status,
        plan,
        journalPath,
        false
      )
    )
  } catch (error) {
    return fail(
      flags,
      `Unsupported closure did not publish: ${error.message}\nRerun: ${recoveryCommand(status.id)}`
    )
  }
}

async function buildClosePlan(targetDir, specdevPath, resolved, status, reason, evidencePaths) {
  let approval
  try {
    approval = await assertApprovedContract(targetDir, resolved.path)
  } catch (error) {
    throw new Error(`Unsupported closure requires the active approved contract: ${error.message}`)
  }
  const workflowRoot = workflowRootFor(targetDir)
  let checkpoint
  try {
    checkpoint = readCheckpoint(workflowRoot, status.run_id)
  } catch {
    throw new Error(`Assignment ${status.id} has no matching durable lifecycle run`)
  }
  const rippleFocus = readRippleCurrent(workflowRoot)
  if (
    checkpoint.rootGraph !== 'assignment-lifecycle' ||
    checkpoint.status !== 'active' ||
    rippleFocus.focusedRunId !== status.run_id
  ) {
    throw new Error(
      `Only the active standalone Assignment can close unsupported; run ${status.run_id} is ${checkpoint.status}`
    )
  }
  const currentFocus = await readCurrentFocus(specdevPath)
  if (currentFocus?.kind !== 'assignment' || currentFocus.id !== String(status.id)) {
    throw new Error(`Assignment ${status.id} is not the active SpecDev focus`)
  }
  const attempts = await inspectAttempts(specdevPath, resolved.name)
  if (attempts.blocking.length > 0) {
    throw new Error(
      `Assignment ${status.id} has live or ambiguous Attempts: ${attempts.blocking.join(', ')}. Stop or resolve them before closing.`
    )
  }

  const head = await requireGitHead(targetDir)
  if (
    status.git_boundary?.starting_git_commit_hash &&
    status.git_boundary.starting_git_commit_hash !== head
  ) {
    throw new Error(
      `Assignment Git boundary changed (${status.git_boundary.starting_git_commit_hash} -> ${head}); inspect the intervening commits before closing`
    )
  }
  const evidence = await inspectEvidence(targetDir, resolved, evidencePaths, head)
  const entries = await gitStatusEntries(targetDir)
  const trackedEffects = await prospectiveTrackedEffects(
    targetDir,
    specdevPath,
    resolved,
    status,
    attempts.records
  )
  const owned = new Set(trackedEffects)
  const compacted = new Set()
  const excluded = []
  for (const entry of entries) {
    const classification = classifyDirtyPath(
      entry.path,
      resolved,
      status,
      evidence,
      head,
      attempts.records
    )
    if (classification.transient) {
      if (await gitObjectExists(targetDir, `${head}:${entry.path}`)) owned.add(entry.path)
      else compacted.add(entry.path)
    } else if (classification.owned) owned.add(entry.path)
    else excluded.push({ path: entry.path, ...classification.detail })
  }
  const artifact = relativeToRepo(targetDir, join(resolved.path, 'unsupported.md'))
  const statusPath = relativeToRepo(targetDir, join(resolved.path, 'status.json'))
  owned.add(artifact)
  owned.add(statusPath)
  const ownedPaths = [...owned].sort()
  const planFacts = {
    version: 1,
    disposition: 'unsupported',
    assignment: {
      id: String(status.id),
      name: resolved.name,
      path: relativeToRepo(targetDir, resolved.path),
    },
    head,
    branch: await currentGitBranch(targetDir),
    contract: {
      path: relativeToRepo(targetDir, approval.contract.path),
      hash: approval.contract.hash,
      approved_at: status.approved_at || approval.approval.approved_at || null,
    },
    reason,
    evidence,
    source_lifecycle: {
      status: status.status || 'active',
      run_id: status.run_id,
      run_status: checkpoint.status,
    },
    owned_paths: ownedPaths,
    prospective_paths: [...trackedEffects].sort(),
    compacted_paths: [...compacted].sort(),
    excluded_paths: excluded.sort((left, right) => left.path.localeCompare(right.path)),
    stale_attempts: attempts.stale,
    terminal_action:
      'compact owned runtime, clear matching focus, and publish one unsupported-terminal commit',
  }
  return { ...planFacts, digest: digest(planFacts) }
}

async function prepareUnsupportedState(
  targetDir,
  specdevPath,
  resolved,
  status,
  plan,
  journalPath
) {
  const head = await requireGitHead(targetDir)
  if (head !== plan.head) throw new Error(`confirmed HEAD changed (${plan.head} -> ${head})`)
  await assertPlanEvidence(targetDir, plan)
  const attempts = await inspectAttempts(specdevPath, resolved.name)
  if (attempts.blocking.length > 0)
    throw new Error(`Attempt liveness changed: ${attempts.blocking.join(', ')}`)
  for (const attempt of attempts.records.filter((item) => attempts.stale.includes(item.id))) {
    if (attempt.status === 'running')
      await updateAttemptRecord(specdevPath, attempt.id, { status: 'interrupted' })
  }

  const closedAt = status.unsupported_at || new Date().toISOString()
  const artifactPath = join(resolved.path, 'unsupported.md')
  const unsupported = {
    version: 1,
    disposition: 'unsupported',
    reason: plan.reason,
    closed_at: closedAt,
    artifact: relativeToRepo(targetDir, artifactPath),
    contract: plan.contract,
    evidence: plan.evidence,
    prior_lifecycle: plan.source_lifecycle,
    owned_paths: plan.owned_paths,
    repository: {
      root: '.',
      branch: plan.branch,
      parent: plan.head,
      plan_digest: plan.digest,
    },
    plan,
  }
  await fse.writeFile(artifactPath, renderUnsupportedArtifact(status, unsupported), 'utf-8')
  const nextStatus = await writeAssignmentStatus(resolved.path, {
    status: 'unsupported',
    unsupported_at: closedAt,
    unsupported,
  })

  const path = runDir(specdevPath, status.run_id)
  if (await fse.pathExists(join(path, 'checkpoint.json'))) {
    const checkpoint = readCheckpoint(specdevPath, status.run_id)
    if (checkpoint.status === 'active') {
      const current = readRippleCurrent(specdevPath)
      if (current.focusedRunId !== status.run_id)
        throw new Error(`another run is focused: ${current.focusedRunId || 'none'}`)
      abandonRun({
        workflowRoot: specdevPath,
        reason: `Assignment ${status.id} closed unsupported`,
      })
    } else if (checkpoint.status !== 'abandoned') {
      throw new Error(`unsupported closure conflicts with run state ${checkpoint.status}`)
    }
  }
  await compactUnsupportedWorkflowRuntime(specdevPath, {
    runId: status.run_id,
    attemptFilter: { assignment: resolved.name },
    terminalOwner: { assignment: resolved.name, status: 'unsupported' },
    focus: { kind: 'assignment', id: status.id },
  })
  await clearCurrent(specdevPath)
  const preparedPaths = await assertPreparedManifest(targetDir, plan)
  await writeJournal(journalPath, {
    version: JOURNAL_VERSION,
    phase: 'prepared',
    plan,
    prepared_at: new Date().toISOString(),
    prepared_paths: preparedPaths,
    prepared_digest: await pathStateDigest(targetDir, plan.owned_paths),
  })
  return nextStatus
}

async function publishUnsupportedState(
  targetDir,
  specdevPath,
  resolved,
  status,
  plan,
  journalPath,
  idempotent
) {
  const existing = await findCommitByTrailer(targetDir, 'SpecDev-Assignment', status.id, {
    revision: 'HEAD',
  })
  let terminalCommit = existing
  if (!terminalCommit) {
    if ((await requireGitHead(targetDir)) !== plan.head)
      throw new Error('HEAD no longer matches the confirmed parent')
    const preparedPaths = await assertPreparedManifest(targetDir, plan)
    const journal = await readJson(journalPath)
    if (journal?.prepared_paths)
      assertSamePaths(preparedPaths, journal.prepared_paths, 'Prepared journal path manifest')
    if (
      journal?.draft_commit &&
      journal.prepared_digest === (await pathStateDigest(targetDir, plan.owned_paths))
    ) {
      if ((await firstParent(targetDir, journal.draft_commit)) !== plan.head)
        throw new Error('prepared draft parent changed')
      assertSamePaths(
        await gitChangedPathsAtCommit(targetDir, journal.draft_commit),
        preparedPaths,
        'Prepared draft commit'
      )
      await gitTextStrict(targetDir, ['update-ref', 'HEAD', journal.draft_commit, plan.head])
      await synchronizeIndexPaths(targetDir, preparedPaths, journal.draft_commit)
      terminalCommit = journal.draft_commit
    } else {
      const delivery = await commitExactDelivery(targetDir, {
        expectedHead: plan.head,
        paths: preparedPaths,
        subject: `specdev(assignment): close unsupported ${status.id}`,
        trailers: {
          'SpecDev-Assignment': status.id,
          'SpecDev-Commit-Type': COMMIT_TYPE,
          'SpecDev-Disposition': 'unsupported',
          'SpecDev-Contract': plan.contract.hash,
        },
        finalizeDraft: async ({ commit, committedPaths }) => {
          assertSamePaths(committedPaths, preparedPaths, 'Prepared terminal commit')
          const current = (await readJson(journalPath)) || {}
          await writeJournal(journalPath, { ...current, draft_commit: commit })
        },
      })
      terminalCommit = delivery.commit
    }
  }
  const verification = await verifyUnsupportedCommit(
    targetDir,
    specdevPath,
    resolved,
    status,
    plan,
    terminalCommit
  )
  await writeJournal(journalPath, {
    version: JOURNAL_VERSION,
    phase: 'published',
    plan,
    terminal_commit: terminalCommit,
    published_at: new Date().toISOString(),
    verification,
  })
  return closePayload(targetDir, resolved, status, plan, terminalCommit, verification, idempotent)
}

async function recoverUnsupportedClose(targetDir, specdevPath, resolved, status, journal) {
  if (!status.unsupported || status.unsupported.disposition !== 'unsupported')
    throw new Error('terminal status has no canonical unsupported record')
  const existing = await findCommitByTrailer(targetDir, 'SpecDev-Assignment', status.id, {
    revision: 'HEAD',
  })
  const plan = journal?.plan || status.unsupported.plan
  if (!plan || plan.digest !== status.unsupported.repository?.plan_digest)
    throw new Error('recovery authority is missing or does not match status.json')
  const { digest: recordedDigest, ...planFacts } = plan
  if (digest(planFacts) !== recordedDigest)
    throw new Error('canonical unsupported plan digest does not match its recorded facts')
  if (existing)
    return publishUnsupportedState(
      targetDir,
      specdevPath,
      resolved,
      status,
      plan,
      closeJournalPath(specdevPath, status.id),
      true
    )
  if (!['authority_confirmed', 'prepared'].includes(journal?.phase))
    throw new Error(
      `closure journal is ${journal?.phase || 'invalid'} but no terminal commit exists`
    )
  const prepared =
    journal.phase === 'prepared'
      ? status
      : await prepareUnsupportedState(
          targetDir,
          specdevPath,
          resolved,
          status,
          plan,
          closeJournalPath(specdevPath, status.id)
        )
  return publishUnsupportedState(
    targetDir,
    specdevPath,
    resolved,
    prepared,
    plan,
    closeJournalPath(specdevPath, status.id),
    true
  )
}

async function verifyUnsupportedCommit(targetDir, specdevPath, resolved, status, plan, commit) {
  if ((await firstParent(targetDir, commit)) !== plan.head)
    throw new Error('terminal commit parent does not match the confirmed HEAD')
  const committedPaths = await gitChangedPathsAtCommit(targetDir, commit)
  assertPreparedPathSet(committedPaths, plan, 'Terminal commit')
  const message = await gitText(targetDir, ['show', '-s', '--format=%B', commit])
  for (const trailer of [
    `SpecDev-Assignment: ${status.id}`,
    `SpecDev-Commit-Type: ${COMMIT_TYPE}`,
    'SpecDev-Disposition: unsupported',
    `SpecDev-Contract: ${plan.contract.hash}`,
  ]) {
    if (!message.split(/\r?\n/).includes(trailer))
      throw new Error(`terminal commit is missing trailer ${trailer}`)
  }
  const repoStatus = relativeToRepo(targetDir, join(resolved.path, 'status.json'))
  const committedStatus = JSON.parse(
    await gitTextStrict(targetDir, ['show', `${commit}:${repoStatus}`])
  )
  if (
    committedStatus.status !== 'unsupported' ||
    committedStatus.unsupported?.repository?.plan_digest !== plan.digest
  ) {
    throw new Error('committed status.json disagrees with the unsupported closure plan')
  }
  const artifact = relativeToRepo(targetDir, join(resolved.path, 'unsupported.md'))
  const committedArtifact = await gitTextStrict(targetDir, ['show', `${commit}:${artifact}`])
  for (const fact of [
    plan.digest,
    plan.contract.hash,
    plan.reason,
    ...plan.evidence.map((item) => item.digest),
  ]) {
    if (!committedArtifact.includes(fact))
      throw new Error('committed unsupported.md disagrees with closure provenance')
  }
  if (await fse.pathExists(runDir(specdevPath, status.run_id)))
    throw new Error('Assignment runtime still exists after terminal publication')
  const focus = await readCurrentFocus(specdevPath)
  if (focus?.kind === 'assignment' && focus.id === String(status.id))
    throw new Error('closed Assignment remains the active focus')
  return {
    parent: plan.head,
    committed_paths: committedPaths,
    runtime_compacted: true,
    focus_cleared: true,
  }
}

async function inspectEvidence(targetDir, resolved, requested, head) {
  const assignmentRoot = `${relativeToRepo(targetDir, resolved.path)}/`
  const evidence = []
  for (const path of requested) {
    const absolute = join(targetDir, path)
    const stat = await fse.stat(absolute).catch(() => null)
    if (!stat?.isFile()) throw new Error(`Evidence file is missing or not a regular file: ${path}`)
    if (
      path === `${assignmentRoot}brainstorm/contract.md` ||
      path === `${assignmentRoot}status.json` ||
      path === `${assignmentRoot}unsupported.md`
    ) {
      throw new Error(
        `Evidence must be a written investigation result, not lifecycle authority: ${path}`
      )
    }
    const bytes = await fse.readFile(absolute)
    if (bytes.length === 0) throw new Error(`Evidence file is empty: ${path}`)
    if (bytes.includes(0) || !bytes.toString('utf8').trim())
      throw new Error(`Evidence must be non-empty written text: ${path}`)
    const headBytes = await gitObjectBytes(targetDir, `${head}:${path}`)
    const trackedAtHead =
      headBytes !== null &&
      createHash('sha256').update(headBytes).digest('hex') ===
        createHash('sha256').update(bytes).digest('hex')
    evidence.push({
      path,
      digest: createHash('sha256').update(bytes).digest('hex'),
      source: trackedAtHead ? head : 'working-tree',
    })
  }
  return evidence
}

async function assertPlanEvidence(targetDir, plan) {
  const current = await inspectEvidence(
    targetDir,
    { path: join(targetDir, plan.assignment.path) },
    plan.evidence.map((item) => item.path),
    plan.head
  )
  if (digest(current) !== digest(plan.evidence))
    throw new Error('evidence identity changed after the displayed plan')
}

async function inspectAttempts(specdevPath, assignmentName) {
  const records = await listAttemptRecords(specdevPath, { assignment: assignmentName })
  const blocking = []
  const stale = []
  for (const attempt of records.filter((item) => item.status === 'running')) {
    const liveness = await attemptLiveness(specdevPath, attempt.id)
    if (liveness.state === 'stale') stale.push(attempt.id)
    else blocking.push(`${attempt.id} (${liveness.state})`)
  }
  return { records, blocking, stale }
}

async function prospectiveTrackedEffects(targetDir, specdevPath, resolved, status, attempts) {
  const candidates = [
    '.specdev/.current',
    '.specdev/.ripplegraph/current.json',
    relativeToRepo(targetDir, runDir(specdevPath, status.run_id)),
    ...attempts.map((attempt) => `.specdev/processes/${attempt.id}.yaml`),
  ]
  const tracked = new Set()
  for (const candidate of candidates) {
    const output = await gitText(targetDir, ['ls-files', '-z', '--', candidate])
    for (const path of output.split('\0').filter(Boolean)) tracked.add(path)
  }
  tracked.add(relativeToRepo(targetDir, join(resolved.path, 'status.json')))
  tracked.add(relativeToRepo(targetDir, join(resolved.path, 'unsupported.md')))
  return [...tracked]
}

function classifyDirtyPath(path, resolved, status, evidence, head, attempts) {
  const normalizedAssignmentRoot = `.specdev/assignments/${resolved.name}/`
  if (path.startsWith(normalizedAssignmentRoot)) return { owned: true }
  if (path === '.specdev/.current') return { transient: true }
  if (['.specdev/.id-counters.json', '.specdev/.ripplegraph/current.json'].includes(path))
    return { owned: true }
  if (path.startsWith(`.specdev/.ripplegraph/runs/${status.run_id}/`)) return { transient: true }
  if (attempts.some((attempt) => path === `.specdev/processes/${attempt.id}.yaml`))
    return { transient: true }
  if (evidence.some((item) => item.path === path && item.source === 'working-tree'))
    return { owned: true }
  if (!path.startsWith('.specdev/') && status.git_boundary?.starting_git_commit_hash === head)
    return { owned: true }
  const callable = concurrentCallablePathDetails(path)
  if (callable) return { owned: false, detail: callable }
  const assignment = path.match(/^\.specdev\/assignments\/(\d{5})_/)
  if (assignment)
    return {
      owned: false,
      detail: {
        owner: `Assignment ${assignment[1]}`,
        reason: 'owned_by_other_assignment',
        next_action: `Finish or separately preserve Assignment ${assignment[1]} before adopting this path.`,
      },
    }
  const mission = path.match(/^\.specdev\/missions\/(M\d{5})_/)
  if (mission)
    return {
      owned: false,
      detail: {
        owner: `Mission ${mission[1]}`,
        reason: 'owned_by_mission',
        next_action: `Use specdev mission status ${mission[1]} to resolve this path.`,
      },
    }
  return {
    owned: false,
    detail: {
      owner: path.startsWith('.specdev/')
        ? 'other SpecDev workflow state'
        : 'unattributed repository work',
      reason: 'outside_assignment_authority',
      next_action:
        'Inspect and separately checkpoint or preserve this path; unsupported closure will leave it untouched.',
    },
  }
}

async function assertPreparedManifest(targetDir, plan) {
  if ((await requireGitHead(targetDir)) !== plan.head)
    throw new Error('HEAD changed after unsupported-close confirmation')
  const dirty = (await gitStatusEntries(targetDir)).map((entry) => entry.path)
  const actualOwned = dirty.filter((path) => plan.owned_paths.includes(path)).sort()
  assertPreparedPathSet(actualOwned, plan, 'Prepared owned path manifest')
  const unexpected = dirty.filter(
    (path) =>
      !plan.owned_paths.includes(path) && !plan.excluded_paths.some((item) => item.path === path)
  )
  if (unexpected.length > 0)
    throw new Error(`path manifest changed after confirmation; new paths: ${unexpected.join(', ')}`)
  const missingExcluded = plan.excluded_paths
    .map((item) => item.path)
    .filter((path) => !dirty.includes(path))
  if (missingExcluded.length > 0)
    throw new Error(
      `excluded path manifest changed after confirmation; missing: ${missingExcluded.join(', ')}`
    )
  const retainedRuntime = plan.compacted_paths.filter((path) => dirty.includes(path))
  if (retainedRuntime.length > 0)
    throw new Error(`owned runtime compaction is incomplete: ${retainedRuntime.join(', ')}`)
  return actualOwned
}

function renderUnsupportedArtifact(status, unsupported) {
  const evidence = unsupported.evidence
    .map(
      (item) =>
        `- \`${item.path}\` — SHA-256 \`${item.digest}\` (${item.source === 'working-tree' ? 'closing candidate' : `observed at ${item.source}`})`
    )
    .join('\n')
  const owned = unsupported.owned_paths.map((path) => `- \`${path}\``).join('\n')
  return `# Unsupported Assignment closure\n\n- Assignment: ${status.id}\n- Disposition: unsupported (terminal and immutable)\n- Closed at: ${unsupported.closed_at}\n- Reason: ${unsupported.reason}\n- Approved contract: \`${unsupported.contract.path}\`\n- Contract SHA-256: \`${unsupported.contract.hash}\`\n- Prior lifecycle: ${unsupported.prior_lifecycle.status} (run ${unsupported.prior_lifecycle.run_id}; ${unsupported.prior_lifecycle.run_status})\n- Repository boundary: parent \`${unsupported.repository.parent}\` on ${unsupported.repository.branch || '(detached HEAD)'}\n- Plan digest: \`${unsupported.repository.plan_digest}\`\n\n## Investigation evidence\n\n${evidence}\n\n## Owned terminal manifest\n\n${owned}\n\n## Conclusion\n\n${unsupported.reason}\n\nThis negative finding records the observed provider or constraint boundary at closure time. It is historical context only and grants no authority to a successor.\n`
}

function closePayload(targetDir, resolved, status, plan, commit, verification, idempotent) {
  return {
    command: 'assignment-close',
    version: 1,
    status: 'unsupported',
    disposition: 'unsupported',
    id: String(status.id),
    name: resolved.name,
    path: relativeToRepo(targetDir, resolved.path),
    immutable: true,
    reason: plan.reason,
    evidence: plan.evidence,
    plan_digest: plan.digest,
    repository: {
      parent: plan.head,
      terminal_commit: commit,
      committed_paths: verification.committed_paths,
    },
    runtime_compaction: { compacted: verification.runtime_compacted, run_id: status.run_id },
    focus_cleared: verification.focus_cleared,
    scheduler: 'idle',
    remaining_dirt: plan.excluded_paths,
    idempotent,
    next_actions: [
      'specdev status --history',
      `specdev assignment --from-assignment=${status.id}`,
      'specdev adhoc start "<bounded change>"',
      'specdev do "<intent>"',
    ],
  }
}

function planPayload(plan, stale = false, problem = null) {
  return {
    command: 'assignment-close',
    version: 1,
    state: stale ? 'plan_changed' : 'confirmation_required',
    disposition: 'unsupported',
    problem: problem || 'Inspect the exact plan, then explicitly authorize its owned snapshot.',
    plan,
    confirmation: {
      decision: 'snapshot=owned',
      command_line: recoveryCommand(
        plan.assignment.id,
        plan.reason,
        plan.evidence.map((item) => item.path)
      ),
    },
  }
}

function recoveryCommand(id, reason = null, evidence = []) {
  const parts = [`specdev assignment close ${id}`, '--outcome=unsupported']
  if (reason) parts.push(`--reason="${shellDoubleQuoted(reason)}"`)
  if (evidence.length > 0) parts.push(`--evidence=${evidence.map(shellFlagValue).join(',')}`)
  if (reason) parts.push('--snapshot=owned')
  return parts.join(' ')
}

function parseEvidenceFlag(value) {
  if (typeof value !== 'string') return []
  const paths = [
    ...new Set(
      value
        .split(',')
        .map((item) => normalizeRepoPath(item.trim()))
        .filter(Boolean)
    ),
  ]
  if (paths.length > 12)
    throw new Error('--evidence accepts at most 12 comma-separated repository files')
  return paths
}

function normalizeRepoPath(value) {
  const path = String(value || '').replaceAll('\\', '/')
  if (
    !path ||
    path.startsWith('/') ||
    /^[A-Za-z]:\//.test(path) ||
    path.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error(
      `Evidence path must be a safe repository-relative path: ${JSON.stringify(value)}`
    )
  }
  return path
}

function requiredFlag(value, name) {
  if (typeof value !== 'string' || !value.trim()) return null
  if (value.length > 1000) throw new Error(`${name} is too long`)
  if (/\p{Cc}/u.test(value)) throw new Error(`${name} cannot contain control characters`)
  return value.trim()
}

function assertExactRetry(flags, status) {
  if (typeof flags.reason === 'string' && flags.reason.trim() !== status.unsupported?.reason) {
    throw new Error('retry reason differs from the immutable unsupported closure')
  }
  if (flags.evidence !== undefined) {
    const requested = parseEvidenceFlag(flags.evidence)
    const recorded = (status.unsupported?.evidence || []).map((item) => item.path).sort()
    assertSamePaths(requested, recorded, 'Retry evidence path set')
  }
}

function closeJournalPath(specdevPath, id) {
  return join(specdevPath, 'cache', 'assignment-close', `${id}.json`)
}
async function readJson(path) {
  return fse.readJson(path).catch(() => null)
}
async function writeJournal(path, value) {
  await fse.ensureDir(join(path, '..'))
  const temporary = `${path}.tmp-${process.pid}`
  await fse.writeJson(temporary, value, { spaces: 2 })
  await fse.move(temporary, path, { overwrite: true })
}
function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

async function pathStateDigest(targetDir, paths) {
  const hash = createHash('sha256')
  for (const path of paths) {
    hash.update(path)
    hash.update('\0')
    const bytes = await fse
      .readFile(join(targetDir, path))
      .catch((error) => (error?.code === 'ENOENT' ? null : Promise.reject(error)))
    hash.update(bytes === null ? '<deleted>' : bytes)
    hash.update('\0')
  }
  return hash.digest('hex')
}

function assertSamePaths(actual, expected, label) {
  const left = [...new Set(actual)].sort()
  const right = [...new Set(expected)].sort()
  const missing = right.filter((path) => !left.includes(path))
  const unexpected = left.filter((path) => !right.includes(path))
  if (missing.length || unexpected.length) {
    const error = new Error(
      `${label} mismatch; missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'}`
    )
    error.code = 'exact_path_mismatch'
    throw error
  }
}

function assertPreparedPathSet(actual, plan, label) {
  const paths = [...new Set(actual)].sort()
  const present = new Set(paths)
  const allowed = new Set(plan.owned_paths)
  const mayBeUnchanged = new Set(plan.prospective_paths || [])
  const missing = plan.owned_paths.filter((path) => !present.has(path) && !mayBeUnchanged.has(path))
  const unexpected = paths.filter((path) => !allowed.has(path))
  if (missing.length > 0 || unexpected.length > 0) {
    const error = new Error(
      `${label} mismatch; missing required: ${missing.join(', ') || 'none'}; unauthorized: ${unexpected.join(', ') || 'none'}`
    )
    error.code = 'exact_path_mismatch'
    throw error
  }
}

async function gitText(targetDir, args) {
  try {
    return (await execFile('git', args, { cwd: targetDir, encoding: 'utf-8' })).stdout.trim()
  } catch {
    return ''
  }
}
async function gitTextStrict(targetDir, args) {
  try {
    return (await execFile('git', args, { cwd: targetDir, encoding: 'utf-8' })).stdout
  } catch (error) {
    throw new Error(String(error.stderr || error.message).trim())
  }
}
async function gitObjectExists(targetDir, object) {
  try {
    await execFile('git', ['cat-file', '-e', object], { cwd: targetDir, encoding: 'utf-8' })
    return true
  } catch {
    return false
  }
}
async function gitObjectBytes(targetDir, object) {
  try {
    return (
      await execFile('git', ['show', object], {
        cwd: targetDir,
        encoding: 'buffer',
        maxBuffer: 4 * 1024 * 1024,
      })
    ).stdout
  } catch {
    return null
  }
}
function shellDoubleQuoted(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}
function shellFlagValue(value) {
  return /^[A-Za-z0-9_./-]+$/.test(value) ? value : `"${shellDoubleQuoted(value)}"`
}

function emit(flags, payload) {
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else {
    console.log(`Assignment ${payload.id} is unsupported and immutable.`)
    console.log(`Terminal commit: ${payload.repository.terminal_commit}`)
    console.log(`Remaining dirt: ${payload.remaining_dirt.length}`)
    for (const item of payload.remaining_dirt)
      console.log(`  ${item.path} — ${item.owner}; ${item.next_action}`)
    console.log(`Next: ${payload.next_actions[0]}`)
  }
  return payload
}

function blocked(flags, payload) {
  if (flags.json) console.log(JSON.stringify({ ...payload, status: 'blocked' }, null, 2))
  else {
    console.error(payload.problem)
    console.error(`HEAD: ${payload.plan.head}`)
    console.error(
      `Assignment-owned paths (${payload.plan.owned_paths.length}): ${payload.plan.owned_paths.join(', ')}`
    )
    console.error(
      `Owned runtime paths to compact (${payload.plan.compacted_paths.length}): ${payload.plan.compacted_paths.join(', ')}`
    )
    console.error(
      `Evidence: ${payload.plan.evidence.map((item) => `${item.path} (${item.digest})`).join(', ')}`
    )
    console.error(`Excluded paths (${payload.plan.excluded_paths.length}):`)
    for (const item of payload.plan.excluded_paths)
      console.error(`  ${item.path} — ${item.owner}; ${item.next_action}`)
    console.error(`Terminal action: ${payload.plan.terminal_action}`)
    console.error(`Rerun: ${payload.confirmation.command_line}`)
  }
  process.exitCode = 1
  return payload
}

function fail(flags, message) {
  if (flags.json)
    console.log(
      JSON.stringify(
        { command: 'assignment-close', version: 1, status: 'error', error: message },
        null,
        2
      )
    )
  else console.error(message)
  process.exitCode = 1
  return null
}
