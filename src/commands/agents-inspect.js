import { isAbsolute, resolve } from 'path'
import fse from 'fs-extra'
import { resolveTargetDir } from '../utils/command-context.js'
import { loadAgentSpec } from '../utils/agent-runner.js'

function printUsage(json = false) {
  const message = 'Usage: specdev agents inspect <path>'
  if (json) {
    console.log(JSON.stringify({ command: 'agents inspect', version: 1, status: 'error', error: message }, null, 2))
  } else {
    console.error(message)
  }
}

function formatSpec(spec) {
  return {
    command: 'agents inspect',
    version: 1,
    status: 'ok',
    path: spec.specPath,
    name: spec.frontmatter.name || null,
    description: spec.frontmatter.description,
    schema_path: spec.schemaPath,
    runners: spec.frontmatter.runners,
  }
}

export async function agentsInspectCommand(positionalArgs = [], flags = {}) {
  const subcommand = positionalArgs[0]
  const specArg = positionalArgs[1]
  if (subcommand !== 'inspect' || !specArg) {
    printUsage(flags.json)
    process.exitCode = 1
    return
  }

  const targetDir = resolve(resolveTargetDir(flags))
  const specPath = isAbsolute(specArg) ? resolve(specArg) : resolve(targetDir, specArg)

  try {
    if (!(await fse.pathExists(specPath))) {
      throw new Error(`Agent spec not found: ${specPath}`)
    }
    const spec = await loadAgentSpec(specPath)
    const payload = formatSpec(spec)
    if (flags.json) {
      console.log(JSON.stringify(payload, null, 2))
      return
    }

    console.log(`Agent: ${payload.name || '(unnamed)'}`)
    console.log(`Description: ${payload.description}`)
    console.log(`Schema: ${payload.schema_path}`)
    console.log(`Runners: ${Object.keys(payload.runners || {}).join(', ')}`)
  } catch (error) {
    if (flags.json) {
      console.log(JSON.stringify({ command: 'agents inspect', version: 1, status: 'error', error: error.message }, null, 2))
    } else {
      console.error(error.message)
    }
    process.exitCode = 1
  }
}
