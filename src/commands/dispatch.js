import { initCommand } from './init.js'
import { updateCommand } from './update.js'
import { helpCommand } from './help.js'
import { distillCommand } from './distill.js'
import { distillDoneCommand } from './distill-done.js'
import { skillsCommand } from './skills.js'
import { startCommand } from './start.js'
import { assignmentCommand } from './assignment.js'
import { checkpointCommand } from './checkpoint.js'
import { approveCommand } from './approve.js'
import { reviewCommand } from './review.js'
import { migrateCommand } from './migrate.js'
import { migrateLegacyAssignmentsCommand } from './migrate-legacy-assignments.js'
import { continueCommand } from './continue.js'
import { reviseCommand } from './revise.js'
import { checkReviewCommand } from './check-review.js'
import { reviewloopCommand } from './reviewloop.js'
import { implementCommand } from './implement.js'
import { focusCommand } from './focus.js'
import { discussCommand } from './discussion.js'
import { statusCommand } from './status.js'
import { memoryCommand } from './memory.js'
import { knowledgeCommand } from './knowledge.js'
import { contextCommand } from './context.js'
import { researchCommand } from './research.js'

const commandHandlers = {
  init: ({ flags }) => initCommand(flags),
  update: ({ flags }) => updateCommand(flags),
  skills: ({ positionalArgs, flags }) => skillsCommand(positionalArgs, flags),
  memory: ({ positionalArgs, flags }) => memoryCommand(positionalArgs, flags),
  knowledge: ({ positionalArgs, flags }) => knowledgeCommand(positionalArgs, flags),
  start: ({ flags }) => startCommand(flags),
  assignment: ({ positionalArgs, flags }) => assignmentCommand(positionalArgs, flags),
  checkpoint: ({ positionalArgs, flags }) => checkpointCommand(positionalArgs, flags),
  approve: ({ positionalArgs, flags }) => approveCommand(positionalArgs, flags),
  review: ({ positionalArgs, flags }) => reviewCommand(positionalArgs, flags),
  continue: ({ flags }) => continueCommand(flags),
  status: ({ flags }) => statusCommand(flags),
  revise: ({ flags }) => reviseCommand(flags),
  'check-review': ({ positionalArgs, flags }) => checkReviewCommand(positionalArgs, flags),
  reviewloop: ({ positionalArgs, flags }) => reviewloopCommand(positionalArgs, flags),
  implement: ({ positionalArgs, flags }) => implementCommand(positionalArgs, flags),
  focus: ({ positionalArgs, flags }) => focusCommand(positionalArgs, flags),
  discussion: ({ positionalArgs, flags }) => discussCommand(positionalArgs, flags),
  context: ({ flags }) => contextCommand(flags),
  research: ({ positionalArgs, flags }) => researchCommand(positionalArgs, flags),
}

export async function dispatchCommand(command, positionalArgs, flags) {
  if (command === 'distill') {
    const subcommand = positionalArgs[0]
    if (subcommand === 'done') {
      const doneArgs = positionalArgs.slice(1)
      await distillDoneCommand(doneArgs, flags)
    } else {
      // No subcommand = combined distill
      await distillCommand(flags)
    }
    return
  }

  if (command === 'migrate') {
    const subcommand = positionalArgs[0]
    if (subcommand === 'legacy-assignments') {
      await migrateLegacyAssignmentsCommand(flags)
    } else if (subcommand) {
      console.error(`Unknown migrate subcommand: ${subcommand}`)
      console.log('Run "specdev migrate" for guided migration instructions')
      process.exitCode = 1
    } else {
      await migrateCommand(flags)
    }
    return
  }

  if (command === 'help' || command === '--help' || command === '-h') {
    helpCommand(flags)
    return
  }

  if (command === '--version' || command === '-v') {
    const pkg = await import('../../package.json', { with: { type: 'json' } })
    console.log(pkg.default.version)
    return
  }

  if (!command) {
    helpCommand(flags)
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
