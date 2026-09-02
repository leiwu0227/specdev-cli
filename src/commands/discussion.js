import { join } from 'node:path'
import fse from 'fs-extra'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import { getNextDiscussionId, resolveDiscussionSelector } from '../utils/discussion.js'
import { readBigPictureStatus } from '../utils/project-context.js'
import { gitSnapshot, relativeToRepo } from '../utils/assignment-vnext.js'
import {
  discussionArtifactCatalog,
  discussionArtifactManifest,
} from '../utils/discussion-artifacts.js'
import {
  listGuidedCalls,
  readGuidedCall,
  startGuidedCall,
  stepGuidedCall,
} from '../utils/callable-sync.js'
import { assertWorkspaceEngine } from '../utils/engine.js'
import { attemptLiveness, listAttemptRecords } from '../utils/process-record.js'

export async function discussCommand(positionalArgs = [], flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)
  try {
    assertWorkspaceEngine(targetDir)
  } catch (error) {
    return fail(flags, error.message)
  }

  if (flags.list) return listDiscussions(targetDir, specdevPath, flags)

  const selector =
    positionalArgs.length === 1 && /^D\d{4,5}$/.test(positionalArgs[0]) ? positionalArgs[0] : null
  if (selector) return resumeDiscussion(targetDir, specdevPath, selector, flags)

  const description = positionalArgs.join(' ').trim()
  if (!description)
    return fail(
      flags,
      'Usage: specdev discussion "<topic>" | specdev discussion D00001 | specdev discussion --list'
    )

  const bigPicture = await readBigPictureStatus(specdevPath)
  if (!bigPicture.exists || !bigPicture.filled)
    return fail(flags, 'big_picture.md is not filled in')
  const id = await getNextDiscussionId(specdevPath)
  const name = `${id}_${slugify(description)}`
  const discussionPath = join(specdevPath, 'discussions', name)
  const revision = (await gitSnapshot(targetDir)).revision || 'unborn'
  await fse.ensureDir(join(discussionPath, 'brainstorm'))
  try {
    await claimDiscussion(specdevPath, id)
  } catch (error) {
    return fail(flags, error.message)
  }
  const input = {
    id,
    path: relativeToRepo(targetDir, discussionPath),
    description,
    start_revision: revision,
  }
  let started
  try {
    started = startGuidedCall(targetDir, 'discussion-lifecycle', id, input)
  } catch (error) {
    await releaseDiscussion(specdevPath, id)
    return fail(flags, error.message)
  }
  if (!started.synchronized)
    return fail(flags, 'RippleGraph callable runtime is unavailable; run specdev update')

  return emit(flags, {
    command: 'discussion',
    version: 2,
    status: 'brainstorming',
    id,
    name,
    path: input.path,
    description,
    start_revision: revision,
    authority:
      "Product code is read-only; write only inside this Discussion's brainstorm directory.",
    next_action: `Write ${input.path}/brainstorm/proposal.md and design.md, plus any useful supporting files or subfolders, then run specdev discussion ${id}.`,
  })
}

async function resumeDiscussion(targetDir, specdevPath, selector, flags) {
  const resolved = await resolveDiscussionSelector(specdevPath, selector)
  if (!resolved || resolved.error) return fail(flags, `Discussion not found: ${selector}`)
  try {
    await claimDiscussion(specdevPath, selector)
  } catch (error) {
    return fail(flags, error.message)
  }
  let call
  try {
    call = readGuidedCall(targetDir, selector)
  } catch (error) {
    await releaseDiscussion(specdevPath, selector)
    return fail(flags, error.message)
  }
  if (!call.synchronized)
    return fail(flags, 'RippleGraph callable runtime is unavailable; run specdev update')
  if (call.state.status === 'completed') {
    await releaseDiscussion(specdevPath, selector)
    return emit(flags, discussionPayload(targetDir, resolved, call.state, 'completed'))
  }

  if (call.state.position.node === 'brainstorm') {
    const artifacts = await validateDiscussionArtifacts(resolved.path)
    if (!artifacts.valid) {
      return emit(flags, {
        ...discussionPayload(targetDir, resolved, call.state, 'brainstorming'),
        issues: artifacts.errors,
        authority: 'Product code is read-only.',
        next_action: `Finish ${relativeToRepo(targetDir, join(resolved.path, 'brainstorm', 'proposal.md'))} and design.md.`,
      })
    }
    const output = {
      proposal: relativeToRepo(targetDir, artifacts.proposalPath),
      design: relativeToRepo(targetDir, artifacts.designPath),
    }
    if (discussionGraphSupportsManifest(call.state)) {
      output.artifacts = discussionArtifactCatalog(artifacts.manifest)
    }
    stepGuidedCall(targetDir, selector, output)
  }

  if (flags.complete) {
    const runningReviews = await listAttemptRecords(specdevPath, {
      kind: 'reviewer',
      status: 'running',
      discussion: selector,
    })
    for (const attempt of runningReviews) {
      if ((await attemptLiveness(specdevPath, attempt.id)).state === 'live_local') {
        return fail(flags, `Discussion reviewer ${attempt.id} is still running in the foreground`)
      }
    }
    const artifacts = await validateDiscussionArtifacts(resolved.path)
    if (!artifacts.valid) return fail(flags, artifacts.errors.join('; '))
    const revision = (await gitSnapshot(targetDir)).revision || 'unborn'
    const manifest = artifacts.manifest
    const output = {
      completed_revision: revision,
      artifact_hash: manifest.artifact_hash,
    }
    if (discussionGraphSupportsManifest(call.state)) output.artifact_manifest = manifest
    const completed = stepGuidedCall(targetDir, selector, output)
    await releaseDiscussion(specdevPath, selector)
    return emit(flags, {
      ...discussionPayload(targetDir, resolved, completed.state, 'completed'),
      completed_revision: revision,
      artifact_hash: manifest.artifact_hash,
      ...(output.artifact_manifest ? { artifact_manifest: manifest } : {}),
      next_action: `Promote later with specdev assignment --from-discussion=${selector} or specdev mission create --from-discussion=${selector}.`,
    })
  }

  const refreshed = readGuidedCall(targetDir, selector)
  return emit(flags, {
    ...discussionPayload(targetDir, resolved, refreshed.state, 'awaiting_review'),
    next_action: `Optionally run specdev reviewloop discussion --discussion=${selector}; complete with specdev discussion ${selector} --complete.`,
  })
}

async function listDiscussions(targetDir, specdevPath, flags) {
  const calls = listGuidedCalls(targetDir, 'discussion-lifecycle')
  if (!calls.synchronized)
    return fail(flags, 'RippleGraph callable runtime is unavailable; run specdev update')
  const discussions = []
  const runningReviews = await listAttemptRecords(specdevPath, {
    kind: 'reviewer',
    status: 'running',
  })
  const reviewing = new Set()
  for (const attempt of runningReviews) {
    if (
      attempt.discussion &&
      (await attemptLiveness(specdevPath, attempt.id)).state === 'live_local'
    ) {
      reviewing.add(attempt.discussion)
    }
  }
  const discussionsDir = join(specdevPath, 'discussions')
  const dirs = (await fse.pathExists(discussionsDir))
    ? (await fse.readdir(discussionsDir, { withFileTypes: true })).filter((entry) =>
        entry.isDirectory()
      )
    : []
  for (const entry of dirs.sort((a, b) => a.name.localeCompare(b.name))) {
    const id = entry.name.match(/^D\d{4,5}/)?.[0]
    if (!id) continue
    const call = calls.calls.find((candidate) => candidate.id === id)
    discussions.push({
      id,
      name: entry.name,
      status:
        call?.status === 'completed'
          ? 'completed'
          : reviewing.has(id)
            ? 'reviewing'
            : call?.position?.node === 'finalize'
              ? 'awaiting_review'
              : 'brainstorming',
      updated_at:
        call?.updatedAt || (await fse.stat(join(discussionsDir, entry.name))).mtime.toISOString(),
    })
  }
  if (flags.json)
    return emit(flags, { command: 'discussion list', version: 2, status: 'ok', discussions })
  if (discussions.length === 0) return console.log('No discussions found.')
  console.log('Discussions:')
  for (const item of discussions) console.log(`  ${item.id}  ${item.status}  ${item.name}`)
}

async function validateDiscussionArtifacts(discussionPath) {
  const proposalPath = join(discussionPath, 'brainstorm', 'proposal.md')
  const designPath = join(discussionPath, 'brainstorm', 'design.md')
  const errors = []
  let manifest = null
  try {
    manifest = await discussionArtifactManifest(discussionPath)
  } catch (error) {
    errors.push(error.message)
  }
  if (manifest) {
    for (const [label, path] of [
      ['proposal', proposalPath],
      ['design', designPath],
    ]) {
      if ((await fse.readFile(path, 'utf-8')).trim().length < 40)
        errors.push(`${label}.md is too short`)
    }
  }
  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    proposalPath,
    designPath,
    manifest,
  }
}

function discussionGraphSupportsManifest(state) {
  const match = String(state?.call?.graphVersion || '').match(/^(\d+)\.(\d+)/)
  if (!match) return false
  const major = Number(match[1])
  const minor = Number(match[2])
  return major > 2 || (major === 2 && minor >= 1)
}

function discussionPayload(targetDir, resolved, state, status) {
  return {
    command: 'discussion',
    version: 2,
    status,
    id: resolved.name.match(/^D\d{4,5}/)?.[0],
    name: resolved.name,
    path: relativeToRepo(targetDir, resolved.path),
    updated_at: state.call?.updatedAt || null,
  }
}

async function claimDiscussion(specdevPath, id) {
  const dir = join(specdevPath, 'cache', 'discussions')
  const path = join(dir, `${id}.json`)
  await fse.ensureDir(dir)
  if (await fse.pathExists(path)) {
    const marker = await fse.readJson(path).catch(() => null)
    if (marker?.owner_pid && marker.owner_pid !== process.ppid && processIsLive(marker.owner_pid)) {
      throw new Error(`Discussion ${id} is already claimed by another local session`)
    }
  }
  await fse.writeJson(
    path,
    { id, owner_pid: process.ppid, claimed_at: new Date().toISOString() },
    { spaces: 2 }
  )
}

async function releaseDiscussion(specdevPath, id) {
  await fse.remove(join(specdevPath, 'cache', 'discussions', `${id}.json`))
}

function processIsLive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function slugify(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'discussion'
  )
}

function emit(flags, payload) {
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else {
    console.log(`Discussion ${payload.id}: ${payload.status}`)
    if (payload.path) console.log(`Path: ${payload.path}`)
    if (payload.authority) console.log(`Authority: ${payload.authority}`)
    if (payload.issues?.length) for (const issue of payload.issues) console.log(`  - ${issue}`)
    if (payload.next_action) console.log(`Next: ${payload.next_action}`)
  }
  return payload
}

function fail(flags, message) {
  if (flags.json)
    console.log(
      JSON.stringify({ command: 'discussion', version: 2, status: 'error', error: message })
    )
  else console.error(message)
  process.exitCode = 1
  return null
}
