import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { loadGraphPackage } from 'ripplegraph'

const root = resolve(import.meta.dirname, '..')
const workflowsRoot = join(root, 'templates', '.specdev', 'workflows')
const expectedIds = [
  'assignment-lifecycle',
  'discussion-lifecycle',
  'knowledge-distillation',
  'layout-migration',
  'project-orientation',
  'workspace-dispatcher',
]

const packageIds = readdirSync(workflowsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

assert.deepEqual(packageIds, expectedIds, 'the template ships exactly six graph packages')

const packages = packageIds.map((id) => loadGraphPackage(join(workflowsRoot, id)).manifest)
const dispatcher = packages.filter((manifest) => manifest.kind === 'dispatcher')
const workflows = packages.filter((manifest) => manifest.kind === 'workflow')

assert.equal(dispatcher.length, 1, 'exactly one dispatcher is registered')
assert.equal(dispatcher[0].id, 'workspace-dispatcher')
assert.equal(workflows.length, 5, 'five executable workflows are registered')

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

const byId = Object.fromEntries(packages.map((manifest) => [manifest.id, manifest]))
assert.deepEqual(
  Object.keys(byId['assignment-lifecycle'].nodes).filter(
    (id) => byId['assignment-lifecycle'].nodes[id].gate
  ),
  ['brainstorm-review-choice', 'implementation-review-choice']
)
assert.deepEqual(
  Object.keys(byId['discussion-lifecycle'].nodes).filter(
    (id) => byId['discussion-lifecycle'].nodes[id].gate
  ),
  ['review-choice']
)
assert.deepEqual(
  Object.keys(byId['layout-migration'].nodes).filter(
    (id) => byId['layout-migration'].nodes[id].gate
  ),
  ['approval']
)
assert.deepEqual(
  Object.keys(byId['knowledge-distillation'].nodes).filter(
    (id) => byId['knowledge-distillation'].nodes[id].gate
  ),
  ['mode-choice', 'review-suggestions']
)

const workspace = JSON.parse(
  readFileSync(join(root, 'templates', '.specdev', 'workflow.json'), 'utf8')
)
assert.equal(workspace.entryGraph, 'workspace-dispatcher')
assert.equal(existsSync(join(root, 'templates', '.specdev', 'workflow.yaml')), false)

console.log('Engine graph package tests passed.')
