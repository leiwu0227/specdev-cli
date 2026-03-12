import { join } from 'path'
import fse from 'fs-extra'

const CURRENT_FILE = '.current'

export async function readCurrent(specdevPath) {
  const filePath = join(specdevPath, CURRENT_FILE)
  if (!(await fse.pathExists(filePath))) return null
  const content = (await fse.readFile(filePath, 'utf-8')).trim()
  if (!content) return null
  return content
}

export async function writeCurrent(specdevPath, assignmentName) {
  const filePath = join(specdevPath, CURRENT_FILE)
  await fse.writeFile(filePath, assignmentName, 'utf-8')
}

export async function clearCurrent(specdevPath) {
  const filePath = join(specdevPath, CURRENT_FILE)
  if (await fse.pathExists(filePath)) {
    await fse.remove(filePath)
  }
}

export async function resolveCurrentAssignment(specdevPath) {
  const name = await readCurrent(specdevPath)
  if (!name) return { error: 'missing' }

  const assignmentPath = join(specdevPath, 'assignments', name)
  if (!(await fse.pathExists(assignmentPath))) {
    await clearCurrent(specdevPath)
    return { error: 'stale', name }
  }

  return { name, path: assignmentPath }
}
