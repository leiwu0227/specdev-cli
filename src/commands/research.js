import { basename, dirname, isAbsolute, join, relative, resolve } from 'path'
import fse from 'fs-extra'
import { AGENT_SPEC_PATHS } from '../utils/workflow-contract.js'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import { resolveCurrentAssignment } from '../utils/current.js'
import { detectHostAgent } from '../utils/host-detection.js'
import { runAgent } from '../utils/agent-runner.js'

const DEFAULT_SCOPE = 'all'
const VALID_SCOPES = new Set(['repo', 'knowledge', 'web', 'all'])
const MAX_CONTEXT_FILE_BYTES = 64 * 1024
const MAX_CONTEXT_TOTAL_BYTES = 256 * 1024

function slugifyTopic(topic) {
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
  return slug || 'research'
}

async function resolveAssignment(targetDir) {
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)
  const current = await resolveCurrentAssignment(specdevPath)
  if (current.error === 'missing') {
    throw new Error('No active assignment. Run specdev focus <id> to set one.')
  }
  if (current.error === 'stale') {
    throw new Error(`Active assignment "${current.name}" not found. Run specdev focus <id> to set a valid assignment.`)
  }
  return current
}

async function nextArtifactPath(assignmentPath, topic) {
  const contextDir = join(assignmentPath, 'context')
  await fse.ensureDir(contextDir)
  const slug = slugifyTopic(topic)
  let candidate = join(contextDir, `research-${slug}.md`)
  let index = 2
  while (await fse.pathExists(candidate)) {
    candidate = join(contextDir, `research-${slug}-${index}.md`)
    index++
  }
  return candidate
}

function isInside(parent, child) {
  const rel = relative(parent, child)
  return rel === '' || (!!rel && !rel.startsWith('..') && !isAbsolute(rel))
}

function looksSecret(filePath) {
  const lower = filePath.toLowerCase()
  const name = basename(lower)
  return name.startsWith('.env') ||
    name.endsWith('.pem') ||
    name.endsWith('.key') ||
    name === 'id_rsa' ||
    name === 'id_ed25519' ||
    lower.includes('credential') ||
    lower.includes('secret') ||
    lower.includes('token') ||
    lower.includes('password')
}

async function readContextFile({ targetDir, entry, unsafe, remainingBytes }) {
  const rawPath = entry.trim()
  if (!rawPath) return { text: '', usedBytes: 0 }

  const requestedPath = isAbsolute(rawPath) ? resolve(rawPath) : resolve(targetDir, rawPath)
  const targetReal = await fse.realpath(targetDir)
  const exists = await fse.pathExists(requestedPath)
  if (!exists) throw new Error(`Context path not found: ${rawPath}`)

  const stat = await fse.lstat(requestedPath)
  if (stat.isDirectory()) throw new Error(`Context path is a directory: ${rawPath}`)
  const realPath = await fse.realpath(requestedPath)
  const insideTarget = isInside(targetReal, realPath)
  if (!unsafe && !insideTarget) {
    throw new Error(`Context path resolves outside target project: ${rawPath}`)
  }
  if (!unsafe && stat.isSymbolicLink() && !insideTarget) {
    throw new Error(`Context symlink resolves outside target project: ${rawPath}`)
  }
  if (!unsafe && looksSecret(requestedPath)) {
    throw new Error(`Context path looks secret; pass --unsafe-context to include it: ${rawPath}`)
  }

  const fileStat = await fse.stat(realPath)
  if (!fileStat.isFile()) throw new Error(`Context path is not a regular file: ${rawPath}`)

  const buffer = await fse.readFile(realPath)
  const includeBytes = Math.min(buffer.length, MAX_CONTEXT_FILE_BYTES, remainingBytes)
  const included = buffer.subarray(0, includeBytes).toString('utf-8')
  const truncated = includeBytes < buffer.length
  const marker = truncated
    ? `\n[truncated ${buffer.length - includeBytes} bytes; included ${includeBytes} of ${buffer.length} bytes]\n`
    : ''
  const displayPath = insideTarget ? relative(targetReal, realPath) : realPath
  return {
    text: `### ${displayPath}\n\n${included}${marker}`,
    usedBytes: includeBytes,
  }
}

export async function resolveContextBlock(targetDir, contextCsv, { unsafe = false } = {}) {
  if (!contextCsv) return ''
  const entries = String(contextCsv).split(',').map(value => value.trim()).filter(Boolean)
  const sections = []
  let usedBytes = 0
  for (const entry of entries) {
    if (usedBytes >= MAX_CONTEXT_TOTAL_BYTES) {
      sections.push(`[context omitted: total cap ${MAX_CONTEXT_TOTAL_BYTES} bytes reached]`)
      break
    }
    const result = await readContextFile({
      targetDir,
      entry,
      unsafe,
      remainingBytes: MAX_CONTEXT_TOTAL_BYTES - usedBytes,
    })
    usedBytes += result.usedBytes
    sections.push(result.text)
  }
  if (usedBytes >= MAX_CONTEXT_TOTAL_BYTES) {
    sections.push(`[total context cap reached: ${MAX_CONTEXT_TOTAL_BYTES} bytes]`)
  }
  return sections.join('\n\n')
}

export async function researchCommand(positionalArgs = [], flags = {}) {
  const topic = positionalArgs.join(' ').trim()
  if (!topic) {
    console.error('Usage: specdev research "<topic>" [--scope=repo|knowledge|web|all] [--context=<paths-csv>] [--platform=codex|claude|cursor] [--json] [--unsafe-context]')
    process.exitCode = 1
    return
  }

  const scope = typeof flags.scope === 'string' ? flags.scope : DEFAULT_SCOPE
  if (!VALID_SCOPES.has(scope)) {
    console.error(`Invalid scope: ${scope}`)
    process.exitCode = 1
    return
  }

  try {
    const targetDir = resolve(resolveTargetDir(flags))
    const assignment = await resolveAssignment(targetDir)
    const artifactPath = await nextArtifactPath(assignment.path, topic)
    const context = await resolveContextBlock(targetDir, flags.context, { unsafe: flags['unsafe-context'] === true })
    const platform = detectHostAgent({ flagOverride: flags.platform })
    const specPath = join(targetDir, AGENT_SPEC_PATHS.researcher)
    const result = await runAgent(specPath, { topic, scope, context }, {
      artifactPath,
      platform,
      cwd: targetDir,
      maxRetries: 2,
    })

    if (result.exitCode !== 0 || result.timedOut) {
      if (flags.json) {
        console.log(JSON.stringify({
          command: 'research',
          version: 1,
          status: 'error',
          artifact: artifactPath,
          error: result.error || 'agent failed',
        }, null, 2))
      } else {
        console.error(`Research failed. Artifact preserved: ${artifactPath}`)
        if (result.error) console.error(result.error)
      }
      process.exitCode = 1
      return
    }

    if (flags.json) {
      console.log(JSON.stringify({
        command: 'research',
        version: 1,
        status: 'ok',
        artifact: artifactPath,
        output: result.parsedOutput,
      }, null, 2))
      return
    }

    console.log(`Research complete: ${artifactPath}`)
  } catch (error) {
    if (flags.json) {
      console.log(JSON.stringify({ command: 'research', version: 1, status: 'error', error: error.message }, null, 2))
    } else {
      console.error(error.message)
    }
    process.exitCode = 1
  }
}
