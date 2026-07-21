import { join } from 'node:path'
import fse from 'fs-extra'
import { getState, listCallableCalls } from 'ripplegraph'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import { readCurrentFocus } from '../utils/current.js'
import { hasWorkspaceEngine, workflowRootFor } from '../utils/engine.js'
import { COMMANDS } from '../utils/commands.js'
import { scanSkillsDir } from '../utils/skills.js'
import { KNOWLEDGE_DB_SUBPATH } from '../utils/knowledge.js'

export async function contextCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)
  const pkg = await import('../../package.json', { with: { type: 'json' } })
  const focus = await readCurrentFocus(specdevPath)
  const workflow = hasWorkspaceEngine(targetDir)
    ? getState({ workflowRoot: workflowRootFor(targetDir) })
    : null
  const discussions = hasWorkspaceEngine(targetDir)
    ? listCallableCalls({ workflowRoot: workflowRootFor(targetDir) }).calls
        .filter((call) => call.graphId === 'discussion-lifecycle')
    : []
  const knowledgeFileCount = await countMarkdownFiles(join(specdevPath, 'knowledge'))
  const coreSkills = await scanSkillsDir(join(specdevPath, 'skills', 'core'), 'core')
  const toolSkills = await scanSkillsDir(join(specdevPath, 'skills', 'tools'), 'tool')
  const payload = {
    command: 'context',
    version: 2,
    cli_version: pkg.default.version,
    release_date: pkg.default.releaseDate || null,
    focus,
    focused_workflow: workflow ? {
      status: workflow.status,
      graph: workflow.run?.rootGraph || null,
      node: workflow.position?.node || null,
    } : null,
    discussions: discussions.map((call) => ({ id: call.id, status: call.status, node: call.position?.node, updated_at: call.updatedAt })),
    knowledge: {
      file_count: knowledgeFileCount,
      index_exists: await fse.pathExists(join(specdevPath, KNOWLEDGE_DB_SUBPATH)),
    },
    skills: { core: coreSkills.map((skill) => skill.name), tools: toolSkills.map((skill) => skill.name) },
    commands: COMMANDS,
  }
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else {
    console.log(`SpecDev Context v${payload.cli_version}`)
    console.log(`Focus: ${focus ? `${focus.kind}:${focus.id}` : 'none'}`)
    console.log(`Workflow: ${payload.focused_workflow?.graph || 'idle'}${payload.focused_workflow?.node ? ` / ${payload.focused_workflow.node}` : ''}`)
    console.log(`Discussions: ${payload.discussions.length}`)
    console.log(`Knowledge files: ${payload.knowledge.file_count}`)
    console.log(`Skills: ${payload.skills.core.length} core, ${payload.skills.tools.length} tools`)
  }
  return payload
}

async function countMarkdownFiles(root) {
  if (!(await fse.pathExists(root))) return 0
  let count = 0
  for (const entry of await fse.readdir(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const path = join(root, entry.name)
    if (entry.isDirectory()) count += await countMarkdownFiles(path)
    else if (entry.isFile() && entry.name.endsWith('.md')) count += 1
  }
  return count
}
