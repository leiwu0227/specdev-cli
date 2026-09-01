import { join } from 'node:path'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'

export const ROADMAP_FILES = [
  'project_notes/roadmap/designs/core_concepts.md',
  'project_notes/roadmap/designs/source_code_folder_structure.md',
  'project_notes/roadmap/forecast.md',
]

export async function roadmapCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  await requireSpecdevDirectory(join(targetDir, '.specdev'))

  const payload = {
    command: 'roadmap',
    version: 1,
    status: 'ready',
    state: 'stateless',
    files: ROADMAP_FILES,
    authority: {
      product_code: 'read_only',
      writes: 'Only the listed roadmap Markdown files after explicit user approval.',
    },
    history: 'No Roadmap IDs, workflow state, receipts, snapshots, or automatic commits.',
    next_action:
      'Read the current roadmap, collaborate on one exact proposed edit, and wait for explicit user approval before writing it.',
  }

  if (flags.json) {
    console.log(JSON.stringify(payload, null, 2))
    return payload
  }

  console.log('SpecDev Roadmap')
  console.log('State: stateless')
  console.log('Allowed files:')
  for (const path of payload.files) console.log(`  .specdev/${path}`)
  console.log(`Authority: ${payload.authority.writes}`)
  console.log(`History: ${payload.history}`)
  console.log(`Next: ${payload.next_action}`)
  return payload
}
