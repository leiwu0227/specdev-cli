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

    // Ensure new project directories exist (create if missing, never overwrite)
    const ensurePaths = [
      'knowledge/_index.md',
      'knowledge/_workflow_feedback',
      'knowledge/codestyle',
      'knowledge/architecture',
      'knowledge/domain',
      'knowledge/workflow',
      'skills',
      'skills/README.md',
      'skills/scaffolding-lite.md',
      'skills/scaffolding-full.md',
      'skills/systematic-debugging.md',
      'skills/requesting-code-review.md',
      'skills/receiving-code-review.md',
      'skills/parallel-worktrees.md',
      'skills/verification-before-completion.md',
      'skills/micro-task-planning.md',
      'skills/subagent-driven-development.md',
      'skills/skills_invoked_template.md',
    ]

    for (const path of ensurePaths) {
      const sourcePath = join(source, path)
      const destPath = join(destination, path)

      if (await fse.pathExists(destPath)) {
        continue
      }

      if (await fse.pathExists(sourcePath)) {
        await fse.copy(sourcePath, destPath)
        updatedPaths.push(`${path} (created)`)
      }
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
