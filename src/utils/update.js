import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
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
      'project_scaffolding/_README.md',
      'skills/core',
      'skills/README.md',
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
      'skills/tools/README.md',
      'skills/tools/.gitkeep',
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

/**
 * Updates skill files in .claude/skills/ if they exist
 * Auto-detects by checking for specdev-assignment/SKILL.md
 *
 * @param {string} targetDir - Project root directory
 * @param {Record<string, string>} skillFiles - Map of skill name to content
 * @returns {number} Number of files updated, or 0 if skipped
 */
export function updateSkillFiles(targetDir, skillFiles) {
  const skillsDir = join(targetDir, '.claude', 'skills')
  const markerFile = join(skillsDir, 'specdev-assignment', 'SKILL.md')

  if (!existsSync(markerFile)) {
    return 0
  }

  for (const [skillName, content] of Object.entries(skillFiles)) {
    const skillDir = join(skillsDir, skillName)
    if (!existsSync(skillDir)) {
      mkdirSync(skillDir, { recursive: true })
    }
    writeFileSync(join(skillDir, 'SKILL.md'), content, 'utf-8')
  }

  return Object.keys(skillFiles).length
}

/**
 * Updates the SessionStart hook script if it exists in the target project
 * Auto-detects by checking for .claude/hooks/specdev-session-start.sh
 *
 * @param {string} targetDir - Project root directory
 * @param {string} hookSrcDir - Directory containing source hook scripts (package hooks/)
 * @returns {number} 1 if updated, 0 if skipped
 */
export function updateHookScript(targetDir, hookSrcDir) {
  const hookDest = join(targetDir, '.claude', 'hooks', 'specdev-session-start.sh')

  if (!existsSync(hookDest)) {
    return 0
  }

  const hookSrc = join(hookSrcDir, 'session-start.sh')
  if (!existsSync(hookSrc)) {
    return 0
  }

  const content = readFileSync(hookSrc, 'utf-8')
  writeFileSync(hookDest, content, { mode: 0o755 })
  return 1
}
