export const COMMANDS = [
  { name: 'init', usage: 'init', description: 'Initialize portable .specdev state' },
  {
    name: 'update',
    usage: 'update',
    description: 'Update managed runtime files and graph packages',
  },
  { name: 'start', usage: 'start', description: 'Fill or review project big_picture.md' },
  { name: 'do', usage: 'do <intent>', description: 'Start or resume a focused guided workflow' },
  {
    name: 'adhoc',
    usage: 'adhoc <start|verify|finish|status|show|cancel>',
    description: 'Run one user-selected bounded change with a receipt and final commit',
  },
  { name: 'next', usage: 'next', description: 'Show the canonical focused-workflow action' },
  { name: 'step', usage: 'step --json=<output>', description: 'Submit explicit workflow evidence' },
  { name: 'decide', usage: 'decide <value>', description: 'Submit an explicit workflow decision' },
  { name: 'cancel', usage: 'cancel <reason>', description: 'Abandon the focused guided workflow' },
  {
    name: 'assignment',
    usage: 'assignment <objective>|shelf <id>',
    description: 'Create, succeed, or shelf a standalone Assignment',
  },
  {
    name: 'checkpoint',
    usage: 'checkpoint brainstorm',
    description: 'Validate the Assignment contract',
  },
  {
    name: 'approve',
    usage: 'approve brainstorm',
    description: 'Approve the exact contract hash once',
  },
  {
    name: 'implement',
    usage: 'implement',
    description: 'Run Assignment plan, implementation, evidence, and review',
  },
  {
    name: 'reviewloop',
    usage: 'reviewloop <phase>',
    description: 'Run interactive review or bounded automatic convergence',
  },
  {
    name: 'discussion',
    usage: 'discussion <topic|id>',
    description: 'Create or resume a concurrent code-read-only Discussion',
  },
  {
    name: 'roadmap',
    usage: 'roadmap',
    description: 'Collaborate on user-approved roadmap notes without workflow state',
  },
  {
    name: 'test-audit',
    usage: 'test-audit <scope|id>',
    description: 'Audit redundant tests read-only and prepare an Assignment',
  },
  {
    name: 'mission',
    usage: 'mission <subcommand>',
    description:
      'Create, run, inspect, decide reapproval, checkpoint, adopt, hand off, or land a Mission',
  },
  {
    name: 'focus',
    usage: 'focus <id>',
    description: 'Set the committed foreground convenience pointer',
  },
  {
    name: 'status',
    usage: 'status [--json] [--history]',
    description: 'Show active work, or explicit run history',
  },
  {
    name: 'continue',
    usage: 'continue',
    description: 'Resume from durable artifacts and workflow state',
  },
  {
    name: 'knowledge rebuild',
    usage: 'knowledge rebuild',
    description: 'Atomically rebuild disposable SQLite search',
  },
  {
    name: 'knowledge search',
    usage: 'knowledge search <terms>',
    description: 'OR-search authoritative Markdown knowledge',
  },
  { name: 'knowledge list', usage: 'knowledge list', description: 'List curated knowledge files' },
  {
    name: 'knowledge curate',
    usage: 'knowledge curate',
    description: 'Propose, approve, publish, and reindex living knowledge',
  },
  {
    name: 'knowledge distill',
    usage: 'knowledge distill',
    description: 'Prepare an on-demand brief for the current coding CLI',
  },
  { name: 'skills', usage: 'skills', description: 'List and manage installed skills' },
  { name: 'migrate', usage: 'migrate', description: 'Guide a legacy .specdev layout migration' },
  { name: 'context', usage: 'context', description: 'Show project context for coding agents' },
  { name: 'help', usage: 'help', description: 'Show this help' },
  { name: 'version', usage: '--version, -v', description: 'Show CLI version' },
]

export function formatCommandLine(command) {
  return `  ${command.usage.padEnd(28)} ${command.description}`
}
