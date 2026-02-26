import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

const TEST_DIR = './test-breakdown-output'

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

function runCmd(args) {
  return spawnSync('node', args, { encoding: 'utf-8' })
}

function assert(condition, msg, detail = '') {
  if (!condition) {
    console.error(`  \u274C ${msg}`)
    if (detail) console.error(`     ${detail}`)
    return false
  }
  console.log(`  \u2713 ${msg}`)
  return true
}

async function runTests() {
  let failures = 0
  cleanup()

  // Setup: init + create assignment with brainstorm artifacts
  runCmd(['./bin/specdev.js', 'init', `--target=${TEST_DIR}`])
  const assignment = join(TEST_DIR, '.specdev/assignments/00001_feature_test')
  mkdirSync(join(assignment, 'brainstorm'), { recursive: true })

  // Test 1: fails without brainstorm artifacts
  console.log('breakdown without brainstorm artifacts:')
  const noArtifacts = runCmd([
    './bin/specdev.js', 'breakdown',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  if (!assert(noArtifacts.status === 1, 'exits non-zero without design.md')) failures++

  // Test 2: succeeds with design.md
  console.log('\nbreakdown with design.md:')
  writeFileSync(join(assignment, 'brainstorm', 'design.md'), '# Design\n\n## Architecture\nSome design content.\n')
  writeFileSync(join(assignment, 'brainstorm', 'proposal.md'), '# Proposal\n')
  const withDesign = runCmd([
    './bin/specdev.js', 'breakdown',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  if (!assert(withDesign.status === 0, 'exits 0 with design.md', withDesign.stderr)) failures++

  // Test 3: creates breakdown subdirectory
  if (!assert(existsSync(join(assignment, 'breakdown')), 'creates breakdown/ subdirectory')) failures++
  if (!assert(existsSync(join(assignment, 'breakdown', 'metadata.json')), 'writes breakdown/metadata.json')) failures++
  if (!assert(existsSync(join(assignment, 'implementation')), 'creates implementation/ subdirectory')) failures++
  if (!assert(existsSync(join(assignment, 'implementation', 'progress.json')), 'creates implementation/progress.json')) failures++
  if (existsSync(join(assignment, 'breakdown', 'metadata.json'))) {
    const metadata = JSON.parse(readFileSync(join(assignment, 'breakdown', 'metadata.json'), 'utf-8'))
    if (!assert(metadata.based_on_brainstorm_revision === 0, 'metadata defaults to brainstorm revision 0')) failures++
  }

  // Test 4: auto-chains implementation guidance
  console.log('\nbreakdown auto-chains implementation:')
  if (!assert(withDesign.stdout.includes('implementation starts automatically'), 'prints auto-chain message', withDesign.stdout)) failures++
  if (!assert(withDesign.stdout.includes('implementing/SKILL.md'), 'references implementing SKILL.md', withDesign.stdout)) failures++
  if (!assert(withDesign.stdout.includes('Per-task flow:'), 'prints per-task flow', withDesign.stdout)) failures++
  if (!assert(withDesign.stdout.includes('Implementation artifacts initialized automatically'), 'prints implementation initialization message', withDesign.stdout)) failures++
  if (!assert(!withDesign.stdout.includes('run specdev implement'), 'does not tell agent to run specdev implement', withDesign.stdout)) failures++

  // Test 5: prints tool skills when they exist
  console.log('\nbreakdown with tool skills:')
  cleanup()
  runCmd(['./bin/specdev.js', 'init', `--target=${TEST_DIR}`])
  const assignment2 = join(TEST_DIR, '.specdev/assignments/00001_feature_test')
  mkdirSync(join(assignment2, 'brainstorm'), { recursive: true })
  writeFileSync(join(assignment2, 'brainstorm', 'design.md'), '# Design\n\n## Architecture\nSome design content.\n')

  // Create a tool skill
  const toolSkillDir = join(TEST_DIR, '.specdev/skills/tools/fake-tool')
  mkdirSync(toolSkillDir, { recursive: true })
  writeFileSync(join(toolSkillDir, 'SKILL.md'), '---\nname: fake-tool\ndescription: A fake tool for testing\n---\n# Fake Tool\n')

  const withToolSkill = runCmd([
    './bin/specdev.js', 'breakdown',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  if (!assert(withToolSkill.status === 0, 'exits 0 with tool skills present', withToolSkill.stderr)) failures++
  if (!assert(withToolSkill.stdout.includes('Available tool skills:'), 'prints "Available tool skills:" header', withToolSkill.stdout)) failures++
  if (!assert(withToolSkill.stdout.includes('fake-tool'), 'prints tool skill name', withToolSkill.stdout)) failures++
  if (!assert(withToolSkill.stdout.includes('A fake tool for testing'), 'prints tool skill description', withToolSkill.stdout)) failures++

  cleanup()
  console.log('')
  if (failures > 0) { console.error(`\u274C ${failures} breakdown test(s) failed`); process.exit(1) }
  console.log('\u2705 All breakdown tests passed')
}

runTests()
