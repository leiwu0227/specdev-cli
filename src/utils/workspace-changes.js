const WORK_ITEM_PATH = /^\.specdev\/(missions|assignments)\/([^/]+)(?:\/|$)/

export function parseGitPorcelainPaths(output = '') {
  return String(output)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3))
    .filter(Boolean)
}

export function classifyWorkspaceChanges(paths = []) {
  const projectPaths = []
  const workItemPaths = []
  const infrastructurePaths = []
  const workItems = new Map()

  for (const value of paths) {
    const path = String(value || '')
      .trim()
      .replaceAll('\\', '/')
    if (!path) continue
    const workItem = path.match(WORK_ITEM_PATH)
    if (workItem) {
      workItemPaths.push(path)
      const key = `${workItem[1]}/${workItem[2]}`
      workItems.set(key, (workItems.get(key) || 0) + 1)
    } else if (path === '.specdev' || path.startsWith('.specdev/')) {
      infrastructurePaths.push(path)
    } else {
      projectPaths.push(path)
    }
  }

  return {
    total: projectPaths.length + workItemPaths.length + infrastructurePaths.length,
    projectPaths,
    workItemPaths,
    infrastructurePaths,
    workItems: [...workItems].map(([path, pathCount]) => ({ path, pathCount })),
  }
}

export function workspaceChangeSummaryLines(paths = [], options = {}) {
  const { maxProjectPaths = 8, maxWorkItems = 6 } = options
  const changes = classifyWorkspaceChanges(paths)
  if (changes.total === 0) return []

  const lines = [
    `Workspace changes: ${countLabel(changes.projectPaths.length, 'project path')}; ` +
      `${countLabel(changes.workItemPaths.length, 'Mission/Assignment artifact')} across ` +
      `${countLabel(changes.workItems.length, 'work item')}; ` +
      `${countLabel(changes.infrastructurePaths.length, 'SpecDev infrastructure path')}.`,
  ]
  if (changes.projectPaths.length > 0) {
    lines.push(
      `Preserve existing project changes: ${boundedList(changes.projectPaths, maxProjectPaths)}.`
    )
  }
  if (changes.workItems.length > 0) {
    const items = changes.workItems.map(
      (item) => `${item.path} (${countLabel(item.pathCount, 'path')})`
    )
    lines.push(`Project workflow artifacts: ${boundedList(items, maxWorkItems)}.`)
  }
  if (changes.infrastructurePaths.length > 0) {
    lines.push(
      'Infrastructure details hidden (workflows, skills, RippleGraph, and process records).'
    )
  }
  return lines
}

function boundedList(values, limit) {
  const visible = values.slice(0, Math.max(1, limit))
  const remaining = values.length - visible.length
  return `${visible.join(', ')}${remaining > 0 ? ` (+${remaining} more)` : ''}`
}

function countLabel(count, singular) {
  return `${count} ${singular}${count === 1 ? '' : 's'}`
}
