import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { runSpecdev, assertTest } from './helpers.js'

const TEST_DIR = join('/tmp', 'specdev-test-discuss')

function setup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(join(TEST_DIR, '.specdev', 'discussions'), { recursive: true })
  mkdirSync(join(TEST_DIR, '.specdev', 'project_notes'), { recursive: true })
  writeFileSync(join(TEST_DIR, '.specdev', 'project_notes', 'big_picture.md'), 'This is a test project with sufficient content to pass the filled check. It contains enough text to exceed the minimum length requirement for validation.', 'utf-8')
}

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

function main() {
  console.log('test-discuss.js')
  setup()

  // Test 1: specdev discussion creates discussion folder
  let r = runSpecdev(['discussion', 'auth ideas', `--target=${TEST_DIR}`, '--json'])
  let ok = assertTest(r.status === 0, 'discussion exits 0', r.stderr)
  const output = JSON.parse(r.stdout)
  ok = assertTest(output.id === 'D0001', 'discussion returns D0001') && ok
  ok = assertTest(existsSync(join(TEST_DIR, '.specdev', 'discussions', 'D0001_auth-ideas', 'brainstorm')), 'discussion creates folder with brainstorm subdir') && ok

  // Test 2: second discussion gets D0002
  r = runSpecdev(['discussion', 'perf tuning', `--target=${TEST_DIR}`, '--json'])
  ok = assertTest(r.status === 0, 'second discussion exits 0', r.stderr) && ok
  const output2 = JSON.parse(r.stdout)
  ok = assertTest(output2.id === 'D0002', 'second discussion returns D0002') && ok

  // Test 3: discussion --list lists discussions
  r = runSpecdev(['discussion', '--list', `--target=${TEST_DIR}`])
  ok = assertTest(r.status === 0, 'discussion --list exits 0', r.stderr) && ok
  ok = assertTest(r.stdout.includes('D0001_auth-ideas'), 'discussion --list shows D0001') && ok
  ok = assertTest(r.stdout.includes('D0002_perf-tuning'), 'discussion --list shows D0002') && ok

  // Test 4: discussion with no description errors
  r = runSpecdev(['discussion', `--target=${TEST_DIR}`])
  ok = assertTest(r.status !== 0, 'discussion with no args exits non-zero') && ok

  // Test 5: help output references 'discussion' not 'discuss'
  r = runSpecdev(['help'])
  ok = assertTest(r.stdout.includes('discussion <desc>'), 'help shows discussion command') && ok
  ok = assertTest(!r.stdout.includes('discuss <desc>'), 'help does not show old discuss command') && ok

  // Test 6: skill file exists with correct frontmatter
  const skillPath = join(process.cwd(), '.claude', 'skills', 'specdev-discussion', 'SKILL.md')
  ok = assertTest(existsSync(skillPath), 'specdev-discussion skill file exists') && ok
  const skillContent = readFileSync(skillPath, 'utf-8')
  ok = assertTest(skillContent.includes('name: specdev-discussion'), 'skill has correct name frontmatter') && ok
  ok = assertTest(skillContent.includes('specdev discussion'), 'skill references correct command name') && ok

  // Test 7: discussion_progress.md template exists
  const templatePath = join(process.cwd(), 'templates', '.specdev', 'project_notes', 'discussion_progress.md')
  ok = assertTest(existsSync(templatePath), 'discussion_progress.md template exists') && ok
  const templateContent = readFileSync(templatePath, 'utf-8')
  ok = assertTest(templateContent.includes('Discussion Progress'), 'template has correct header') && ok
  ok = assertTest(templateContent.includes('Promoted To'), 'template has Promoted To column') && ok

  cleanup()
  if (!ok) process.exit(1)
}

main()
