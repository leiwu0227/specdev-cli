import { join } from 'path'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { resolveTargetDir } from '../utils/command-context.js'
import { blankLine, printLines, printSection } from '../utils/output.js'

/**
 * specdev implement — Set up implementation scaffolding and print instructions
 *
 * Mechanical kickoff: creates directories, initializes progress tracking,
 * and prints the full implementing instructions so the agent can proceed
 * without needing a separate file read.
 */
export async function implementCommand(positionalArgs = [], flags = {}) {
  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)
  const targetDir = resolveTargetDir(flags)

  // Verify plan exists
  const planPath = join(assignmentPath, 'breakdown', 'plan.md')
  if (!await fse.pathExists(planPath)) {
    if (flags.json) {
      console.log(JSON.stringify({ command: 'implement', version: 1, status: 'error', assignment: name, error: 'breakdown/plan.md not found' }, null, 2))
    } else {
      console.error('❌ breakdown/plan.md not found')
      console.log('   Complete breakdown before starting implementation.')
    }
    process.exitCode = 1
    return
  }

  // Create implementation directory. progress.json is lazy-initialized by
  // track-progress.sh on the first call, which seeds it from the plan's task
  // headings. Eagerly writing `{}` here would race that init and leave the file
  // without a `tasks` array, breaking subsequent reads.
  const implDir = join(assignmentPath, 'implementation')
  await fse.ensureDir(implDir)
  const planContent = await fse.readFile(planPath, 'utf8')
  const executionMode = parseExecutionMode(planContent)

  if (flags.json) {
    const taskMatches = planContent.match(/^### Task \d+/gm) || []
    console.log(JSON.stringify({
      command: 'implement',
      version: 1,
      status: 'ok',
      assignment: name,
      plan_path: planPath,
      execution_mode: executionMode,
      task_count: taskMatches.length,
    }, null, 2))
    return
  }

  console.log(`🚀 Implementation ready: ${name}`)
  blankLine()

  // Resolve script paths relative to the project
  const specdevPath = join(targetDir, '.specdev')
  const skillBase = join(specdevPath, 'skills', 'core', 'implementing')
  const extractScript = join(skillBase, 'scripts', 'extract-tasks.sh')
  const prepareScript = join(skillBase, 'scripts', 'prepare-task.sh')
  const completeScript = join(skillBase, 'scripts', 'complete-task.sh')
  const trackScript = join(skillBase, 'scripts', 'track-progress.sh')
  const implementerPrompt = join(skillBase, 'prompts', 'implementer.md')
  const reviewerPrompt = join(skillBase, 'prompts', 'code-reviewer.md')

  printSection('Setup complete:')
  console.log(`   ✓ ${name}/implementation/ created`)
  blankLine()

  printSection('Plan:')
  console.log(`   ${planPath}`)
  console.log(`   Execution mode: ${executionMode}`)
  blankLine()

  printSection('Step 1: Extract tasks')
  console.log(`   Run: bash ${extractScript} ${planPath}`)
  console.log('   This returns a structured JSON task list. Review the tasks.')
  blankLine()

  printSection('Step 2: Execute tasks in batches of 3')
  printLines([
    '   For each task:',
    `     a. Run: bash ${prepareScript} ${planPath} <N>`,
    '        - Use the returned prompt as the task contract',
    '     b. Execute according to the plan execution mode:',
    '        - inline: implement, test, commit, and self-review in this session',
    `        - subagent: dispatch a fresh subagent with the returned prompt and ${implementerPrompt}`,
    '        - parallel: use skills/core/parallel-worktrees/SKILL.md for isolated worktrees',
    '     c. Mode-based review:',
    `        - full: dispatch ${reviewerPrompt} — FAIL/NOT READY blocks; fix → re-review`,
    '        - standard: self-review only',
    '        - lightweight: skip review unless task touched executable logic',
    `     d. Run: bash ${completeScript} ${planPath} <N> "<summary of task changes>"`,
  ])
  blankLine()

  printSection('After each batch of 3:')
  printLines([
    '   1. Run the full test suite',
    '   2. If tests fail: stop, debug, fix before next batch',
    '   3. Report batch summary (tasks completed, tests passing, notable decisions)',
  ])
  blankLine()

  printSection('When all tasks are done:')
  printLines([
    '   1. Run full test suite one final time',
    `   2. Run: bash ${trackScript} ${planPath} summary`,
    '   3. Present summary to the user: what was built, tests passing, notable decisions',
    '   4. Tell the user their options:',
    '      - specdev reviewloop implementation — automated external review',
    '      - specdev review implementation — manual review in a separate session',
    '      - specdev approve implementation — proceed to knowledge capture',
    '   5. Stop and wait for user approval',
  ])
  blankLine()

  printSection('Begin now — extract tasks and start the first batch.')
}

function parseExecutionMode(planContent) {
  const match = planContent.match(/^\*\*Execution Mode:\*\*\s*(inline|subagent|parallel)\s*$/im)
  return match ? match[1].toLowerCase() : 'inline'
}
