import { join } from 'path'
import fse from 'fs-extra'

const ACTIVE_TOOLS_PATH = join('skills', 'active-tools.json')
const DEFAULT = { tools: {}, agents: [] }

export async function readActiveTools(specdevPath) {
  const filePath = join(specdevPath, ACTIVE_TOOLS_PATH)
  if (!(await fse.pathExists(filePath))) return { ...DEFAULT, tools: {} }
  try {
    return await fse.readJson(filePath)
  } catch {
    return { ...DEFAULT, tools: {} }
  }
}

export async function writeActiveTools(specdevPath, data) {
  const filePath = join(specdevPath, ACTIVE_TOOLS_PATH)
  await fse.ensureDir(join(specdevPath, 'skills'))
  await fse.writeJson(filePath, data, { spaces: 2 })
}

export async function addTool(specdevPath, name, entry) {
  const data = await readActiveTools(specdevPath)
  data.tools[name] = entry
  await writeActiveTools(specdevPath, data)
}

export async function removeTool(specdevPath, name) {
  const data = await readActiveTools(specdevPath)
  delete data.tools[name]
  await writeActiveTools(specdevPath, data)
}
