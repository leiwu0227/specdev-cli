import fse from 'fs-extra'
import { join } from 'path'

/**
 * Selectively updates SpecDev system files while preserving project-specific files
 *
 * @param {string} source - Template directory path
 * @param {string} destination - Target .specdev directory path
 * @returns {Promise<Array<string>>} List of updated files/directories
 */
export async function updateSpecdevSystem(source, destination) {
  const updatedPaths = []

  try {
    // System files and directories to update
    const systemPaths = [
      '_main.md',
      '_router.md',
      '_guides',
      '_templates',
      'project_scaffolding/_README.md'
    ]

    for (const path of systemPaths) {
      const sourcePath = join(source, path)
      const destPath = join(destination, path)

      // Check if source exists
      if (!await fse.pathExists(sourcePath)) {
        console.warn(`⚠️  Warning: Source path not found: ${path}`)
        continue
      }

      // Copy the file or directory
      await fse.copy(sourcePath, destPath, {
        overwrite: true,
        errorOnExist: false
      })

      updatedPaths.push(path)
    }

    return updatedPaths
  } catch (error) {
    throw new Error(`Update failed: ${error.message}`)
  }
}

/**
 * Checks if a directory is a valid SpecDev installation
 *
 * @param {string} specdevPath - Path to .specdev directory
 * @returns {Promise<boolean>}
 */
export async function isValidSpecdevInstallation(specdevPath) {
  if (!await fse.pathExists(specdevPath)) {
    return false
  }

  // Check for key system files/directories
  const requiredPaths = [
    join(specdevPath, '_guides'),
    join(specdevPath, 'project_notes')
  ]

  for (const path of requiredPaths) {
    if (!await fse.pathExists(path)) {
      return false
    }
  }

  return true
}
