import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { withGraphOperationScope } from 'ripplegraph'
import { engineCommand, runEngineCommand } from '../src/commands/engine.js'
import { installWorkspaceEngine } from '../src/utils/engine.js'
import { startGuidedRun, stepGuidedNode } from '../src/utils/engine-sync.js'
import { startGuidedCall, readGuidedCall } from '../src/utils/callable-sync.js'

const root = mkdtempSync(join(tmpdir(), 'specdev-operation-scope-'))
const workflowRoot = join(root, '.specdev')
const template = resolve(import.meta.dirname, '../templates/.specdev')
const stdoutWrite = process.stdout.write
const exitCode = process.exitCode
const parse = JSON.parse
try {
  cpSync(template, workflowRoot, { recursive: true })
  installWorkspaceEngine(root)
  startGuidedRun(root, 'project-orientation')

  // An invalid step exercises read, validation, and recovery rendering without mutation.
  let parses = 0
  JSON.parse = function (text, ...args) {
    if (typeof text === 'string' && text.includes('"entry": "inspect-context"')) parses++
    return parse(text, ...args)
  }
  const unscoped = runEngineCommand(workflowRoot, 'step', [], { json: {} })
  const unscopedParses = parses
  parses = 0
  const scoped = await withGraphOperationScope({ workflowRoot }, (context) =>
    runEngineCommand(workflowRoot, 'step', [], { json: {} }, context)
  )
  assert.deepEqual(scoped, unscoped)
  assert.equal(parses, 1)
  assert.ok(unscopedParses > parses)

  // Exercise the production entry point, including its workspace validation.
  parses = 0
  process.stdout.write = () => true
  assert.deepEqual(await engineCommand('step', [], { target: root, json: {} }), unscoped)
  assert.equal(parses, 2, 'workspace validation plus one scoped engine package parse')
  process.stdout.write = stdoutWrite
  JSON.parse = parse

  let expired
  await withGraphOperationScope({ workflowRoot }, (context) => {
    expired = context
    const result = stepGuidedNode(root, 'inspect-context', { ready: false }, context)
    assert.equal(result.state.position.node, 'collect-context')
    assert.equal(
      startGuidedRun(root, 'project-orientation', { context }).state.position.node,
      'collect-context',
      'checkpoint reads remain fresh after a scoped transition'
    )
    const manifestPath = join(workflowRoot, 'workflows/project-orientation/graph.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    manifest.nodes['collect-context'].purpose = 'Changed package purpose'
    writeFileSync(manifestPath, JSON.stringify(manifest))
    assert.equal(
      runEngineCommand(workflowRoot, 'next', [], {}, context).prompt,
      'Changed package purpose',
      'changed package content is not hidden by reuse'
    )
    const input = {
      id: 'D00001',
      path: 'discussion',
      description: 'scope check',
      start_revision: 'abc',
    }
    startGuidedCall(root, 'discussion-lifecycle', 'D00001', input, context)
    assert.equal(readGuidedCall(root, 'D00001', context).state.status, 'active')
  })
  assert.throws(
    () => stepGuidedNode(root, 'collect-context', {}, expired),
    (error) => error.code === 'E_GRAPH_CONTEXT_CLOSED'
  )
  assert.throws(
    () => readGuidedCall(root, 'D00001', expired),
    (error) => error.code === 'E_GRAPH_CONTEXT_CLOSED'
  )

  if (process.argv.includes('--benchmark')) {
    const samples = { unscoped: [], scoped: [] }
    const operation = (context) => runEngineCommand(workflowRoot, 'step', [], { json: {} }, context)
    const measure = async (scoped) => {
      const start = performance.now()
      for (let i = 0; i < 50; i++) {
        if (scoped) await withGraphOperationScope({ workflowRoot }, operation)
        else operation()
      }
      return (performance.now() - start) / 50
    }
    await measure(false)
    await measure(true)
    for (let batch = 0; batch < 21; batch++) {
      for (const mode of batch % 2 ? ['scoped', 'unscoped'] : ['unscoped', 'scoped']) {
        samples[mode].push(await measure(mode === 'scoped'))
      }
    }
    const median = (values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
    console.log(
      'Invalid-step command core, median milliseconds:',
      Object.fromEntries(Object.entries(samples).map(([mode, values]) => [mode, median(values)]))
    )
  }
  console.log('Engine operation scope checks passed')
} finally {
  JSON.parse = parse
  process.stdout.write = stdoutWrite
  process.exitCode = exitCode
  rmSync(root, { recursive: true, force: true })
}
