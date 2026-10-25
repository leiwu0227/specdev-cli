import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { basename, dirname, join, relative, resolve } from 'node:path'
import fse from 'fs-extra'
import { abandonRun, readCheckpoint, readCurrent } from 'ripplegraph'
import { buildClosePlan, inspectAttempts } from './assignment-close.js'
import { resolveAssignmentSelector } from '../utils/assignment.js'
import { buildStandaloneAssignmentCandidateReceipt } from '../utils/assignment-delivery.js'
import { readCurrentFocus, clearCurrent } from '../utils/current.js'
import { missionPathDigest } from '../utils/mission-ownership.js'
import { updateAttemptRecord } from '../utils/process-record.js'
import {
  commitExactDelivery,
  findCommitByTrailer,
  firstParent,
  gitChangedPathsAtCommit,
  gitStatusEntries,
  requireGitHead,
  currentGitBranch,
  synchronizeIndexPaths,
} from '../utils/git-delivery.js'

const execFile = promisify(execFileCallback)
const OUTCOME = 'accepted-with-limitations'
const hash = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value))
    .digest('hex')
const same = (left, right) => hash(left) === hash(right)
async function atomicJson(path, value) {
  const temporary = resolve(
    dirname(path),
    '../../cache/assignment-closures',
    `${basename(dirname(path))}-status.tmp`
  )
  await fse.outputJson(temporary, value, { spaces: 2 })
  await fse.move(temporary, path, { overwrite: true })
}

export async function closeAcceptedAssignment(targetDir, specdevPath, selector, flags) {
  try {
    const resolved = await resolveAssignmentSelector(specdevPath, String(selector || ''))
    if (!resolved || resolved.ambiguous) throw new Error('Assignment not found or ambiguous')
    const status = await fse.readJson(join(resolved.path, 'status.json'))
    if (status.mission)
      throw new Error('Mission children cannot close independently; use Mission closure')
    const source =
      typeof flags.evidence === 'string'
        ? relative(targetDir, resolve(targetDir, flags.evidence)).replaceAll('\\', '/')
        : ''
    if (!source || source.startsWith('../') || source.startsWith('.specdev/cache/'))
      throw new Error(
        'Provide --evidence=<durable repository acceptance-note> with explicit user acceptance and limitations'
      )
    const context = { targetDir, specdevPath, resolved }
    if (['closing', 'closed'].includes(status.status)) {
      const closure = status.closure
      if (
        closure?.outcome !== OUTCOME ||
        flags.confirm !== closure.plan.digest ||
        source !== closure.plan.evidence_source
      )
        throw new Error('Retry requires the exact acceptance note path and confirmed plan digest')
      validatePlan(closure.plan)
      if (status.status === 'closing') await apply(context, closure)
      return emit(flags, await publish(context, true))
    }
    if (['completed', 'abandoned', 'shelved', 'unsupported'].includes(status.status))
      throw new Error(`Assignment is ${status.status} and immutable`)
    if (
      !status.git_boundary?.starting_git_commit_hash ||
      !(await fse.pathExists(join(resolved.path, 'implementation', 'progress.json')))
    )
      throw new Error(
        'Accepted delivery requires an implementation candidate; use shelving or unsupported closure before implementation'
      )
    if (
      source.startsWith('.specdev/') &&
      !source.startsWith(`${relative(targetDir, resolved.path)}/`)
    )
      throw new Error(
        'Acceptance note must belong to this Assignment or be a repository product path'
      )
    const notePath = join(targetDir, source)
    if ((await fse.realpath(notePath)) !== join(await fse.realpath(targetDir), source))
      throw new Error('Acceptance note cannot traverse symlinks')
    const stat = await fse.lstat(notePath)
    if (!stat.isFile() || stat.size > 128 * 1024)
      throw new Error('Acceptance note must be a regular text file of at most 128 KiB')
    const note = await fse.readFile(notePath, 'utf8')
    if (!note.trim() || note.includes('\0'))
      throw new Error('Acceptance note must contain written user acceptance and limitations')
    const plan = await planClosure(context, status, source, note)
    if (!flags.confirm)
      return emit(flags, {
        command: 'assignment-close',
        status: 'confirmation_required',
        mutated: false,
        plan,
        next_action:
          'Obtain explicit user acceptance of this candidate and its limitations, then repeat with --confirm=<plan-digest>.',
      })
    if (flags.confirm !== plan.digest)
      throw new Error(
        'Stale closure confirmation; preview the current candidate and obtain user acceptance again'
      )
    if ((await planClosure(context, status, source, note)).digest !== plan.digest)
      throw new Error('Closure state changed before confirmation')
    const closure = { outcome: OUTCOME, confirmed_at: new Date().toISOString(), plan }
    await atomicJson(join(resolved.path, 'status.json'), terminalStatus(closure, 'closing'))
    await apply(context, closure)
    return emit(flags, await publish(context, false))
  } catch (error) {
    process.exitCode = 1
    return emit(flags, { command: 'assignment-close', status: 'error', error: error.message })
  }
}

async function planClosure(context, status, source, note) {
  const { targetDir, specdevPath, resolved } = context
  const base = await buildClosePlan(
    targetDir,
    specdevPath,
    resolved,
    status,
    'User accepts delivery with documented limitations',
    [source],
    { retainRuntime: true }
  )
  if (status.mission) throw new Error('Mission children cannot close independently')
  const candidate = await buildStandaloneAssignmentCandidateReceipt({
    targetDir,
    assignmentPath: resolved.path,
    assignmentStatus: status,
  })
  if (candidate.completeness === 'complete')
    throw new Error(
      'Acceptance evidence is complete; continue normal implementation review and verified delivery'
    )
  const checkpoint = readCheckpoint(specdevPath, status.run_id)
  if (
    !['design', 'implementation', 'implementation-review', 'repair'].includes(
      checkpoint.position.node
    )
  )
    throw new Error('Closure requires an approved implementation candidate')
  const attempts = await inspectAttempts(specdevPath, resolved.name)
  if (attempts.records.some((record) => record.mission))
    throw new Error('Attempt ownership is ambiguous')
  const closurePath = relative(targetDir, join(resolved.path, 'closure.md'))
  if (await fse.pathExists(join(targetDir, closurePath)))
    throw new Error('An existing closure artifact must not be overwritten')
  const mutable = [
    relative(targetDir, join(resolved.path, 'status.json')),
    closurePath,
    '.specdev/.current',
    '.specdev/.ripplegraph/current.json',
    `.specdev/.ripplegraph/runs/${status.run_id}/checkpoint.json`,
    `.specdev/.ripplegraph/runs/${status.run_id}/transition-log.jsonl`,
    ...attempts.stale.map((id) => `.specdev/processes/${id}.yaml`),
  ]
  const files = await snapshot(context, status, attempts.records)
  const ownedPaths = [
    ...new Set([
      ...base.owned_paths,
      ...mutable,
      ...Object.keys(files).filter(
        (path) =>
          path.startsWith(`${base.assignment.path}/`) ||
          path.startsWith(`.specdev/.ripplegraph/runs/${status.run_id}/`) ||
          attempts.records.some((record) => path === `.specdev/processes/${record.id}.yaml`)
      ),
    ]),
  ].sort()
  const facts = {
    version: 1,
    outcome: OUTCOME,
    assignment: base.assignment,
    source_status: status,
    source_lifecycle: base.source_lifecycle,
    contract: base.contract,
    head: base.head,
    branch: base.branch,
    evidence_source: source,
    evidence: { text: note, sha256: hash(note) },
    candidate,
    review: {
      claim: 'No review approval is granted by closure',
      existing_verdict: await fse
        .readFile(join(resolved.path, 'review', 'implementation-verdict.md'), 'utf8')
        .catch((error) => {
          if (error.code === 'ENOENT') return null
          throw error
        }),
    },
    checkpoint,
    transition_log: await fse.readFile(
      join(specdevPath, '.ripplegraph', 'runs', status.run_id, 'transition-log.jsonl'),
      'utf8'
    ),
    attempts: attempts.records,
    stale_attempts: attempts.stale,
    owned_paths: ownedPaths,
    mutable_paths: mutable,
    files,
    excluded_paths: base.excluded_paths,
    effects: [
      'Record user-accepted delivery without verified completion or review approval',
      'Retain implementation, contracts, failures, missing evidence, reviews, and runtime history',
      'Stop owned execution and release focus using lifecycle APIs',
      'Commit the exact confirmed owned candidate and closure records; leave unrelated dirt untouched',
    ],
  }
  return { ...facts, digest: hash(facts) }
}

async function snapshot({ targetDir, specdevPath, resolved }, status, attempts) {
  const paths = new Set((await gitStatusEntries(targetDir)).map((entry) => entry.path))
  async function visit(path) {
    const stat = await fse.lstat(path)
    if (stat.isSymbolicLink())
      throw new Error(`Workflow closure artifacts cannot be symlinks: ${path}`)
    if (stat.isDirectory()) {
      for (const name of (await fse.readdir(path)).sort()) await visit(join(path, name))
    } else if (stat.isFile()) paths.add(relative(targetDir, path).replaceAll('\\', '/'))
    else throw new Error(`Unsupported closure artifact: ${path}`)
  }
  await visit(resolved.path)
  await visit(join(specdevPath, '.ripplegraph', 'runs', status.run_id))
  for (const attempt of attempts) paths.add(`.specdev/processes/${attempt.id}.yaml`)
  paths.add('.specdev/.current')
  paths.add('.specdev/.ripplegraph/current.json')
  return Object.fromEntries(
    await Promise.all(
      [...paths].sort().map(async (path) => [path, await fileIdentity(targetDir, path)])
    )
  )
}

async function fileIdentity(targetDir, path) {
  // The common product-path digest includes executable bits and symbolic-link targets.
  if (!path.startsWith('.specdev/')) return missionPathDigest(targetDir, path)
  try {
    const stat = await fse.lstat(join(targetDir, path))
    if (!stat.isFile()) throw new Error(`Expected regular workflow file: ${path}`)
    return hash(await fse.readFile(join(targetDir, path)))
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}
function validatePlan(plan) {
  const { digest, ...facts } = plan
  if (hash(facts) !== digest || plan.outcome !== OUTCOME)
    throw new Error('Invalid canonical closure plan')
}
function terminalStatus(closure, status) {
  return {
    ...closure.plan.source_status,
    status,
    disposition: OUTCOME,
    verification: 'incomplete',
    closure,
  }
}

async function apply(context, closure) {
  const { targetDir, specdevPath, resolved } = context
  const { plan } = closure
  validatePlan(plan)
  if (
    (await requireGitHead(targetDir)) !== plan.head ||
    (await currentGitBranch(targetDir)) !== plan.branch
  )
    throw new Error('Closure recovery candidate or branch changed')
  const statusPath = join(resolved.path, 'status.json')
  if (!same(await fse.readJson(statusPath), terminalStatus(closure, 'closing')))
    throw new Error('Closure status changed')
  const attempts = await inspectAttempts(specdevPath, resolved.name)
  if (
    attempts.blocking.length ||
    !same(
      attempts.records.map((record) => record.id),
      plan.attempts.map((record) => record.id)
    )
  )
    throw new Error('Closure Attempt ownership or liveness changed')
  for (const current of attempts.records) {
    const original = plan.attempts.find((record) => record.id === current.id)
    if (
      !same(current, original) &&
      !(
        plan.stale_attempts.includes(current.id) &&
        current.status === 'interrupted' &&
        current.closure_plan === plan.digest
      )
    )
      throw new Error('Attempt changed during closure')
  }
  const currentFiles = await snapshot(context, plan.source_status, attempts.records)
  const mutable = new Set(plan.mutable_paths)
  for (const path of new Set([...Object.keys(plan.files), ...Object.keys(currentFiles)])) {
    if (!mutable.has(path) && (currentFiles[path] ?? null) !== (plan.files[path] ?? null))
      throw new Error(`Retained candidate or evidence changed: ${path}`)
  }
  const focus = await readCurrentFocus(specdevPath)
  if (focus && (focus.kind !== 'assignment' || focus.id !== plan.assignment.id))
    throw new Error('Another workflow owns focus')
  const checkpoint = readCheckpoint(specdevPath, plan.source_status.run_id)
  const { status: oldStatus, updatedAt: oldTime, ...oldCheckpoint } = plan.checkpoint
  const { status: runStatus, updatedAt: newTime, ...rest } = checkpoint
  if (!same(oldCheckpoint, rest) || !['active', 'abandoned'].includes(runStatus))
    throw new Error('Runtime changed during closure')
  const runtimeFocus = readCurrent(specdevPath).focusedRunId
  if (runtimeFocus && runtimeFocus !== plan.source_status.run_id)
    throw new Error('Another run owns focus')
  const history = await fse.readFile(
    join(specdevPath, '.ripplegraph', 'runs', plan.source_status.run_id, 'transition-log.jsonl'),
    'utf8'
  )
  if (!history.startsWith(plan.transition_log))
    throw new Error('Runtime history changed during closure')
  const extra = history
    .slice(plan.transition_log.length)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
  if (
    extra.length > 1 ||
    extra.some(
      (entry) =>
        entry.op !== 'abandon' ||
        entry.runId !== plan.source_status.run_id ||
        entry.reason !== closureReason(plan) ||
        !same(entry.from, plan.checkpoint.position) ||
        !same(entry.to, plan.checkpoint.position)
    )
  )
    throw new Error('Unexpected runtime history during closure')
  const artifact = renderClosure(closure)
  const artifactPath = join(resolved.path, 'closure.md')
  if (
    (await fse.pathExists(artifactPath)) &&
    (await fse.readFile(artifactPath, 'utf8')) !== artifact
  )
    throw new Error('Closure artifact changed')
  await fse.writeFile(artifactPath, artifact)
  for (const record of attempts.records)
    if (record.status === 'running')
      await updateAttemptRecord(specdevPath, record.id, {
        status: 'interrupted',
        closure_plan: plan.digest,
      })
  if (runStatus === 'active' || runtimeFocus === plan.source_status.run_id) {
    if (runtimeFocus !== plan.source_status.run_id) throw new Error('Assignment lost runtime focus')
    abandonRun({ workflowRoot: specdevPath, reason: closureReason(plan) })
  }
  if (focus) await clearCurrent(specdevPath)
  const dirty = new Set((await gitStatusEntries(targetDir)).map((entry) => entry.path))
  const ownPath = relative(targetDir, statusPath)
  const preparedFiles = Object.fromEntries(
    await Promise.all(
      plan.owned_paths
        .filter((path) => path !== ownPath && dirty.has(path))
        .map(async (path) => [path, await fileIdentity(targetDir, path)])
    )
  )
  await atomicJson(
    statusPath,
    terminalStatus(
      {
        ...closure,
        prepared_files: preparedFiles,
        retained_files: await snapshot(context, plan.source_status, attempts.records),
      },
      'closed'
    )
  )
}

function closureReason(plan) {
  return `Assignment ${plan.assignment.id} closed ${OUTCOME}; plan ${plan.digest}; verification incomplete`
}

function renderClosure({ plan, confirmed_at }) {
  return `# Assignment closure\n\n- Assignment: ${plan.assignment.id}\n- Outcome: ${OUTCOME}\n- Verification: incomplete; no acceptance or review pass is claimed\n- Confirmed at: ${confirmed_at}\n- Plan digest: ${plan.digest}\n- Approved contract: ${plan.contract.hash}\n- Candidate: ${plan.head} (${plan.candidate.identity})\n- Acceptance source: ${plan.evidence_source}\n- Acceptance SHA-256: ${plan.evidence.sha256}\n\n## User acceptance and limitations\n\n${plan.evidence.text}\n\n## Unresolved evidence\n\n${plan.candidate.issues.map((issue) => `- ${issue}`).join('\n')}\n\nOriginal contracts, outcome results, verification receipts, review records, code, and runtime history remain unchanged. The lifecycle is stopped through abandonment; the delivery outcome is accepted-with-limitations. This is not verified completion.\n`
}

async function publish(context, idempotent) {
  const { targetDir, specdevPath, resolved } = context
  const statusPath = join(resolved.path, 'status.json')
  const statusBytes = await fse.readFile(statusPath)
  const status = JSON.parse(statusBytes)
  const { closure } = status
  const { plan } = closure
  validatePlan(plan)
  if (status.status !== 'closed' || !closure.prepared_files)
    throw new Error('Closure publication is not prepared')
  const paths = [...Object.keys(closure.prepared_files), relative(targetDir, statusPath)].sort()
  if (paths.some((path) => !plan.owned_paths.includes(path)))
    throw new Error('Closure publication exceeds confirmed ownership')
  const receiptPath = join(specdevPath, 'cache', 'assignment-closures', `${plan.digest}.json`)
  const receipt = await fse.readJson(receiptPath).catch((error) => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  let commit = await findCommitByTrailer(targetDir, 'SpecDev-Closure-Plan', plan.digest, {
    revision: 'HEAD',
  })
  const verify = async () => {
    if ((await currentGitBranch(targetDir)) !== plan.branch)
      throw new Error('Closure publication branch changed')
    if (!same(await fse.readFile(statusPath), statusBytes))
      throw new Error('Prepared status changed')
    const currentFiles = await snapshot(context, plan.source_status, plan.attempts)
    for (const path of Object.keys(closure.retained_files))
      currentFiles[path] = await fileIdentity(targetDir, path)
    for (const path of new Set([
      ...Object.keys(closure.retained_files),
      ...Object.keys(currentFiles),
    ])) {
      if (
        path !== relative(targetDir, statusPath) &&
        (currentFiles[path] ?? null) !== (closure.retained_files[path] ?? null)
      )
        throw new Error(`Retained closure path changed: ${path}`)
    }
    for (const [path, identity] of Object.entries(closure.prepared_files))
      if ((await fileIdentity(targetDir, path)) !== identity)
        throw new Error(`Prepared closure path changed: ${path}`)
    if (readCheckpoint(specdevPath, plan.source_status.run_id).status !== 'abandoned')
      throw new Error('Closure runtime is not terminal')
    const focus = await readCurrentFocus(specdevPath)
    if (focus?.kind === 'assignment' && focus.id === plan.assignment.id)
      throw new Error('Assignment retains focus')
  }
  if (!commit) {
    await verify()
    const delivery = await commitExactDelivery(targetDir, {
      expectedHead: plan.head,
      paths,
      subject: `specdev(assignment): accept ${plan.assignment.id} with limitations`,
      trailers: {
        'SpecDev-Assignment': plan.assignment.id,
        'SpecDev-Commit-Type': 'closure',
        'SpecDev-Disposition': OUTCOME,
        'SpecDev-Closure-Plan': plan.digest,
        'SpecDev-Contract': plan.contract.hash,
      },
      finalizeDraft: verify,
    })
    commit = delivery.commit
  } else if (!receipt && (await requireGitHead(targetDir)) === commit) {
    await verify()
    await synchronizeIndexPaths(targetDir, paths, commit)
  }
  if (
    (await firstParent(targetDir, commit)) !== plan.head ||
    !same(await gitChangedPathsAtCommit(targetDir, commit), paths)
  )
    throw new Error('Terminal commit differs from the confirmed parent or paths')
  const committedStatus = (
    await execFile('git', ['show', `${commit}:${relative(targetDir, statusPath)}`], {
      cwd: targetDir,
      maxBuffer: 16 * 1024 * 1024,
    })
  ).stdout
  if (committedStatus !== statusBytes.toString())
    throw new Error('Terminal status differs from its committed record')
  if (!receipt) await fse.outputJson(receiptPath, { commit, plan_digest: plan.digest })
  else if (receipt.commit !== commit || receipt.plan_digest !== plan.digest)
    throw new Error('Closure publication receipt changed')
  return {
    command: 'assignment-close',
    status: 'closed',
    disposition: OUTCOME,
    verification: 'incomplete',
    review: 'not_claimed',
    id: plan.assignment.id,
    immutable: true,
    plan_digest: plan.digest,
    repository: { parent: plan.head, terminal_commit: commit, committed_paths: paths },
    runtime_retained: true,
    focus_cleared: true,
    idempotent,
    remaining_dirt: plan.excluded_paths,
    next_action: 'Start new work with specdev adhoc start "<bounded change>" or a new Assignment.',
  }
}

function emit(flags, payload) {
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else if (payload.error) console.error(payload.error)
  else if (payload.plan) {
    console.log(`Assignment ${payload.plan.assignment.id}: explicit user acceptance required`)
    console.log(`Acceptance note:\n${payload.plan.evidence.text}`)
    console.log(`Candidate: ${payload.plan.head}; contract: ${payload.plan.contract.hash}`)
    console.log(
      `Existing implementation review: ${payload.plan.review.existing_verdict || 'not performed; no verdict record'}`
    )
    console.log(`Incomplete evidence: ${payload.plan.candidate.issues.join(', ')}`)
    console.log(`Owned paths: ${payload.plan.owned_paths.join(', ')}`)
    console.log(
      `Excluded paths: ${payload.plan.excluded_paths.map((item) => item.path).join(', ') || 'none'}`
    )
    console.log(payload.plan.effects.join('\n'))
    console.log(`Confirm: --confirm=${payload.plan.digest}\n${payload.next_action}`)
  } else
    console.log(
      `Assignment ${payload.id}: closed (${OUTCOME}); verification incomplete. Commit: ${payload.repository.terminal_commit}`
    )
  return payload
}
