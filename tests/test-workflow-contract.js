import {
  ASSIGNMENT_TYPES,
  REQUIRED_BRAINSTORM_SECTIONS,
  commandPhases,
  artifactPaths,
  gateFields,
  assignmentTypeList,
} from '../src/utils/workflow-contract.js'

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

console.log('\nworkflow contract:')
assert(ASSIGNMENT_TYPES.join(',') === 'feature,bugfix,refactor,familiarization', 'declares assignment types')
assert(assignmentTypeList(' | ') === 'feature | bugfix | refactor | familiarization', 'formats assignment type list')
assert(commandPhases.checkpoint.includes('discussion'), 'checkpoint supports discussion')
assert(commandPhases.approve.join(',') === 'brainstorm,implementation', 'approve phases are gated phases')
assert(REQUIRED_BRAINSTORM_SECTIONS.feature.includes('Success Criteria'), 'feature sections include success criteria')
assert(REQUIRED_BRAINSTORM_SECTIONS.refactor.includes('Non-Goals'), 'refactor sections include non-goals')
assert(artifactPaths.brainstorm.design === 'brainstorm/design.md', 'declares brainstorm design path')
assert(gateFields.implementation === 'implementation_approved', 'declares implementation gate field')

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
