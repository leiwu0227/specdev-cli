import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

assert.equal(pkg.engines.node, '>=22.13.0')
assert.match(pkg.dependencies.ripplegraph, /^file:vendor\/ripplegraph-\d+\.\d+\.\d+\.tgz$/)
assert.equal(pkg.files.includes('vendor/'), true)
assert.deepEqual(pkg.bundledDependencies, ['ripplegraph'])
assert.equal(pkg.scripts.prepare, 'node ./scripts/prepare-git-install.js')

const packed = spawnSync('npm', ['pack', '--dry-run', '--json'], {
  cwd: root,
  encoding: 'utf8',
})
assert.equal(packed.status, 0, `npm pack failed:\n${packed.stderr}`)
const report = JSON.parse(packed.stdout)[0]
const files = new Set(report.files.map((entry) => entry.path))

assert.equal(files.has('vendor/ripplegraph-0.1.0.tgz'), true)
assert.equal(files.has('node_modules/ripplegraph/package.json'), true)
assert.equal(files.has('templates/.specdev/workflow.json'), true)
assert.equal(files.has('templates/.specdev/_templates/faq.md'), true)
assert.equal(files.has('templates/.specdev/knowledge/faq/.gitkeep'), true)
for (const id of [
  'assignment-lifecycle',
  'discussion-lifecycle',
  'layout-migration',
  'mission-lifecycle',
  'project-orientation',
  'test-audit-lifecycle',
  'workspace-dispatcher',
]) {
  assert.equal(files.has(`templates/.specdev/workflows/${id}/graph.json`), true)
}
assert.equal(files.has('templates/.specdev/workflow.yaml'), false)

const gitSourceDir = mkdtempSync(join(tmpdir(), 'specdev-git-source-test-'))
const installDir = mkdtempSync(join(tmpdir(), 'specdev-install-test-'))
try {
  for (const path of [
    'bin',
    'hooks',
    'scripts',
    'src',
    'templates',
    'vendor',
    'package.json',
    'package-lock.json',
  ]) {
    cpSync(join(root, path), join(gitSourceDir, path), { recursive: true })
  }

  for (const args of [
    ['init', '--quiet'],
    ['add', '.'],
    [
      '-c',
      'user.name=SpecDev Packaging Test',
      '-c',
      'user.email=specdev-packaging@example.invalid',
      'commit',
      '--quiet',
      '-m',
      'packaging fixture',
    ],
  ]) {
    const git = spawnSync('git', args, { cwd: gitSourceDir, encoding: 'utf8' })
    assert.equal(git.status, 0, `git ${args[0]} failed:\n${git.stderr}`)
  }

  const gitUrl = `git+${pathToFileURL(gitSourceDir).href}`
  const install = spawnSync('npm', ['install', '--prefix', installDir, gitUrl], {
    cwd: root,
    encoding: 'utf8',
  })
  assert.equal(install.status, 0, `Git install failed:\n${install.stderr}`)

  const installedCli = join(installDir, 'node_modules', '.bin', 'specdev')
  const version = spawnSync(installedCli, ['--version'], { encoding: 'utf8' })
  assert.equal(version.status, 0, version.stderr)
  assert.equal(version.stdout.trim(), pkg.version)

  const installedPackage = join(installDir, 'node_modules', '@specdev', 'cli')
  const ripplegraph = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', "import('ripplegraph')"],
    { cwd: installedPackage, encoding: 'utf8' }
  )
  assert.equal(ripplegraph.status, 0, ripplegraph.stderr)
} finally {
  rmSync(gitSourceDir, { recursive: true, force: true })
  rmSync(installDir, { recursive: true, force: true })
}

console.log('Engine packaging tests passed.')
