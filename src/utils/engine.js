import { join } from 'path'
import { createHash } from 'node:crypto'
import fse from 'fs-extra'
import {
  loadGraphPackage,
  readRegistry,
  registerGraphPackage,
  resolveDispatcher,
  writeRegistry,
} from 'ripplegraph'

const WORKFLOW_CATALOG = 'catalog.json'

export function workflowRootFor(projectRoot) {
  return join(projectRoot, '.specdev')
}

export function discoverGraphPackages(workflowRoot) {
  const packagesRoot = join(workflowRoot, 'workflows')
  if (!fse.existsSync(packagesRoot)) return []

  const catalogPath = join(packagesRoot, WORKFLOW_CATALOG)
  if (fse.existsSync(catalogPath)) {
    const catalog = readWorkflowCatalog(packagesRoot)
    return Object.values(catalog.packages)
      .map((entry) => entry.path)
      .sort()
  }

  // Legacy installations stored one flat package directory per graph ID.
  return fse
    .readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((id) => fse.existsSync(join(packagesRoot, id, 'graph.json')))
    .sort()
}

export async function installGraphPackages(sourceWorkflowsRoot, destinationWorkflowsRoot) {
  if (!(await fse.pathExists(sourceWorkflowsRoot))) {
    throw new Error(`missing workflow packages at ${sourceWorkflowsRoot}`)
  }

  await fse.ensureDir(destinationWorkflowsRoot)
  const sourceEntries = await fse.readdir(sourceWorkflowsRoot, { withFileTypes: true })
  const packages = {}

  for (const entry of sourceEntries.filter((candidate) => candidate.isDirectory())) {
    const sourcePackage = join(sourceWorkflowsRoot, entry.name)
    const graphPath = join(sourcePackage, 'graph.json')
    if (!(await fse.pathExists(graphPath))) continue

    const graphPackage = loadGraphPackage(sourcePackage)
    const { id, version, kind } = graphPackage.manifest
    if (packages[id]) {
      throw new Error(`duplicate graph package ID in template: ${id}`)
    }

    const installedName = `${id}@${version}`
    const destinationPackage = join(destinationWorkflowsRoot, installedName)
    if (await fse.pathExists(destinationPackage)) {
      const [sourceDigest, installedDigest] = await Promise.all([
        directoryDigest(sourcePackage),
        directoryDigest(destinationPackage),
      ])
      if (sourceDigest !== installedDigest) {
        throw new Error(`graph package ${id}@${version} changed without a version bump`)
      }
    } else {
      await fse.copy(sourcePackage, destinationPackage, {
        overwrite: false,
        errorOnExist: true,
      })
    }
    packages[id] = { id, version, kind, path: installedName }
  }

  if (Object.keys(packages).length === 0) {
    throw new Error(`no graph packages found under ${sourceWorkflowsRoot}`)
  }

  const catalogPath = join(destinationWorkflowsRoot, WORKFLOW_CATALOG)
  const temporaryCatalogPath = `${catalogPath}.tmp-${process.pid}`
  await fse.writeJson(temporaryCatalogPath, { version: 1, packages }, { spaces: 2 })
  await fse.move(temporaryCatalogPath, catalogPath, { overwrite: true })
  return Object.values(packages)
}

async function directoryDigest(root) {
  const files = []
  await collectFiles(root, root, files)
  const hash = createHash('sha256')
  for (const relativePath of files.sort()) {
    hash.update(relativePath)
    hash.update('\0')
    hash.update(await fse.readFile(join(root, relativePath)))
    hash.update('\0')
  }
  return hash.digest('hex')
}

async function collectFiles(root, current, files) {
  const entries = await fse.readdir(current, { withFileTypes: true })
  for (const entry of entries) {
    const absolutePath = join(current, entry.name)
    const relativePath = absolutePath.slice(root.length + 1).replaceAll('\\', '/')
    if (entry.isDirectory()) await collectFiles(root, absolutePath, files)
    else if (entry.isFile()) files.push(relativePath)
  }
}

export function installWorkspaceEngine(projectRoot) {
  const workflowRoot = workflowRootFor(projectRoot)
  const manifestPath = join(workflowRoot, 'workflow.json')
  if (!fse.existsSync(manifestPath)) {
    throw new Error(`missing ${manifestPath}; run 'specdev update' first`)
  }

  const packagePaths = discoverGraphPackages(workflowRoot)
  if (packagePaths.length === 0) {
    throw new Error(`no graph packages found under ${join(workflowRoot, 'workflows')}`)
  }

  fse.ensureDirSync(join(workflowRoot, '.ripplegraph'))
  const registered = []
  for (const packagePath of packagePaths) {
    const entry = registerGraphPackage({
      workflowRoot,
      packageRoot: join(workflowRoot, 'workflows', packagePath),
      force: true,
    })
    registered.push(entry.id)
  }

  const installed = new Set(registered)
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
    registered: [...installed].sort(),
    pruned,
  }
}

export function assertWorkspaceEngine(projectRoot) {
  const workflowRoot = workflowRootFor(projectRoot)
  const manifestPath = join(workflowRoot, 'workflow.json')
  if (!fse.existsSync(manifestPath)) {
    throw new Error(`missing ${manifestPath}; run 'specdev update' first`)
  }

  const packagePaths = discoverGraphPackages(workflowRoot)
  if (packagePaths.length === 0) {
    throw new Error(`no graph packages found under ${join(workflowRoot, 'workflows')}`)
  }

  const registry = readRegistry(workflowRoot)
  if (Object.keys(registry.graphs).length === 0) {
    throw new Error(`workflow registry is missing; run 'specdev update' first`)
  }

  for (const packagePath of packagePaths) {
    const graphPackage = loadGraphPackage(join(workflowRoot, 'workflows', packagePath))
    const registered = registry.graphs[graphPackage.manifest.id]
    const expectedPath = `workflows/${packagePath}`
    if (
      !registered ||
      registered.version !== graphPackage.manifest.version ||
      registered.kind !== graphPackage.manifest.kind ||
      registered.path !== expectedPath
    ) {
      throw new Error(
        `workflow ${graphPackage.manifest.id}@${graphPackage.manifest.version} is not registered at ${expectedPath}; run 'specdev update' first`
      )
    }
  }

  resolveDispatcher(workflowRoot)
  return {
    workflow_root: workflowRoot,
    status: 'ok',
    registered: Object.keys(registry.graphs).sort(),
  }
}

export function hasWorkspaceEngine(projectRoot) {
  const workflowRoot = workflowRootFor(projectRoot)
  try {
    return (
      fse.existsSync(join(workflowRoot, 'workflow.json')) &&
      discoverGraphPackages(workflowRoot).length > 0 &&
      Object.keys(readRegistry(workflowRoot).graphs).length > 0
    )
  } catch {
    return false
  }
}

function readWorkflowCatalog(packagesRoot) {
  const catalogPath = join(packagesRoot, WORKFLOW_CATALOG)
  let catalog
  try {
    catalog = fse.readJsonSync(catalogPath)
  } catch (error) {
    throw new Error(`invalid workflow catalog ${catalogPath}: ${error.message}`)
  }
  if (catalog?.version !== 1 || !catalog.packages || typeof catalog.packages !== 'object') {
    throw new Error(`invalid workflow catalog ${catalogPath}: expected version 1 packages`)
  }

  for (const [id, entry] of Object.entries(catalog.packages)) {
    if (
      !entry ||
      entry.id !== id ||
      typeof entry.version !== 'string' ||
      !['dispatcher', 'workflow', 'callable'].includes(entry.kind) ||
      typeof entry.path !== 'string' ||
      !entry.path
    ) {
      throw new Error(`invalid workflow catalog entry: ${id}`)
    }
    if (
      entry.path.includes('/') ||
      entry.path.includes('\\') ||
      entry.path === '.' ||
      entry.path === '..'
    ) {
      throw new Error(`invalid workflow package path in catalog: ${entry.path}`)
    }
    const packageRoot = join(packagesRoot, entry.path)
    if (!fse.existsSync(join(packageRoot, 'graph.json'))) {
      throw new Error(`workflow package is missing: ${entry.path}`)
    }
    const manifest = loadGraphPackage(packageRoot).manifest
    if (manifest.id !== id || manifest.version !== entry.version || manifest.kind !== entry.kind) {
      throw new Error(`workflow catalog entry does not match package: ${id}`)
    }
  }
  return catalog
}
