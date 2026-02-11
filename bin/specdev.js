#!/usr/bin/env node

import { initCommand } from '../src/commands/init.js'
import { updateCommand } from '../src/commands/update.js'
import { helpCommand } from '../src/commands/help.js'
import { ponderWorkflowCommand } from '../src/commands/ponder-workflow.js'
import { ponderProjectCommand } from '../src/commands/ponder-project.js'
import { skillsCommand } from '../src/commands/skills.js'
import { workCommand } from '../src/commands/work.js'
import { checkCommand } from '../src/commands/check.js'

const [,, command, ...args] = process.argv

// Parse flags
const flags = {}
const positionalArgs = []

args.forEach(arg => {
  if (arg.startsWith('--')) {
    const equalIndex = arg.indexOf('=')
    if (equalIndex > -1) {
      const key = arg.slice(2, equalIndex)
      const value = arg.slice(equalIndex + 1)
      flags[key] = value
    } else {
      flags[arg.slice(2)] = true
    }
  } else if (arg.startsWith('-')) {
    flags[arg.slice(1)] = true
  } else {
    positionalArgs.push(arg)
  }
})

switch(command) {
  case 'init':
    await initCommand(flags)
    break
  case 'update':
    await updateCommand(flags)
    break
  case 'skills':
    await skillsCommand(flags)
    break
  case 'work': {
    const workSub = positionalArgs[0]
    await workCommand(workSub, flags)
    break
  }
  case 'check': {
    const checkSub = positionalArgs[0]
    await checkCommand(checkSub, flags)
    break
  }
  case 'ponder': {
    const subcommand = positionalArgs[0]
    if (subcommand === 'workflow') {
      await ponderWorkflowCommand(flags)
    } else if (subcommand === 'project') {
      await ponderProjectCommand(flags)
    } else {
      console.error(`Unknown ponder subcommand: ${subcommand || '(none)'}`)
      console.log('Usage: specdev ponder <workflow|project>')
      process.exit(1)
    }
    break
  }
  case 'help':
  case '--help':
  case '-h':
    helpCommand()
    break
  case '--version':
  case '-v':
    const pkg = await import('../package.json', { with: { type: 'json' } })
    console.log(pkg.default.version)
    break
  default:
    if (!command) {
      helpCommand()
    } else {
      console.error(`Unknown command: ${command}`)
      console.log('Run "specdev help" for usage information')
      process.exit(1)
    }
}
