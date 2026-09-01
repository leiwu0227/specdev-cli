import { join } from 'node:path'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'

export const ROADMAP_STANDARD_FILES = [
  'project_notes/roadmap/designs/core_concepts.md',
  'project_notes/roadmap/designs/source_code_folder_structure.md',
  'project_notes/roadmap/forecast.md',
]

export const ROADMAP_DESIGN_PATTERN = 'project_notes/roadmap/designs/**/*.md'

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
      hierarchy:
        'Design notes may be nested in folders that mirror their conceptual parent-child hierarchy; cross-cutting standard files remain at the designs root.',
      additional_notes:
        'Each note other than core_concepts.md and source_code_folder_structure.md covers one independent feature or module with minimal overlap.',
      abstraction:
        'Describe high-level stable abstractions and deliberate design choices without reproducing implementation details.',
      explanation:
        'Describe general concepts and reusable conceptual templates, using examples where they make the intended design obvious.',
      separation:
        'Keep runtime mechanics, verification history, and incidental source-code references out of conceptual design notes; retain only stable abstractions and deliberate tradeoffs.',
      presentation:
        'For design notes, report the intended final destination and concise scope, then write an approved draft as *_draft.md. After writing a draft, report only the draft Markdown path. After user approval, promote the draft to the final .md path and report only the final path. Do not echo full content or diffs unless the user asks.',
    },
    forecast_rules: {
      purpose:
        'A future-work roadmap of approved design requirements that are absent or incomplete in current code.',
      derivation:
        'When creating or revising forecast.md, quickly inspect current code read-only against the Roadmap designs and identify design-note sections not yet reflected in code.',
      comparison_direction:
        'Treat approved designs as the target state: identify code gaps versus the designs, never design gaps versus current code.',
      code_superset:
        'Current code may be a superset of the designs; extra code-only features do not create forecast items or automatic design-note updates.',
      design_updates:
        'The user separately initiates Roadmap collaboration to incorporate code-only features into design notes.',
      ordering:
        'List gaps in dependency order, with each gap as its own numbered Markdown section.',
      references:
        'Each forecast section must identify the Roadmap design note or notes it is based on.',
      section_word_limit: 'fewer than 200 words per section (maximum 199)',
    },
    authority: {
      product_code: 'read_only',
      writes: 'Only the reported roadmap paths after explicit user approval.',
    },
    history: 'No Roadmap IDs, workflow state, receipts, snapshots, or automatic commits.',
    next_action:
      'Read the current roadmap, agree one intended edit, report its destination and concise scope, and wait for explicit user approval before writing a draft.',
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
  console.log(`Design hierarchy: ${payload.design_rules.hierarchy}`)
  console.log(`Additional design notes: ${payload.design_rules.additional_notes}`)
  console.log(`Design abstraction: ${payload.design_rules.abstraction}`)
  console.log(`Design explanation: ${payload.design_rules.explanation}`)
  console.log(`Design separation: ${payload.design_rules.separation}`)
  console.log(`Design presentation: ${payload.design_rules.presentation}`)
  console.log(`Forecast purpose: ${payload.forecast_rules.purpose}`)
  console.log(`Forecast derivation: ${payload.forecast_rules.derivation}`)
  console.log(`Forecast comparison: ${payload.forecast_rules.comparison_direction}`)
  console.log(`Code superset: ${payload.forecast_rules.code_superset}`)
  console.log(`Design updates: ${payload.forecast_rules.design_updates}`)
  console.log(`Forecast ordering: ${payload.forecast_rules.ordering}`)
  console.log(`Forecast references: ${payload.forecast_rules.references}`)
  console.log(`Forecast section word limit: ${payload.forecast_rules.section_word_limit}`)
  console.log(`Authority: ${payload.authority.writes}`)
  console.log(`History: ${payload.history}`)
  console.log(`Next: ${payload.next_action}`)
  return payload
}
