import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanupDir, runSpecdev, assertTest } from './helpers.js'

const TEST_DIR = './tests/test-knowledge-output'
let failures = 0
let passes = 0

function assert(condition, msg, detail = '') {
  if (assertTest(condition, msg, detail)) passes++
  else failures++
}

function runCmd(args) {
  return runSpecdev(args)
}

function cleanup() { cleanupDir(TEST_DIR) }

function writeFixture() {
  cleanup()
  runCmd(['init', `--target=${TEST_DIR}`])

  const specdev = join(TEST_DIR, '.specdev')
  writeFileSync(join(specdev, 'project_notes', 'big_picture.md'), [
    '# Project Big Picture',
    '',
    'SpecDev CLI coordinates gated coding-agent workflows and durable project knowledge.',
    '',
  ].join('\n'), 'utf-8')

  mkdirSync(join(specdev, 'knowledge', 'architecture'), { recursive: true })
  writeFileSync(join(specdev, 'knowledge', 'architecture', 'bounded-memory.md'), [
    '# Bounded Memory',
    '',
    'Generated working memory gives agents a compact context layer derived from markdown.',
    'Hyphenated terms like stream-json and agent-runner should be searchable.',
    '',
  ].join('\n'), 'utf-8')
  mkdirSync(join(specdev, 'knowledge', 'architecture', 'nested'), { recursive: true })
  writeFileSync(join(specdev, 'knowledge', 'architecture', 'nested', 'deep.md'), [
    '# Deep Knowledge',
    '',
    'Nested knowledge should be listed.',
    '',
  ].join('\n'), 'utf-8')

  const assignmentPath = join(specdev, 'assignments', '00001_feature_retrieval-cache')
  mkdirSync(join(assignmentPath, 'brainstorm'), { recursive: true })
  mkdirSync(join(assignmentPath, 'breakdown'), { recursive: true })
  mkdirSync(join(assignmentPath, 'capture'), { recursive: true })
  writeFileSync(join(assignmentPath, 'brainstorm', 'proposal.md'), '# Proposal\n\nBuild retrieval cache.\n')
  writeFileSync(join(assignmentPath, 'brainstorm', 'design.md'), '# Design\n\nSQLite FTS stores searchable documents.\n')
  writeFileSync(join(assignmentPath, 'breakdown', 'plan.md'), '# Plan\n\nIndex markdown documents.\n')
  writeFileSync(join(assignmentPath, 'capture', 'project-notes-diff.md'), '# Diff\n\nRetrieval cache added.\n')

  const discussionPath = join(specdev, 'discussions', 'D00001_research_knowledge-search')
  mkdirSync(join(discussionPath, 'brainstorm'), { recursive: true })
  writeFileSync(join(discussionPath, 'brainstorm', 'design.md'), '# Discussion\n\nKnowledge search should be local and rebuildable.\n')
}

writeFixture()

console.log('\nknowledge index --json:')
let result = runCmd(['knowledge', 'index', `--target=${TEST_DIR}`, '--json'])
assert(result.status === 0, 'knowledge index exits 0', result.stderr || result.stdout)
let json = null
try {
  json = JSON.parse(result.stdout)
  assert(true, 'knowledge index --json outputs valid JSON')
} catch {
  assert(false, 'knowledge index --json outputs valid JSON', result.stdout)
}
assert(json?.command === 'knowledge index', 'json command identifies knowledge index')
assert(json?.status === 'ok', 'json status is ok')
assert(json?.database_path === '.specdev/cache/knowledge.sqlite', 'json reports cache path')
assert(json?.document_count >= 6, 'json reports indexed documents')
assert(existsSync(join(TEST_DIR, '.specdev', 'cache', 'knowledge.sqlite')), 'sqlite cache is created')

console.log('\nknowledge search:')
result = runCmd(['knowledge', 'search', 'bounded memory', `--target=${TEST_DIR}`])
assert(result.status === 0, 'knowledge search exits 0', result.stderr || result.stdout)
assert(result.stdout.includes('Knowledge Search: bounded memory'), 'human search prints heading')
assert(result.stdout.includes('knowledge/architecture/bounded-memory.md'), 'human search prints matching path')
assert(result.stdout.includes('Generated working [memory]'), 'human search prints highlighted snippet')

console.log('\nknowledge search hyphenated terms:')
result = runCmd(['knowledge', 'search', 'stream-json', `--target=${TEST_DIR}`])
assert(result.status === 0, 'hyphenated knowledge search exits 0', result.stderr || result.stdout)
assert(result.stdout.includes('bounded-memory.md'), 'hyphenated search returns matching document')

result = runCmd(['knowledge', 'search', 'agent-runner', `--target=${TEST_DIR}`])
assert(result.status === 0, 'second hyphenated knowledge search exits 0', result.stderr || result.stdout)
assert(result.stdout.includes('bounded-memory.md'), 'second hyphenated search returns matching document')

result = runCmd(['knowledge', 'search', 'workflow agent-runner', `--target=${TEST_DIR}`])
assert(result.status === 0, 'mixed hyphenated knowledge search exits 0', result.stderr || result.stdout)

console.log('\nknowledge search --json:')
result = runCmd(['knowledge', 'search', 'bounded memory', `--target=${TEST_DIR}`, '--json'])
assert(result.status === 0, 'knowledge search --json exits 0', result.stderr || result.stdout)
try {
  json = JSON.parse(result.stdout)
  assert(true, 'knowledge search --json outputs valid JSON')
} catch {
  assert(false, 'knowledge search --json outputs valid JSON', result.stdout)
}
assert(json?.command === 'knowledge search', 'search json identifies command')
assert(json?.query === 'bounded memory', 'search json includes query')
assert(json?.results?.some((entry) => entry.path === 'knowledge/architecture/bounded-memory.md'), 'search json includes matching document')

console.log('\nknowledge list --json:')
result = runCmd(['knowledge', 'list', `--target=${TEST_DIR}`, '--json'])
assert(result.status === 0, 'knowledge list exits 0', result.stderr || result.stdout)
try {
  json = JSON.parse(result.stdout)
  assert(true, 'knowledge list --json outputs valid JSON')
} catch {
  assert(false, 'knowledge list --json outputs valid JSON', result.stdout)
}
assert(json?.command === 'knowledge list', 'list json identifies command')
assert(Array.isArray(json?.files), 'list json has files array')
assert(json.files.length > 0, 'list json has at least one file')
const firstFile = json.files[0]
assert(typeof firstFile?.path === 'string', 'file entry has path')
assert(typeof firstFile?.branch === 'string', 'file entry has branch')
assert(typeof firstFile?.title === 'string', 'file entry has title')
assert(typeof json?.branches === 'object' && json.branches !== null, 'list json has branches object')
assert(typeof json.branches.architecture === 'number', 'branches has architecture count')
assert(json.branches.architecture >= 2, 'architecture branch counts nested files')
assert(json.files.some(f => f.path === 'knowledge/architecture/nested/deep.md'), 'list json includes nested knowledge file')

console.log('\nknowledge list human:')
result = runCmd(['knowledge', 'list', `--target=${TEST_DIR}`])
assert(result.status === 0, 'knowledge list human exits 0', result.stderr || result.stdout)
assert(result.stdout.includes('architecture'), 'human list includes architecture branch')
assert(result.stdout.includes('nested/deep.md'), 'human list includes nested knowledge path')

console.log('\nknowledge search auto-builds index:')
writeFixture()
result = runCmd(['knowledge', 'search', 'bounded memory', `--target=${TEST_DIR}`])
assert(result.status === 0, 'knowledge search auto-builds and succeeds')
assert(result.stdout.includes('bounded'), 'auto-built search returns results')

console.log('\nknowledge unknown subcommand:')
result = runCmd(['knowledge', 'unknown', `--target=${TEST_DIR}`])
assert(result.status === 1, 'unknown knowledge subcommand fails')
assert(result.stderr.includes('Unknown knowledge subcommand'), 'unknown subcommand error is clear')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
