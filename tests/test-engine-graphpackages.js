import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { loadGraphPackage } from 'ripplegraph'
import { installGraphPackages } from '../src/utils/engine.js'

const root = resolve(import.meta.dirname, '..')
const workflowsRoot = join(root, 'templates', '.specdev', 'workflows')
const expectedIds = [
  'assignment-lifecycle',
  'discussion-lifecycle',
  'layout-migration',
  'mission-lifecycle',
  'project-orientation',
  'test-audit-lifecycle',
  'workspace-dispatcher',
]

const packageIds = readdirSync(workflowsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

assert.deepEqual(packageIds, expectedIds, 'the template ships the expected graph packages')

const packages = packageIds.map((id) => loadGraphPackage(join(workflowsRoot, id)).manifest)
const dispatcher = packages.filter((manifest) => manifest.kind === 'dispatcher')
const workflows = packages.filter((manifest) => manifest.kind === 'workflow')
const callables = packages.filter((manifest) => manifest.kind === 'callable')

assert.equal(dispatcher.length, 1, 'exactly one dispatcher is registered')
assert.equal(dispatcher[0].id, 'workspace-dispatcher')
assert.equal(workflows.length, 4, 'four focused workflows are registered')
assert.equal(callables.length, 2, 'two callable workflows are registered')

for (const graph of workflows) {
  assert.ok(graph.title, `${graph.id} has a product title`)
  assert.ok(graph.description, `${graph.id} has a product description`)
  assert.ok(graph.activationHints.length > 0, `${graph.id} has activation hints`)
  assert.ok(graph.nodes[graph.entry], `${graph.id} entry node exists`)

  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    for (const edge of node.edges || []) {
      assert.ok(graph.nodes[edge.to], `${graph.id}.${nodeId} targets existing node ${edge.to}`)
    }
  }
}

assert.deepEqual(callables.map((graph) => graph.id).sort(), [
  'discussion-lifecycle',
  'test-audit-lifecycle',
])
for (const graph of callables) assert.ok(graph.nodes[graph.entry])

const byId = Object.fromEntries(packages.map((manifest) => [manifest.id, manifest]))
assert.deepEqual(
  Object.keys(byId['assignment-lifecycle'].nodes).filter(
    (id) => byId['assignment-lifecycle'].nodes[id].gate
  ),
  ['approve-contract']
)
assert.deepEqual(
  Object.keys(byId['discussion-lifecycle'].nodes).filter(
    (id) => byId['discussion-lifecycle'].nodes[id].gate
  ),
  []
)
assert.deepEqual(
  Object.keys(byId['layout-migration'].nodes).filter(
    (id) => byId['layout-migration'].nodes[id].gate
  ),
  ['approval']
)
assert.deepEqual(
  Object.keys(byId['mission-lifecycle'].nodes).filter(
    (id) => byId['mission-lifecycle'].nodes[id].gate
  ),
  ['approve-mission']
)
assert.equal(
  byId['mission-lifecycle'].nodes['child-assignment'].workflowRef.graphId,
  'assignment-lifecycle'
)
assert.equal(byId['mission-lifecycle'].nodes['advance-queue'].edges[0].when.gap_open, true)
assert.equal(byId['assignment-lifecycle'].version, '2.2.0')
assert.equal(byId['mission-lifecycle'].version, '1.4.0')
assert.ok(byId['mission-lifecycle'].nodes['execute-wave'])
assert.ok(byId['mission-lifecycle'].nodes['advance-wave'])
assert.ok(byId['assignment-lifecycle'].nodes.failed.terminal)
assert.ok(byId['mission-lifecycle'].nodes.failed.terminal)
assert.equal(
  byId['assignment-lifecycle'].nodes['implementation-review'].edges.at(-1).when.disposition,
  'objective-failure'
)
assert.equal(byId['mission-lifecycle'].nodes['final-verification'].edges.at(-1).to, 'resolve-gap')
assert.ok(byId['mission-lifecycle'].nodes['resolve-gap'])
assert.equal(byId['mission-lifecycle'].nodes.replan, undefined)
assert.deepEqual(
  byId['mission-lifecycle'].nodes['resolve-gap'].outputSchema.properties.disposition.enum,
  [
    'resolution-added',
    'evidence-closed',
    'semantic-failure',
    'authority-failure',
    'infrastructure-failure',
  ]
)
assert.equal(
  byId['mission-lifecycle'].nodes['execute-wave'].outputSchema.properties.wave.type,
  'number'
)
assert.deepEqual(byId['mission-lifecycle'].nodes.design.outputSchema.required, [
  'queue',
  'attempt',
  'parallel',
])

const workspace = JSON.parse(
  readFileSync(join(root, 'templates', '.specdev', 'workflow.json'), 'utf8')
)
assert.equal(workspace.entryGraph, 'workspace-dispatcher')
assert.equal(existsSync(join(root, 'templates', '.specdev', 'workflow.yaml')), false)

const installRoot = mkdtempSync(join(tmpdir(), 'specdev-graph-packages-'))
try {
  const installed = await installGraphPackages(workflowsRoot, installRoot)
  assert.equal(installed.length, expectedIds.length)
  const catalog = JSON.parse(readFileSync(join(installRoot, 'catalog.json'), 'utf8'))
  assert.equal(catalog.packages['assignment-lifecycle'].path, 'assignment-lifecycle@2.2.0')
  assert.equal(catalog.packages['mission-lifecycle'].path, 'mission-lifecycle@1.4.0')
  const installedGraph = join(installRoot, 'assignment-lifecycle@2.2.0', 'graph.json')
  writeFileSync(installedGraph, `${readFileSync(installedGraph, 'utf8')}\n`)
  await assert.rejects(
    installGraphPackages(workflowsRoot, installRoot),
    /changed without a version bump/
  )
} finally {
  rmSync(installRoot, { recursive: true, force: true })
}

console.log('Engine graph package tests passed.')
