import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs'
import { dirname, join } from 'path'
import fse from 'fs-extra'
import { installGraphPackages } from './engine.js'

const COMMAND_SKILL_MARKERS = [
  join('specdev-assignment', 'SKILL.md'),
  join('specdev-brainstorm', 'SKILL.md'),
  join('specdev-start', 'SKILL.md'),
]

const DEPRECATED_COMMAND_SKILLS = ['specdev-brainstorm', 'specdev-review', 'specdev-check-review']

const MANAGED_IGNORE_BEGIN = '# BEGIN specdev managed'
const MANAGED_IGNORE_END = '# END specdev managed'
const MANAGED_IGNORE_BLOCK = `${MANAGED_IGNORE_BEGIN}\ncache/\nworktrees/\n${MANAGED_IGNORE_END}`

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
    if (await migrateLegacyWorkflowFeedback(destination)) {
      updatedPaths.push('knowledge/_workflow_feedback -> knowledge/workflow_feedback')
    }

    // Clean up renamed/deleted files from previous versions
    const removePaths = [
      '_router.md',
      '_guides/task',
      '_guides/workflow',
      'skills/core/orientation',
      'skills/tools/autoloop',
      'skills/tools/reviewloop',
      'skills/core/reviewloop/reviewers/codex-with-context.json',
      'skills/core/reviewloop/scripts',
      'skills/core/reviewloop/reviewers',
      'skills/core/reviewloop/review-focus.json',
      'skills/core/breakdown',
      'skills/core/implementing',
      'skills/core/knowledge-capture',
      'skills/core/parallel-worktrees',
      'skills/core/review-agent',
      '_guides/superpowers_exclusions.md',
      '_templates/assignment_examples',
      '_templates/brainstorm-design.md',
      '_templates/gate_checklist.md',
      '_templates/review_report_template.md',
      '_templates/review_request_schema.json',
      '_templates/scaffolding_template.md',
      '_templates/workflow_feedback_note.md',
      'project_notes/assignment_progress.md',
      'project_notes/discussion_progress.md',
      'project_scaffolding/_README.md',
      'agents',
      '_templates/agent-spec.schema.json',
      'knowledge/_workflow_feedback',
    ]
    for (const path of removePaths) {
      const destPath = join(destination, path)
      if (await fse.pathExists(destPath)) {
        await fse.remove(destPath)
      }
    }

    // Remove reviewloop from active-tools.json (promoted to core)
    const activeToolsPath = join(destination, 'skills', 'active-tools.json')
    if (await fse.pathExists(activeToolsPath)) {
      try {
        const activeTools = JSON.parse(await fse.readFile(activeToolsPath, 'utf-8'))
        if (activeTools.tools && activeTools.tools.reviewloop) {
          delete activeTools.tools.reviewloop
          await fse.writeFile(activeToolsPath, JSON.stringify(activeTools, null, 2) + '\n')
        }
      } catch {
        /* ignore parse errors */
      }
    }

    // System-owned files and directories to update. Existing workflow.yaml is
    // deliberately left in place only for assignments already on the legacy runtime.
    const systemPaths = [
      '_main.md',
      '_index.md',
      'workflow.json',
      '_guides',
      '_templates',
      'guides/review.md',
      'guides/library',
      'skills/core',
      'skills/README.md',
    ]

    for (const path of systemPaths) {
      const sourcePath = join(source, path)
      const destPath = join(destination, path)

      // Check if source exists
      if (!(await fse.pathExists(sourcePath))) {
        console.warn(`⚠️  Warning: Source path not found: ${path}`)
        continue
      }

      // Copy the file or directory
      await fse.copy(sourcePath, destPath, {
        overwrite: true,
        errorOnExist: false,
      })

      updatedPaths.push(path)
    }

    // Install graph packages by ID and version. Old package directories stay
    // available for in-flight RippleGraph checkpoints that pin them.
    await installGraphPackages(join(source, 'workflows'), join(destination, 'workflows'))
    updatedPaths.push('workflows')

    // Ensure new project directories exist (create if missing, never overwrite)
    const ensurePaths = [
      '.gitignore',
      'agents.yaml',
      'adhoc/.gitkeep',
      'knowledge/_index.md',
      'knowledge/faq',
      'knowledge/workflow_feedback',
      'knowledge/codestyle',
      'knowledge/architecture',
      'knowledge/domain',
      'knowledge/workflow',
      'knowledge/workflow/adhoc-history.md',
      'guides/project/catalog.yaml',
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

    if (await updateManagedGitignore(destination)) {
      updatedPaths.push('.gitignore (managed entries)')
    }

    return updatedPaths
  } catch (error) {
    throw new Error(`Update failed: ${error.message}`)
  }
}

async function migrateLegacyWorkflowFeedback(specdevPath) {
  const legacyDir = join(specdevPath, 'knowledge', '_workflow_feedback')
  if (!(await fse.pathExists(legacyDir))) return false

  const destinationDir = join(specdevPath, 'knowledge', 'workflow_feedback')
  await fse.ensureDir(destinationDir)
  const entries = await fse.readdir(legacyDir, { withFileTypes: true })
  let migrated = false
  for (const entry of entries) {
    if (entry.name === '.gitkeep') continue
    const sourcePath = join(legacyDir, entry.name)
    const destinationPath = join(destinationDir, entry.name)
    if (await fse.pathExists(destinationPath)) {
      const [sourceStat, destinationStat] = await Promise.all([
        fse.stat(sourcePath),
        fse.stat(destinationPath),
      ])
      let sameFile = false
      if (sourceStat.isFile() && destinationStat.isFile()) {
        const [sourceContent, destinationContent] = await Promise.all([
          fse.readFile(sourcePath),
          fse.readFile(destinationPath),
        ])
        sameFile = sourceContent.equals(destinationContent)
      }
      if (!sameFile) {
        throw new Error(
          `Cannot migrate legacy workflow feedback because the destination already exists: knowledge/workflow_feedback/${entry.name}`
        )
      }
      continue
    }
    await fse.copy(sourcePath, destinationPath, { overwrite: false, errorOnExist: true })
    migrated = true
  }
  return migrated
}

export async function updateManagedGitignore(specdevPath) {
  const ignorePath = join(specdevPath, '.gitignore')
  const existing = (await fse.pathExists(ignorePath)) ? await fse.readFile(ignorePath, 'utf-8') : ''
  const managedPattern = new RegExp(
    `${escapeRegExp(MANAGED_IGNORE_BEGIN)}[\\s\\S]*?${escapeRegExp(MANAGED_IGNORE_END)}`,
    'm'
  )
  const next = managedPattern.test(existing)
    ? existing.replace(managedPattern, MANAGED_IGNORE_BLOCK)
    : `${existing.trimEnd()}${existing.trim() ? '\n\n' : ''}${MANAGED_IGNORE_BLOCK}\n`

  if (next === existing) return false
  await fse.writeFile(ignorePath, next.endsWith('\n') ? next : `${next}\n`, 'utf-8')
  return true
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Checks if a directory is a valid SpecDev installation
 *
 * @param {string} specdevPath - Path to .specdev directory
 * @returns {Promise<boolean>}
 */
export async function isValidSpecdevInstallation(specdevPath) {
  if (!(await fse.pathExists(specdevPath))) {
    return false
  }

  // Check for key system files/directories
  const requiredPaths = [join(specdevPath, '_guides'), join(specdevPath, 'project_notes')]

  for (const path of requiredPaths) {
    if (!(await fse.pathExists(path))) {
      return false
    }
  }

  return true
}

/**
 * Updates managed command skill files in each installed agent skill directory.
 * Auto-detects by checking for known managed command-skill markers.
 *
 * @param {string} targetDir - Project root directory
 * @param {Record<string, string>} skillFiles - Map of skill name to content
 * @param {Array<string>} skillDirs - Agent skill directories relative to targetDir
 * @returns {Array<{path: string, count: number}>} Updated directories
 */
export function updateSkillFiles(targetDir, skillFiles, skillDirs = [join('.claude', 'skills')]) {
  const updates = []
  if (!hasManagedCommandSkills(targetDir, skillDirs)) {
    return updates
  }

  prepareCommandSkillDirectories(targetDir, skillDirs)

  for (const skillDirRoot of skillDirs) {
    const skillsDir = join(targetDir, skillDirRoot)
    for (const [skillName, content] of Object.entries(skillFiles)) {
      const skillDir = join(skillsDir, skillName)
      if (!existsSync(skillDir)) {
        mkdirSync(skillDir, { recursive: true })
      }
      writeFileSync(join(skillDir, 'SKILL.md'), content, 'utf-8')
    }

    for (const deprecatedSkillName of DEPRECATED_COMMAND_SKILLS) {
      const deprecatedSkillDir = join(skillsDir, deprecatedSkillName)
      if (existsSync(deprecatedSkillDir)) {
        rmSync(deprecatedSkillDir, { recursive: true, force: true })
      }
    }

    // Remove stale reviewloop wrapper (promoted to core skill)
    const reviewloopWrapper = join(skillsDir, 'reviewloop')
    if (existsSync(reviewloopWrapper)) {
      rmSync(reviewloopWrapper, { recursive: true, force: true })
    }

    updates.push({ path: skillDirRoot, count: Object.keys(skillFiles).length })
  }

  return updates
}

/**
 * Validates command-skill directory roots before an update mutates managed
 * SpecDev files. Empty regular-file placeholders are safe to replace with the
 * directory the agent expects; non-empty files and non-directory symlinks are
 * preserved and reported as actionable conflicts.
 *
 * @param {string} targetDir - Project root directory
 * @param {Array<string>} skillDirs - Agent skill directories relative to targetDir
 * @returns {Array<string>} Empty placeholder paths replaced with directories
 */
export function prepareCommandSkillDirectories(
  targetDir,
  skillDirs = [join('.claude', 'skills')]
) {
  if (!hasManagedCommandSkills(targetDir, skillDirs)) return []

  const repairable = []
  const conflicts = []

  for (const skillDirRoot of skillDirs) {
    const platformRoot = dirname(skillDirRoot)
    const platformState = commandSkillPathState(targetDir, platformRoot)
    if (platformState === 'empty-file') {
      repairable.push(platformRoot)
      continue
    }
    if (platformState !== 'missing' && platformState !== 'directory') {
      conflicts.push(platformRoot)
      continue
    }

    const skillsState = commandSkillPathState(targetDir, skillDirRoot)
    if (skillsState === 'empty-file') repairable.push(skillDirRoot)
    else if (skillsState !== 'missing' && skillsState !== 'directory') {
      conflicts.push(skillDirRoot)
    }
  }

  if (conflicts.length > 0) {
    const paths = conflicts.map((path) => `'${path}'`).join(', ')
    throw new Error(
      `Cannot install SpecDev command skills because ${paths} must be a directory. ` +
        'Move or rename the existing non-empty file or non-directory symlink, then rerun specdev update.'
    )
  }

  for (const relativePath of repairable) {
    rmSync(join(targetDir, relativePath))
  }
  for (const skillDirRoot of skillDirs) {
    mkdirSync(join(targetDir, skillDirRoot), { recursive: true })
  }

  return repairable
}

function hasManagedCommandSkills(targetDir, skillDirs) {
  return skillDirs.some((skillDirRoot) => {
    const skillsDir = join(targetDir, skillDirRoot)
    return COMMAND_SKILL_MARKERS.some((marker) => existsSync(join(skillsDir, marker)))
  })
}

function commandSkillPathState(targetDir, relativePath) {
  const absolutePath = join(targetDir, relativePath)
  let entry
  try {
    entry = lstatSync(absolutePath)
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return 'missing'
    throw error
  }

  if (entry.isDirectory()) return 'directory'
  if (entry.isFile()) return entry.size === 0 ? 'empty-file' : 'file'
  if (entry.isSymbolicLink()) {
    try {
      return statSync(absolutePath).isDirectory() ? 'directory' : 'symlink'
    } catch {
      return 'symlink'
    }
  }
  return 'other'
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

/**
 * Creates missing platform adapter files (CLAUDE.md, AGENTS.md, .cursor/rules)
 * Never overwrites existing files.
 *
 * @param {string} targetDir - Project root directory
 * @param {Array<{path: string, heading: string}>} adapters - Adapter configs
 * @param {function(string): string} contentFn - Function that generates adapter content from heading
 * @returns {Array<string>} List of created adapter paths
 */
export function backfillAdapters(targetDir, adapters, contentFn) {
  const created = []

  for (const adapter of adapters) {
    const adapterPath = join(targetDir, adapter.path)

    if (existsSync(adapterPath)) {
      continue
    }

    const adapterDir = dirname(adapterPath)
    if (!existsSync(adapterDir)) {
      mkdirSync(adapterDir, { recursive: true })
    }

    writeFileSync(adapterPath, contentFn(adapter.heading), 'utf-8')
    created.push(adapter.path)
  }

  return created
}
