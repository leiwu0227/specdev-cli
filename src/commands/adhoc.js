import { randomBytes } from 'node:crypto'
import { dirname, join } from 'node:path'
import fse from 'fs-extra'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import {
  commitDelivery,
  currentGitBranch,
  findCommitAddingPath,
  findCommitByTrailer,
  firstParent,
  gitStatusPaths,
  requireGitHead,
  stageAll,
  summarizeGitPaths,
} from '../utils/git-delivery.js'
import { relativeToRepo } from '../utils/assignment-vnext.js'

export async function adhocCommand(positionalArgs = [], flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)
  const [subcommand, ...rest] = positionalArgs

  try {
    if (subcommand === 'start') return startAdhoc(targetDir, specdevPath, rest, flags)
    if (subcommand === 'finish') return finishAdhoc(targetDir, specdevPath, flags)
    if (subcommand === 'status') return statusAdhoc(targetDir, specdevPath, flags)
    if (subcommand === 'show') return showAdhoc(targetDir, specdevPath, rest[0], flags)
    if (subcommand === 'cancel') return cancelAdhoc(specdevPath, flags)
    return fail(
      flags,
      'Usage: specdev adhoc start "<scope>" [--adopt-dirty] | finish --outcome="..." --verification="..." | status | show <ID> | cancel'
    )
  } catch (error) {
    return fail(flags, error.message)
  }
}

async function startAdhoc(targetDir, specdevPath, scopeArgs, flags) {
  const scope = scopeArgs.join(' ').trim()
  if (!scope) return fail(flags, 'Adhoc scope is required')

  const active = await readActive(specdevPath)
  if (active) {
    return blocked(flags, {
      state: 'already_active',
      id: active.id,
      scope: active.scope,
      next_action: 'Finish or cancel the active Adhoc before starting another in this worktree.',
    })
  }

  const startingGitCommitHash = await requireGitHead(targetDir)
  const branch = await currentGitBranch(targetDir)
  const paths = await gitStatusPaths(targetDir)
  const summary = summarizeGitPaths(paths)
  if (paths.length > 0 && !flags['adopt-dirty']) {
    return blocked(flags, {
      state: 'dirty_worktree',
      working_tree: summary,
      interaction: {
        question: 'The worktree already has changes. Decide what they mean before Adhoc starts.',
        options: [
          {
            id: 'inspect',
            label: 'Stop and inspect',
            command: 'git status --short',
            recommended: true,
          },
          {
            id: 'checkpoint',
            label: 'Commit existing work separately, then rerun',
          },
          {
            id: 'adopt',
            label: 'Include every current change in this Adhoc',
            command: `specdev adhoc start ${shellQuote(scope)} --adopt-dirty`,
          },
        ],
      },
    })
  }

  const startedAt = new Date().toISOString()
  const id = createAdhocId(startedAt)
  const receiptRelative = `.specdev/adhoc/${startedAt.slice(0, 7)}/${id}_${slugify(scope)}.md`
  const state = {
    version: 1,
    id,
    scope,
    started_at: startedAt,
    starting_git_commit_hash: startingGitCommitHash,
    starting_branch: branch,
    starting_worktree: paths.length > 0 ? 'adopted' : 'clean',
    adopted_path_count: paths.length,
    receipt: receiptRelative,
  }
  await writeActive(specdevPath, state)
  return emit(flags, {
    command: 'adhoc start',
    version: 1,
    status: 'started',
    id,
    scope,
    starting_worktree: state.starting_worktree,
    adopted_path_count: state.adopted_path_count,
    next_action:
      'Make the bounded change directly. Finish it with specdev adhoc finish --outcome="..." --verification="...".',
  })
}

async function finishAdhoc(targetDir, specdevPath, flags) {
  const active = await readActive(specdevPath)
  if (!active) return fail(flags, 'No active Adhoc exists in this worktree')

  const recoveredCommit = await findCommitByTrailer(targetDir, 'SpecDev-Adhoc', active.id, {
    revision: 'HEAD',
  })
  if (recoveredCommit) {
    await clearActive(specdevPath)
    return completedPayload(targetDir, active, recoveredCommit, flags, true)
  }

  const currentHead = await requireGitHead(targetDir)
  if (currentHead !== active.starting_git_commit_hash) {
    return blocked(flags, {
      state: 'head_changed',
      id: active.id,
      scope: active.scope,
      starting_git_commit_hash: active.starting_git_commit_hash,
      current_git_commit_hash: currentHead,
      next_action:
        'Inspect the intervening commits. Cancel this Adhoc or restore its starting HEAD before finishing; SpecDev will not silently absorb a changed history boundary.',
    })
  }

  const outcome = stringFlag(flags.outcome)
  const verification = stringFlag(flags.verification)
  if (!outcome || !verification) {
    return fail(flags, 'Both --outcome="..." and --verification="..." are required')
  }

  const currentPaths = await gitStatusPaths(targetDir)
  if (currentPaths.length === 0) {
    return blocked(flags, {
      state: 'no_changes',
      id: active.id,
      scope: active.scope,
      next_action: 'Make the bounded repository change, or cancel this empty Adhoc.',
    })
  }

  const receiptPath = join(targetDir, active.receipt)
  if (!(await fse.pathExists(receiptPath))) {
    await fse.ensureDir(dirname(receiptPath))
    await fse.writeFile(
      receiptPath,
      receiptMarkdown({ ...active, outcome, verification, completed_at: new Date().toISOString() }),
      'utf-8'
    )
  }

  await stageAll(targetDir)
  const endingGitCommitHash = await commitDelivery(targetDir, {
    subject: stringFlag(flags.message) || `specdev(adhoc): ${active.scope.slice(0, 68)}`,
    trailers: {
      'SpecDev-Adhoc': active.id,
      'SpecDev-Commit-Type': 'delivery',
    },
  })
  await clearActive(specdevPath)
  return completedPayload(targetDir, active, endingGitCommitHash, flags, false)
}

async function statusAdhoc(targetDir, specdevPath, flags) {
  const active = await readActive(specdevPath)
  if (!active) return emit(flags, { command: 'adhoc status', version: 1, status: 'idle' })
  const currentHead = await requireGitHead(targetDir)
  return emit(flags, {
    command: 'adhoc status',
    version: 1,
    status: currentHead === active.starting_git_commit_hash ? 'active' : 'blocked',
    state: currentHead === active.starting_git_commit_hash ? 'working' : 'head_changed',
    id: active.id,
    scope: active.scope,
    starting_worktree: active.starting_worktree,
    changed_paths: summarizeGitPaths(await gitStatusPaths(targetDir)),
  })
}

async function showAdhoc(targetDir, specdevPath, id, flags) {
  if (!id) return fail(flags, 'Usage: specdev adhoc show <ID>')
  const receiptPath = await findReceipt(specdevPath, id)
  if (!receiptPath) return fail(flags, `Adhoc receipt not found: ${id}`)
  const receiptRelative = relativeToRepo(targetDir, receiptPath)
  const endingGitCommitHash =
    (await findCommitByTrailer(targetDir, 'SpecDev-Adhoc', id)) ||
    (await findCommitAddingPath(targetDir, receiptRelative))
  const startingGitCommitHash = endingGitCommitHash
    ? await firstParent(targetDir, endingGitCommitHash)
    : null
  return emit(flags, {
    command: 'adhoc show',
    version: 1,
    status: endingGitCommitHash ? 'completed' : 'receipt_uncommitted',
    id,
    receipt: receiptRelative,
    starting_git_commit_hash: startingGitCommitHash,
    ending_git_commit_hash: endingGitCommitHash,
  })
}

async function cancelAdhoc(specdevPath, flags) {
  const active = await readActive(specdevPath)
  if (!active) return emit(flags, { command: 'adhoc cancel', version: 1, status: 'idle' })
  await clearActive(specdevPath)
  return emit(flags, {
    command: 'adhoc cancel',
    version: 1,
    status: 'cancelled',
    id: active.id,
    source_changes: 'left_untouched',
  })
}

async function completedPayload(targetDir, active, endingGitCommitHash, flags, recovered) {
  const startingGitCommitHash = await firstParent(targetDir, endingGitCommitHash)
  return emit(flags, {
    command: 'adhoc finish',
    version: 1,
    status: 'completed',
    id: active.id,
    receipt: active.receipt,
    starting_git_commit_hash: startingGitCommitHash,
    ending_git_commit_hash: endingGitCommitHash,
    recovered,
  })
}

function receiptMarkdown(active) {
  const starting =
    active.starting_worktree === 'clean'
      ? 'Clean.'
      : `Existing changes adopted with user approval (${active.adopted_path_count} paths).`
  return `# Adhoc ${active.id}\n\n- Scope: ${active.scope}\n- Started: ${active.started_at}\n- Completed: ${active.completed_at}\n- Starting working tree: ${starting}\n\n## Outcome\n\n${active.outcome}\n\n## Verification\n\n${active.verification}\n`
}

async function findReceipt(specdevPath, id) {
  const root = join(specdevPath, 'adhoc')
  if (!(await fse.pathExists(root))) return null
  for (const month of await fse.readdir(root, { withFileTypes: true })) {
    if (!month.isDirectory()) continue
    const monthPath = join(root, month.name)
    const match = (await fse.readdir(monthPath, { withFileTypes: true })).find(
      (entry) => entry.isFile() && entry.name.startsWith(`${id}_`) && entry.name.endsWith('.md')
    )
    if (match) return join(monthPath, match.name)
  }
  return null
}

function activePath(specdevPath) {
  return join(specdevPath, 'cache', 'adhoc.json')
}

async function readActive(specdevPath) {
  const path = activePath(specdevPath)
  return (await fse.pathExists(path)) ? fse.readJson(path) : null
}

async function writeActive(specdevPath, value) {
  const path = activePath(specdevPath)
  const temporary = `${path}.tmp-${process.pid}`
  await fse.ensureDir(dirname(path))
  await fse.writeJson(temporary, value, { spaces: 2 })
  await fse.move(temporary, path, { overwrite: true })
}

async function clearActive(specdevPath) {
  await fse.remove(activePath(specdevPath))
}

function createAdhocId(timestamp) {
  const compact = timestamp.replace(/[-:.]/g, '')
  return `AH-${compact}-${randomBytes(2).toString('hex')}`
}

function slugify(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'change'
  )
}

function stringFlag(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`
}

function emit(flags, payload) {
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else {
    const label = payload.id ? ` ${payload.id}` : ''
    console.log(`Adhoc${label}: ${payload.status}`)
    if (payload.scope) console.log(`Scope: ${payload.scope}`)
    if (payload.receipt) console.log(`Receipt: ${payload.receipt}`)
    if (payload.starting_git_commit_hash)
      console.log(`Starting Git commit: ${payload.starting_git_commit_hash}`)
    if (payload.ending_git_commit_hash)
      console.log(`Ending Git commit: ${payload.ending_git_commit_hash}`)
    if (payload.next_action) console.log(`Next: ${payload.next_action}`)
  }
  return payload
}

function blocked(flags, details) {
  const payload = { command: 'adhoc', version: 1, status: 'blocked', ...details }
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else {
    console.error(`Adhoc blocked: ${details.state}`)
    if (details.working_tree) {
      console.error(`Existing paths: ${details.working_tree.count}`)
      for (const path of details.working_tree.preview) console.error(`  - ${path}`)
      if (details.working_tree.omitted)
        console.error(`  - +${details.working_tree.omitted} more path(s)`)
    }
    if (details.next_action) console.error(`Next: ${details.next_action}`)
  }
  process.exitCode = 1
  return payload
}

function fail(flags, message) {
  const payload = { command: 'adhoc', version: 1, status: 'error', error: message }
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else console.error(message)
  process.exitCode = 1
  return payload
}
