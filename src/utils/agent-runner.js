import { spawn as realSpawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import fse from 'fs-extra'
import YAML from 'yaml'
import Ajv from 'ajv'

export const AGENT_TERMINATION_GRACE_MS = 5000
export const DEFAULT_AGENT_STDOUT_BUFFER_LIMIT = 2 * 1024 * 1024

const REQUIRED_MARKDOWN_SECTIONS = ['Topic', 'Scope Used', 'Findings', 'Sources', 'Limitations']

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT_DIR = resolve(__dirname, '..', '..')

function appendCapped(buffer, chunk, limit) {
  if (limit <= 0) return buffer
  const next = Buffer.concat([buffer, Buffer.from(chunk)])
  if (next.length <= limit) return next
  return next.subarray(next.length - limit)
}

function splitAgentMarkdown(content, specPath) {
  if (!content.startsWith('---\n')) {
    throw new Error(`Agent spec missing YAML frontmatter: ${specPath}`)
  }
  const endIndex = content.indexOf('\n---\n', 4)
  if (endIndex === -1) {
    throw new Error(`Agent spec frontmatter is not closed: ${specPath}`)
  }
  return {
    frontmatterText: content.slice(4, endIndex),
    body: content.slice(endIndex + 5),
  }
}

function jsonSummary(errors) {
  return (errors || []).map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')
}

export async function loadAgentSpec(specPath) {
  const absoluteSpecPath = resolve(specPath)
  const content = await fse.readFile(absoluteSpecPath, 'utf-8')
  const { frontmatterText, body } = splitAgentMarkdown(content, absoluteSpecPath)
  const frontmatter = YAML.parse(frontmatterText) || {}

  const metaSchemaPath = join(ROOT_DIR, 'templates', '.specdev', '_templates', 'agent-spec.schema.json')
  const metaSchema = JSON.parse(await fse.readFile(metaSchemaPath, 'utf-8'))
  const ajv = new Ajv({ allErrors: true, strict: false })
  const validateSpec = ajv.compile(metaSchema)
  if (!validateSpec(frontmatter)) {
    throw new Error(`Invalid agent spec metadata: ${jsonSummary(validateSpec.errors)}`)
  }

  const schemaPath = resolve(dirname(absoluteSpecPath), frontmatter.output.schema)
  const outputSchema = JSON.parse(await fse.readFile(schemaPath, 'utf-8'))

  return {
    specPath: absoluteSpecPath,
    specDir: dirname(absoluteSpecPath),
    frontmatter,
    body,
    schemaPath,
    outputSchema,
  }
}

export function renderPrompt(template, inputs = {}) {
  let rendered = template
  for (const [key, value] of Object.entries(inputs)) {
    rendered = rendered.replaceAll(`{{${key}}}`, String(value ?? ''))
  }
  return rendered
}

export function extractFinalJsonBlock(markdown) {
  const matches = [...String(markdown).matchAll(/```json\s*([\s\S]*?)```/g)]
  if (matches.length === 0) {
    throw new Error('No fenced json block found in agent artifact')
  }
  return JSON.parse(matches[matches.length - 1][1])
}

export function validateRequiredSections(markdown, sections = REQUIRED_MARKDOWN_SECTIONS) {
  let lastIndex = -1
  const missing = []
  const outOfOrder = []
  for (const section of sections) {
    const match = new RegExp(`^##\\s+${section}\\s*$`, 'm').exec(markdown)
    if (!match) {
      missing.push(section)
      continue
    }
    if (match.index < lastIndex) {
      outOfOrder.push(section)
    }
    lastIndex = match.index
  }
  if (missing.length > 0) {
    throw new Error(`Missing required markdown sections: ${missing.join(', ')}`)
  }
  if (outOfOrder.length > 0) {
    throw new Error(`Required markdown sections out of order: ${outOfOrder.join(', ')}`)
  }
}

function buildArgs(args, promptConfig, renderedPrompt) {
  const nextArgs = [...(args || [])]
  if (promptConfig.mode === 'append_arg') {
    nextArgs.push(renderedPrompt)
  } else if (promptConfig.mode === 'flag_arg') {
    if (!promptConfig.flag) throw new Error('flag_arg prompt mode requires prompt.flag')
    nextArgs.push(promptConfig.flag, renderedPrompt)
  } else if (promptConfig.mode !== 'stdin') {
    throw new Error(`Unknown prompt mode: ${promptConfig.mode}`)
  }
  return nextArgs
}

function normalizeText(text) {
  return text.endsWith('\n') ? text : `${text}\n`
}

function renderStreamJsonLine(line) {
  try {
    const event = JSON.parse(line)
    const content = Array.isArray(event.message?.content) ? event.message.content : []
    if (event.type === 'assistant') {
      return content
        .filter(block => block.type === 'text' && typeof block.text === 'string')
        .map(block => normalizeText(block.text))
    }
    if (event.type === 'result' && String(event.subtype || '').startsWith('error')) {
      return [`> error: ${event.subtype}\n`]
    }
    return []
  } catch {
    return [normalizeText(line)]
  }
}

function createStreamJsonTranslator({ writeRendered, writeRaw, markActivity }) {
  let tail = ''
  function consume(text, flush = false) {
    const combined = `${tail}${text}`
    const parts = combined.split('\n')
    tail = flush ? '' : parts.pop()
    for (const line of parts) {
      if (!line) continue
      for (const rendered of renderStreamJsonLine(line)) {
        writeRendered(rendered)
        markActivity()
      }
    }
  }
  return {
    onStdout(chunk) {
      writeRaw(chunk)
      consume(String(chunk))
    },
    flush() {
      if (!tail) return
      const buffered = tail
      tail = ''
      for (const rendered of renderStreamJsonLine(buffered)) {
        writeRendered(rendered)
        markActivity()
      }
    },
  }
}

function runAgentProcess({
  command,
  args,
  cwd,
  env,
  stdinText,
  timeoutMs,
  stdoutBufferLimit,
  onStdout,
  onStderr,
  spawn = realSpawn,
  setTimeout: setTimer = globalThis.setTimeout,
  clearTimeout: clearTimer = globalThis.clearTimeout,
  killProcessGroup = (pid, signal) => process.kill(pid, signal),
}) {
  let stdoutBuffer = Buffer.alloc(0)
  let stderrBuffer = Buffer.alloc(0)
  let settled = false
  let timedOut = false
  let timeoutTimer = null
  let killTimer = null

  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: [stdinText === null ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      detached: true,
    })

    function finish(result) {
      if (settled) return
      settled = true
      clearTimer(timeoutTimer)
      if (killTimer) clearTimer(killTimer)
      resolvePromise({
        ...result,
        stdoutBuffer,
        stderrBuffer,
      })
    }

    timeoutTimer = setTimer(() => {
      if (settled) return
      timedOut = true
      try {
        killProcessGroup(-child.pid, 'SIGTERM')
      } catch {
        // Process may already have exited.
      }
      killTimer = setTimer(() => {
        try {
          killProcessGroup(-child.pid, 'SIGKILL')
        } catch {
          // Process may already have exited.
        }
      }, AGENT_TERMINATION_GRACE_MS)
      killTimer?.unref?.()
    }, timeoutMs)

    if (stdinText !== null) {
      child.stdin.write(stdinText)
      child.stdin.end()
    }

    child.stdout.on('data', (chunk) => {
      stdoutBuffer = appendCapped(stdoutBuffer, chunk, stdoutBufferLimit)
      onStdout(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderrBuffer = appendCapped(stderrBuffer, chunk, stdoutBufferLimit)
      onStderr(chunk)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      finish({ exitCode: timedOut ? null : code, timedOut })
    })
  })
}

async function validateArtifact(artifactPath, outputSchema) {
  const markdown = await fse.readFile(artifactPath, 'utf-8')
  validateRequiredSections(markdown)
  const parsedOutput = extractFinalJsonBlock(markdown)
  const ajv = new Ajv({ allErrors: true, strict: false })
  const validateOutput = ajv.compile(outputSchema)
  if (!validateOutput(parsedOutput)) {
    throw new Error(`Invalid agent output JSON: ${jsonSummary(validateOutput.errors)}`)
  }
  return parsedOutput
}

function retryPrompt(renderedPrompt, error) {
  return `${renderedPrompt}\n\n## Previous response was rejected\n\n${error.message}\n\nPlease respond again with all required markdown sections and a valid final fenced json block.\n`
}

export async function runAgent(specPath, inputs, options = {}) {
  const spec = await loadAgentSpec(specPath)
  const platform = options.platform || options.platformOverride
  const runner = spec.frontmatter.runners?.[platform]
  if (!runner) {
    throw new Error(`No runner configured for platform: ${platform}`)
  }

  const artifactPath = options.artifactPath
  if (!artifactPath) throw new Error('runAgent requires options.artifactPath')
  await fse.ensureDir(dirname(artifactPath))

  const maxRetries = options.maxRetries ?? 2
  let renderedPrompt = renderPrompt(spec.body, inputs)
  let lastRunResult = null
  let lastError = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await fse.writeFile(artifactPath, '')
    if (runner.stream_json) await fse.writeFile(`${artifactPath}.jsonl`, '')

    const promptConfig = runner.prompt || { mode: 'append_arg' }
    const args = buildArgs(runner.args || [], promptConfig, renderedPrompt)
    const stdinText = promptConfig.mode === 'stdin' ? renderedPrompt : null
    const artifactStream = createWriteStream(artifactPath, { flags: 'a' })
    const jsonlStream = runner.stream_json ? createWriteStream(`${artifactPath}.jsonl`, { flags: 'a' }) : null
    let active = false
    const markActivity = () => { active = true }
    const translator = runner.stream_json
      ? createStreamJsonTranslator({
          writeRendered: chunk => artifactStream.write(chunk),
          writeRaw: chunk => jsonlStream.write(chunk),
          markActivity,
        })
      : null

    try {
      lastRunResult = await runAgentProcess({
        command: runner.command,
        args,
        cwd: options.cwd || process.cwd(),
        env: options.env || process.env,
        stdinText,
        timeoutMs: runner.timeout_ms || options.timeoutMs || 300000,
        stdoutBufferLimit: options.stdoutBufferLimit || DEFAULT_AGENT_STDOUT_BUFFER_LIMIT,
        spawn: options.spawn,
        setTimeout: options.setTimeout,
        clearTimeout: options.clearTimeout,
        killProcessGroup: options.killProcessGroup,
        onStdout(chunk) {
          if (translator) translator.onStdout(chunk)
          else artifactStream.write(chunk)
        },
        onStderr() {},
      })
      if (translator) translator.flush()
    } finally {
      await new Promise(resolveStream => artifactStream.end(resolveStream))
      if (jsonlStream) await new Promise(resolveStream => jsonlStream.end(resolveStream))
    }

    if (lastRunResult.timedOut) {
      return { artifactPath, parsedOutput: null, exitCode: null, timedOut: true, logs: lastRunResult, active }
    }
    if (lastRunResult.exitCode !== 0) {
      return { artifactPath, parsedOutput: null, exitCode: lastRunResult.exitCode, timedOut: false, logs: lastRunResult, active }
    }

    try {
      const parsedOutput = await validateArtifact(artifactPath, spec.outputSchema)
      return { artifactPath, parsedOutput, exitCode: 0, timedOut: false, logs: lastRunResult, active }
    } catch (error) {
      lastError = error
      if (attempt >= maxRetries) break
      renderedPrompt = retryPrompt(renderedPrompt, error)
    }
  }

  return {
    artifactPath,
    parsedOutput: null,
    exitCode: 1,
    timedOut: false,
    error: lastError?.message,
    logs: lastRunResult,
  }
}
