import { join, dirname } from 'path'
import fse from 'fs-extra'
import { resolveAssignmentPath } from '../utils/assignment.js'

export async function progressCommand(positionalArgs = [], flags = {}) {
  const assignmentPath = await resolveAssignmentPath(flags)
  const planPath = join(assignmentPath, 'breakdown', 'plan.md')
  const progressPath = join(assignmentPath, 'implementation', 'progress.json')

  if (!(await fse.pathExists(planPath))) {
    console.error('❌ No breakdown/plan.md found')
    console.log('   Complete the breakdown phase first with: specdev breakdown')
    process.exitCode = 1
    return
  }

  await ensureProgressFile(planPath, progressPath)

  const first = positionalArgs[0]
  const second = positionalArgs[1]

  if (!first || first === 'summary') {
    const data = await fse.readJson(progressPath)
    printSummary(data)
    return
  }

  if (!/^\d+$/.test(first)) {
    console.error('❌ Task number must be a positive integer')
    console.log('   Usage: specdev progress [summary]')
    console.log('          specdev progress <task-number> <started|completed>')
    process.exitCode = 1
    return
  }
  if (second !== 'started' && second !== 'completed') {
    console.error("❌ Action must be 'started' or 'completed'")
    console.log('   Usage: specdev progress <task-number> <started|completed>')
    process.exitCode = 1
    return
  }

  const taskNum = Number.parseInt(first, 10)
  const data = await fse.readJson(progressPath)
  const task = data.tasks.find((t) => t.number === taskNum)
  if (!task) {
    console.error(`❌ Task ${taskNum} not found in plan progress`)
    process.exitCode = 1
    return
  }

  const now = new Date().toISOString()
  if (second === 'started') {
    task.status = 'in_progress'
    task.started_at = now
    await fse.writeJson(progressPath, data, { spaces: 2 })
    console.log(`Task ${taskNum}: started`)
    return
  }

  task.status = 'completed'
  task.completed_at = now
  await fse.writeJson(progressPath, data, { spaces: 2 })
  console.log(`Task ${taskNum}: completed`)
}

async function ensureProgressFile(planPath, progressPath) {
  await fse.ensureDir(dirname(progressPath))
  if (await fse.pathExists(progressPath)) return

  const content = await fse.readFile(planPath, 'utf-8')
  const taskCount = (content.match(/^### Task [0-9]/gm) || []).length
  const tasks = []
  for (let i = 1; i <= taskCount; i++) {
    tasks.push({ number: i, status: 'pending', started_at: null, completed_at: null })
  }
  await fse.writeJson(
    progressPath,
    { plan_file: planPath, total_tasks: taskCount, tasks },
    { spaces: 2 }
  )
}

function printSummary(data) {
  let completed = 0
  let inProgress = 0
  let pending = 0
  for (const t of data.tasks) {
    if (t.status === 'completed') completed++
    else if (t.status === 'in_progress') inProgress++
    else pending++
  }
  console.log(
    `Progress: ${completed}/${data.total_tasks} completed, ${inProgress} in progress, ${pending} pending`
  )
}
