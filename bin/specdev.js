#!/usr/bin/env node

import { initCommand } from '../src/commands/init.js'
import { updateCommand } from '../src/commands/update.js'
import { helpCommand } from '../src/commands/help.js'

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
