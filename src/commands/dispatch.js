import { initCommand } from './init.js'
import { updateCommand } from './update.js'
import { helpCommand } from './help.js'
import { distillWorkflowCommand } from './distill-workflow.js'
import { distillProjectCommand } from './distill-project.js'
import { distillMarkCommand } from './distill-mark.js'
import { skillsCommand } from './skills.js'
import { startCommand } from './start.js'
import { assignmentCommand } from './assignment.js'
import { checkpointCommand } from './checkpoint.js'
import { approveCommand } from './approve.js'
import { reviewCommand } from './review.js'
import { migrateCommand } from './migrate.js'
import { continueCommand } from './continue.js'
import { reviseCommand } from './revise.js'
import { checkReviewCommand } from './check-review.js'

const commandHandlers = {
  init: ({ flags }) => initCommand(flags),
  update: ({ flags }) => updateCommand(flags),
  skills: ({ positionalArgs, flags }) => skillsCommand(positionalArgs, flags),
  start: ({ flags }) => startCommand(flags),
  assignment: ({ positionalArgs, flags }) => assignmentCommand(positionalArgs, flags),
  checkpoint: ({ positionalArgs, flags }) => checkpointCommand(positionalArgs, flags),
  approve: ({ positionalArgs, flags }) => approveCommand(positionalArgs, flags),
  review: ({ positionalArgs, flags }) => reviewCommand(positionalArgs, flags),
  migrate: ({ flags }) => migrateCommand(flags),
  continue: ({ flags }) => continueCommand(flags),
  revise: ({ flags }) => reviseCommand(flags),
  'check-review': ({ flags }) => checkReviewCommand(flags),
}

export async function dispatchCommand(command, positionalArgs, flags) {
  if (command === 'distill') {
    const subcommand = positionalArgs[0]
    if (subcommand === 'workflow') {
      await distillWorkflowCommand(flags)
    } else if (subcommand === 'project') {
      await distillProjectCommand(flags)
    } else if (subcommand === 'mark-processed') {
      const markArgs = positionalArgs.slice(1)
      await distillMarkCommand(markArgs, flags)
    } else {
      console.error(`Unknown distill subcommand: ${subcommand || '(none)'}`)
      console.log('Usage: specdev distill <project|workflow|mark-processed>')
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
