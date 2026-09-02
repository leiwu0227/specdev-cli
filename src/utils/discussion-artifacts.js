import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { join } from 'node:path'
import fse from 'fs-extra'

export const DISCUSSION_ARTIFACT_MANIFEST_VERSION = 1
export const DISCUSSION_CANONICAL_ARTIFACTS = Object.freeze([
  'brainstorm/proposal.md',
  'brainstorm/design.md',
])

const OPERATIONAL_DIRECTORIES = new Set([
  '.cache',
  '.git',
  '.ripplegraph',
  '.specdev',
  'build',
  'cache',
  'coverage',
  'dist',
  'node_modules',
])
const OPERATIONAL_FILES = new Set(['.ds_store', 'thumbs.db'])

export async function discussionArtifactManifest(discussionPath) {
  const root = join(discussionPath, 'brainstorm')
  if (!(await fse.pathExists(root))) {
    throw new Error('Discussion artifact directory is missing: brainstorm')
  }
  const rootStat = await fse.lstat(root)
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error('Discussion artifact directory must be a real directory: brainstorm')
  }

  const candidates = []
  await collectArtifactCandidates(root, 'brainstorm', candidates)
  const ordered = orderCandidates(candidates)
  for (const canonical of DISCUSSION_CANONICAL_ARTIFACTS) {
    if (!ordered.some((candidate) => candidate.path === canonical)) {
      throw new Error(`Discussion artifact is missing: ${canonical}`)
    }
  }

  const aggregate = createHash('sha256')
  const files = []
  for (const candidate of ordered) {
    aggregate.update(candidate.path)
    aggregate.update('\0')
    const fingerprint = createHash('sha256')
    let size = 0
    await new Promise((resolve, reject) => {
      const stream = createReadStream(candidate.absolutePath)
      stream.on('data', (chunk) => {
        size += chunk.byteLength
        fingerprint.update(chunk)
        aggregate.update(chunk)
      })
      stream.on('error', reject)
      stream.on('end', resolve)
    })
    aggregate.update('\0')
    files.push({
      path: candidate.path,
      size,
      sha256: fingerprint.digest('hex'),
    })
  }

  return {
    version: DISCUSSION_ARTIFACT_MANIFEST_VERSION,
    files,
    artifact_hash: aggregate.digest('hex'),
  }
}

export async function discussionArtifactHash(discussionPath) {
  return (await discussionArtifactManifest(discussionPath)).artifact_hash
}

export function discussionArtifactCompletionMatches(output, manifest) {
  if (!output?.artifact_hash || output.artifact_hash !== manifest?.artifact_hash) return false
  if (!output.artifact_manifest) return true
  const completed = output.artifact_manifest
  return (
    completed.version === manifest.version &&
    completed.artifact_hash === manifest.artifact_hash &&
    Array.isArray(completed.files) &&
    completed.files.length === manifest.files.length &&
    completed.files.every((file, index) => {
      const current = manifest.files[index]
      return (
        file?.path === current.path &&
        file?.size === current.size &&
        file?.sha256 === current.sha256
      )
    })
  )
}

export function discussionArtifactCatalog(manifest) {
  return manifest.files.map((file) => file.path)
}

async function collectArtifactCandidates(directory, relativeDirectory, candidates) {
  const entries = await fse.readdir(directory, { withFileTypes: true })
  entries.sort((left, right) => compareText(left.name, right.name))
  for (const entry of entries) {
    const path = `${relativeDirectory}/${entry.name}`
    const reason = operationalEntryReason(entry.name, entry.isDirectory())
    if (reason) throw new Error(`Discussion artifact is not allowed: ${path} (${reason})`)

    const absolutePath = join(directory, entry.name)
    const stat = await fse.lstat(absolutePath)
    if (stat.isSymbolicLink()) {
      throw new Error(`Discussion artifact symlinks are not allowed: ${path}`)
    }
    if (stat.isDirectory()) {
      await collectArtifactCandidates(absolutePath, path, candidates)
      continue
    }
    if (!stat.isFile()) {
      throw new Error(`Discussion artifact must be a regular file: ${path}`)
    }
    candidates.push({ path, absolutePath })
  }
}

function orderCandidates(candidates) {
  const canonicalRank = new Map(DISCUSSION_CANONICAL_ARTIFACTS.map((path, index) => [path, index]))
  return [...candidates].sort((left, right) => {
    const leftRank = canonicalRank.get(left.path)
    const rightRank = canonicalRank.get(right.path)
    if (leftRank !== undefined || rightRank !== undefined) {
      if (leftRank === undefined) return 1
      if (rightRank === undefined) return -1
      return leftRank - rightRank
    }
    return compareText(left.path, right.path)
  })
}

function operationalEntryReason(name, directory) {
  const normalized = String(name).toLowerCase()
  if (directory && OPERATIONAL_DIRECTORIES.has(normalized)) return 'operational directory'
  if (!directory && OPERATIONAL_FILES.has(normalized)) return 'operating-system metadata'
  if (!directory && (normalized === '.env' || normalized.startsWith('.env.'))) {
    return 'credential-bearing environment file'
  }
  if (!directory && (/\.(swp|swo|tmp)$/.test(normalized) || normalized.endsWith('~'))) {
    return 'temporary editor file'
  }
  return null
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}
