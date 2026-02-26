import { initCommand } from './init.js'
import { updateCommand } from './update.js'
import { helpCommand } from './help.js'
import { ponderWorkflowCommand } from './ponder-workflow.js'
import { ponderProjectCommand } from './ponder-project.js'
import { skillsCommand } from './skills.js'
import { startCommand } from './start.js'
import { assignmentCommand } from './assignment.js'
import { breakdownCommand } from './breakdown.js'
import { implementCommand } from './implement.js'
import { reviewCommand } from './review.js'
import { migrateCommand } from './migrate.js'
import { continueCommand } from './continue.js'
import { reviseCommand } from './revise.js'
import { checkReviewCommand } from './check-review.js'
import { progressCommand } from './progress.js'
import { applyCaptureCommand } from './apply-capture.js'

const commandHandlers = {
  init: ({ flags }) => initCommand(flags),
  update: ({ flags }) => updateCommand(flags),
  skills: ({ flags }) => skillsCommand(flags),
  start: ({ flags }) => startCommand(flags),
  assignment: ({ positionalArgs, flags }) => assignmentCommand(positionalArgs, flags),
  breakdown: ({ flags }) => breakdownCommand(flags),
  implement: ({ flags }) => implementCommand(flags),
  review: ({ positionalArgs, flags }) => reviewCommand(positionalArgs, flags),
  migrate: ({ flags }) => migrateCommand(flags),
  continue: ({ flags }) => continueCommand(flags),
  revise: ({ flags }) => reviseCommand(flags),
  'check-review': ({ flags }) => checkReviewCommand(flags),
  progress: ({ positionalArgs, flags }) => progressCommand(positionalArgs, flags),
  'apply-capture': ({ flags }) => applyCaptureCommand(flags),
}

export async function dispatchCommand(command, positionalArgs, flags) {
  if (command === 'ponder') {
    const subcommand = positionalArgs[0]
    if (subcommand === 'workflow') {
      await ponderWorkflowCommand(flags)
    } else if (subcommand === 'project') {
      await ponderProjectCommand(flags)
    } else {
      console.error(`Unknown ponder subcommand: ${subcommand || '(none)'}`)
      console.log('Usage: specdev ponder <workflow|project>')
      process.exitCode = 1
    }
    return
  }

  if (command === 'help' || command === '--help' || command === '-h') {
    helpCommand()
    return
  }

  if (command === '--version' || command === '-v') {
    const pkg = await import('../../package.json', { with: { type: 'json' } })
    console.log(pkg.default.version)
    return
  }

  if (!command) {
    helpCommand()
    return
  }

  const handler = commandHandlers[command]
  if (!handler) {
    console.error(`Unknown command: ${command}`)
    console.log('Run "specdev help" for usage information')
    process.exitCode = 1
    return
  }

  await handler({ positionalArgs, flags })
}
