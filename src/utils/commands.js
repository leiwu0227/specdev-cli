export const COMMANDS = [
  { name: 'init', usage: 'init', description: 'Initialize portable .specdev state' },
  { name: 'update', usage: 'update', description: 'Update managed runtime files and graph packages' },
  { name: 'start', usage: 'start', description: 'Fill or review project big_picture.md' },
  { name: 'do', usage: 'do <intent>', description: 'Start or resume a focused guided workflow' },
  { name: 'next', usage: 'next', description: 'Show the canonical focused-workflow action' },
  { name: 'step', usage: 'step --json=<output>', description: 'Submit explicit workflow evidence' },
  { name: 'decide', usage: 'decide <value>', description: 'Submit an explicit workflow decision' },
  { name: 'cancel', usage: 'cancel [reason]', description: 'Abandon the focused guided workflow' },
  { name: 'assignment', usage: 'assignment <objective>', description: 'Create an Assignment and readable contract' },
  { name: 'checkpoint', usage: 'checkpoint brainstorm', description: 'Validate the Assignment contract' },
  { name: 'approve', usage: 'approve brainstorm', description: 'Approve the exact contract hash once' },
  { name: 'implement', usage: 'implement', description: 'Run Assignment plan, implementation, evidence, and review' },
  { name: 'reviewloop', usage: 'reviewloop <phase>', description: 'Run configured reviewer with one verification rerun' },
  { name: 'discussion', usage: 'discussion <topic|id>', description: 'Create or resume a concurrent code-read-only Discussion' },
  { name: 'test-audit', usage: 'test-audit <scope|id>', description: 'Audit redundant tests read-only and prepare an Assignment' },
  { name: 'mission', usage: 'mission <subcommand>', description: 'Create, run, pause, inspect, or checkpoint a sequential Mission' },
  { name: 'focus', usage: 'focus <id>', description: 'Set the committed foreground convenience pointer' },
  { name: 'status', usage: 'status', description: 'Show focused workflow state' },
  { name: 'continue', usage: 'continue', description: 'Resume from durable artifacts and workflow state' },
  { name: 'knowledge rebuild', usage: 'knowledge rebuild', description: 'Atomically rebuild disposable SQLite search' },
  { name: 'knowledge search', usage: 'knowledge search <terms>', description: 'OR-search authoritative Markdown knowledge' },
  { name: 'knowledge list', usage: 'knowledge list', description: 'List curated knowledge files' },
  { name: 'knowledge distill', usage: 'knowledge distill', description: 'Prepare an on-demand brief for the current coding CLI' },
  { name: 'skills', usage: 'skills', description: 'List and manage installed skills' },
  { name: 'migrate', usage: 'migrate', description: 'Guide a legacy .specdev layout migration' },
  { name: 'context', usage: 'context', description: 'Show project context for coding agents' },
  { name: 'help', usage: 'help', description: 'Show this help' },
  { name: 'version', usage: '--version, -v', description: 'Show CLI version' },
]

export function formatCommandLine(command) {
  return `  ${command.usage.padEnd(28)} ${command.description}`
}
