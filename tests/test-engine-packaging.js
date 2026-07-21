import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

assert.equal(pkg.engines.node, '>=22.13.0')
assert.match(pkg.dependencies.ripplegraph, /^file:vendor\/ripplegraph-\d+\.\d+\.\d+\.tgz$/)
assert.equal(pkg.files.includes('vendor/'), true)
assert.deepEqual(pkg.bundledDependencies, ['ripplegraph'])

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

const packageDir = mkdtempSync(join(tmpdir(), 'specdev-package-test-'))
const installDir = mkdtempSync(join(tmpdir(), 'specdev-install-test-'))
try {
  const pack = spawnSync('npm', ['pack', '--pack-destination', packageDir, '--silent'], {
    cwd: root,
    encoding: 'utf8',
  })
  assert.equal(pack.status, 0, `npm pack failed:\n${pack.stderr}`)
  const tarball = join(
    packageDir,
    readdirSync(packageDir).find((name) => name.endsWith('.tgz'))
  )
  const install = spawnSync(
    'npm',
    ['install', '--ignore-scripts', '--prefix', installDir, tarball],
    {
      cwd: root,
      encoding: 'utf8',
    }
  )
  assert.equal(install.status, 0, `packed install failed:\n${install.stderr}`)
  const installedCli = join(installDir, 'node_modules', '.bin', 'specdev')
  const version = spawnSync(installedCli, ['--version'], { encoding: 'utf8' })
  assert.equal(version.status, 0, version.stderr)
  assert.equal(version.stdout.trim(), pkg.version)
} finally {
  rmSync(packageDir, { recursive: true, force: true })
  rmSync(installDir, { recursive: true, force: true })
}

console.log('Engine packaging tests passed.')
