import { join } from 'path'
import fse from 'fs-extra'
import { readRegistry, registerGraphPackage, resolveDispatcher, writeRegistry } from 'ripplegraph'

export function workflowRootFor(projectRoot) {
  return join(projectRoot, '.specdev')
}

export function discoverGraphPackages(workflowRoot) {
  const packagesRoot = join(workflowRoot, 'workflows')
  if (!fse.existsSync(packagesRoot)) return []
  return fse
    .readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((id) => fse.existsSync(join(packagesRoot, id, 'graph.json')))
    .sort()
}

export function ensureWorkspaceEngine(projectRoot) {
  const workflowRoot = workflowRootFor(projectRoot)
  const manifestPath = join(workflowRoot, 'workflow.json')
  if (!fse.existsSync(manifestPath)) {
    throw new Error(`missing ${manifestPath}; run 'specdev update' first`)
  }

  const packages = discoverGraphPackages(workflowRoot)
  if (packages.length === 0) {
    throw new Error(`no graph packages found under ${join(workflowRoot, 'workflows')}`)
  }

  fse.ensureDirSync(join(workflowRoot, '.ripplegraph'))
  for (const id of packages) {
    registerGraphPackage({
      workflowRoot,
      packageRoot: join(workflowRoot, 'workflows', id),
      force: true,
    })
  }

  const installed = new Set(packages)
  const registry = readRegistry(workflowRoot)
  const pruned = Object.keys(registry.graphs).filter((id) => !installed.has(id))
  if (pruned.length > 0) {
    for (const id of pruned) delete registry.graphs[id]
    writeRegistry(workflowRoot, registry)
  }

  resolveDispatcher(workflowRoot)
  return {
    workflow_root: workflowRoot,
    status: 'ok',
    registered: packages,
    pruned,
  }
}

export function hasWorkspaceEngine(projectRoot) {
  const workflowRoot = workflowRootFor(projectRoot)
  return (
    fse.existsSync(join(workflowRoot, 'workflow.json')) &&
    discoverGraphPackages(workflowRoot).length > 0
  )
}
