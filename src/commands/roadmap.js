import { join } from 'node:path'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'

export const ROADMAP_STANDARD_FILES = [
  'project_notes/roadmap/designs/core_concepts.md',
  'project_notes/roadmap/designs/source_code_folder_structure.md',
  'project_notes/roadmap/forecast.md',
]

export const ROADMAP_DESIGN_PATTERN = 'project_notes/roadmap/designs/*.md'

export async function roadmapCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  await requireSpecdevDirectory(join(targetDir, '.specdev'))

  const payload = {
    command: 'roadmap',
    version: 1,
    status: 'ready',
    state: 'stateless',
    standard_files: ROADMAP_STANDARD_FILES,
    writable_paths: [ROADMAP_DESIGN_PATTERN, 'project_notes/roadmap/forecast.md'],
    design_rules: {
      word_limit: 'fewer than 800 words per Markdown file (maximum 799)',
      additional_notes:
        'Each note other than core_concepts.md and source_code_folder_structure.md covers one independent feature or module with minimal overlap.',
    },
    forecast_rules: {
      purpose: 'A future-work roadmap of gaps between the approved designs and current code.',
      derivation:
        'When creating or revising forecast.md, quickly inspect current code read-only against the Roadmap designs and identify design-note sections not yet reflected in code.',
      ordering: 'List gaps in dependency order, with each gap as its own Markdown section.',
      section_word_limit: 'fewer than 200 words per section (maximum 199)',
    },
    authority: {
      product_code: 'read_only',
      writes: 'Only the reported roadmap paths after explicit user approval.',
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
  console.log('Standard files:')
  for (const path of payload.standard_files) console.log(`  .specdev/${path}`)
  console.log('Writable paths:')
  for (const path of payload.writable_paths) console.log(`  .specdev/${path}`)
  console.log(`Design word limit: ${payload.design_rules.word_limit}`)
  console.log(`Additional design notes: ${payload.design_rules.additional_notes}`)
  console.log(`Forecast purpose: ${payload.forecast_rules.purpose}`)
  console.log(`Forecast derivation: ${payload.forecast_rules.derivation}`)
  console.log(`Forecast ordering: ${payload.forecast_rules.ordering}`)
  console.log(`Forecast section word limit: ${payload.forecast_rules.section_word_limit}`)
  console.log(`Authority: ${payload.authority.writes}`)
  console.log(`History: ${payload.history}`)
  console.log(`Next: ${payload.next_action}`)
  return payload
}
