import { join } from 'node:path'
import fse from 'fs-extra'
import { initCommand } from './init.js'
import { updateCommand } from './update.js'
import { helpCommand } from './help.js'
import { skillsCommand } from './skills.js'
import { startCommand } from './start.js'
import { assignmentCommand } from './assignment.js'
import { checkpointCommand } from './checkpoint.js'
import { approveCommand } from './approve.js'
import { migrateCommand } from './migrate.js'
import { migrateLegacyAssignmentsCommand } from './migrate-legacy-assignments.js'
import { continueCommand } from './continue.js'
import { reviewloopCommand } from './reviewloop.js'
import { implementCommand } from './implement.js'
import { focusCommand } from './focus.js'
import { discussCommand } from './discussion.js'
import { roadmapCommand } from './roadmap.js'
import { statusCommand } from './status.js'
import { nextCommand } from './next.js'
import { knowledgeCommand } from './knowledge.js'
import { contextCommand } from './context.js'
import { engineCommand } from './engine.js'
import { missionCommand } from './mission.js'
import { testAuditCommand } from './test-audit.js'
import { adhocCommand } from './adhoc.js'
import { resolveTargetDir } from '../utils/command-context.js'
import { readFocusedRevalidation } from '../utils/adhoc-focused.js'

const ASSIGNMENT_ADVANCING_COMMANDS = new Set([
  'start',
  'assignment',
  'checkpoint',
  'approve',
  'continue',
  'next',
  'reviewloop',
  'implement',
  'focus',
  'mission',
  'do',
  'decide',
  'step',
  'action',
  'cancel',
])

const commandHandlers = {
  init: ({ flags }) => initCommand(flags),
  update: ({ flags }) => updateCommand(flags),
  skills: ({ positionalArgs, flags }) => skillsCommand(positionalArgs, flags),
  knowledge: ({ positionalArgs, flags }) => knowledgeCommand(positionalArgs, flags),
  start: ({ flags }) => startCommand(flags),
  assignment: ({ positionalArgs, flags }) => assignmentCommand(positionalArgs, flags),
  checkpoint: ({ positionalArgs, flags }) => checkpointCommand(positionalArgs, flags),
  approve: ({ positionalArgs, flags }) => approveCommand(positionalArgs, flags),
  continue: ({ flags }) => continueCommand(flags),
  status: ({ flags }) => statusCommand(flags),
  next: ({ flags }) => nextCommand(flags),
  reviewloop: ({ positionalArgs, flags }) => reviewloopCommand(positionalArgs, flags),
  implement: ({ positionalArgs, flags }) => implementCommand(positionalArgs, flags),
  focus: ({ positionalArgs, flags }) => focusCommand(positionalArgs, flags),
  discussion: ({ positionalArgs, flags }) => discussCommand(positionalArgs, flags),
  roadmap: ({ flags }) => roadmapCommand(flags),
  mission: ({ positionalArgs, flags }) => missionCommand(positionalArgs, flags),
  'test-audit': ({ positionalArgs, flags }) => testAuditCommand(positionalArgs, flags),
  adhoc: ({ positionalArgs, flags }) => adhocCommand(positionalArgs, flags),
  context: ({ flags }) => contextCommand(flags),
}

export async function dispatchCommand(command, positionalArgs, flags) {
  if (flags.help || flags.h) {
    if (command === 'assignment' && ['shelf', 'close'].includes(positionalArgs[0])) {
      await assignmentCommand(positionalArgs, flags)
      return
    }
    helpCommand(flags)
    return
  }
  if (await blockFocusedAdvanceDuringAdhoc(command, flags)) return
  if (await blockFocusedAdvanceForRevalidation(command, positionalArgs, flags)) return
  if (['do', 'decide', 'step', 'action', 'cancel'].includes(command)) {
    await engineCommand(command, positionalArgs, flags)
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

async function blockFocusedAdvanceDuringAdhoc(command, flags) {
  if (!ASSIGNMENT_ADVANCING_COMMANDS.has(command)) return false
  const activePath = join(resolveTargetDir(flags), '.specdev', 'cache', 'adhoc.json')
  if (!(await fse.pathExists(activePath))) return false
  const active = await fse.readJson(activePath).catch(() => null)
  const focused =
    active?.focused_coexistence ||
    (active?.assignment_coexistence
      ? { kind: 'assignment', ...active.assignment_coexistence }
      : null)
  const payload = {
    command,
    version: 1,
    status: 'blocked',
    state: 'adhoc_detour_active',
    adhoc: active ? { id: active.id, scope: active.scope } : null,
    focused,
    assignment: focused?.kind === 'assignment' ? focused : null,
    mission: focused?.kind === 'mission' ? focused : null,
    next_action:
      'Finish or cancel the active Adhoc before approving, reviewing, executing, replacing, terminating, or changing focused workflow state.',
  }
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else {
    const label = active?.id || '(unreadable active state)'
    const focusedLabel = focused
      ? ` preserves ${focused.kind === 'mission' ? 'Mission' : 'Assignment'} ${focused.id}`
      : ''
    console.error(`Command blocked while Adhoc ${label}${focusedLabel}.`)
    console.error(`Next: ${payload.next_action}`)
  }
  process.exitCode = 1
  return true
}

async function blockFocusedAdvanceForRevalidation(command, positionalArgs, flags) {
  if (!ASSIGNMENT_ADVANCING_COMMANDS.has(command)) return false
  if (isExplicitTerminalResolution(command, positionalArgs)) return false
  const targetDir = resolveTargetDir(flags)
  const pending = await readFocusedRevalidation(join(targetDir, '.specdev'))
  if (!pending) return false
  const payload = {
    command,
    version: 1,
    status: 'blocked',
    state: 'focused_revalidation_required',
    focused: pending.owner,
    revalidation: pending.obligation,
    next_action:
      'Recheck affected contract assumptions, then run specdev adhoc revalidate --contract=unchanged --outcome="<summary>".',
  }
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else {
    const kind = pending.owner.kind === 'mission' ? 'Mission' : 'Assignment'
    console.error(`${kind} ${pending.owner.id} is blocked on post-Adhoc revalidation.`)
    console.error(`Next: ${payload.next_action}`)
  }
  process.exitCode = 1
  return true
}

function isExplicitTerminalResolution(command, positionalArgs) {
  if (command === 'cancel') return true
  if (command === 'assignment' && ['shelf', 'close'].includes(positionalArgs[0])) return true
  return command === 'mission' && positionalArgs[0] === 'abandon'
}
