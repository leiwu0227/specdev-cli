import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import fse from 'fs-extra'
import YAML from 'yaml'

const COMMAND_SKILL_MARKERS = [
  join('specdev-assignment', 'SKILL.md'),
  join('specdev-brainstorm', 'SKILL.md'),
  join('specdev-start', 'SKILL.md'),
]

const DEPRECATED_COMMAND_SKILLS = [
  'specdev-brainstorm',
]

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
      } catch { /* ignore parse errors */ }
    }

    // System files and directories to update. NOTE: `workflow.yaml` is
    // intentionally excluded — it is migrated in-place by `migrateWorkflowManifest`
    // so user customisations and contract-version awareness are preserved.
    const systemPaths = [
      '_main.md',
      '_index.md',
      '_guides',
      '_templates',
      'agents',
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
      '.gitignore',
      'knowledge/_index.md',
      'knowledge/workflow_feedback',
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
 * Migrate a user `workflow.yaml` from contract version 1 (or unversioned) to
 * version 2. Idempotent: a manifest already at version 2 is a no-op.
 *
 * Strategy:
 *  - Parse the user manifest and the template manifest.
 *  - For each phase + step that exists in BOTH manifests, fill in missing
 *    canonical fields (`interaction:`, `on_satisfied:`, `requires:`, `produces:`)
 *    from the template. Existing user fields are preserved verbatim — if the
 *    user has hand-edited a field, we emit a warning and skip overwriting it.
 *  - Ensure the top-level `interactions:` block exists (copy from template if
 *    missing).
 *  - Bump `workflow_contract_version` to 2 only after all injections succeed.
 *
 * @param {string} templateManifestPath - absolute path to template workflow.yaml
 * @param {string} userManifestPath - absolute path to installed workflow.yaml
 * @param {{ force?: boolean }} [opts]
 * @returns {{ migrated: boolean, from: number|null, warnings: string[] }}
 */
export function migrateWorkflowManifest(templateManifestPath, userManifestPath, opts = {}) {
  if (!existsSync(userManifestPath)) {
    // No installed manifest → copy the template verbatim.
    if (existsSync(templateManifestPath)) {
      const dir = dirname(userManifestPath)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(userManifestPath, readFileSync(templateManifestPath, 'utf-8'))
      return { migrated: true, from: null, warnings: [] }
    }
    return { migrated: false, from: null, warnings: ['template manifest missing'] }
  }

  const userText = readFileSync(userManifestPath, 'utf-8')
  const userManifest = YAML.parse(userText) || {}
  const fromVersion = typeof userManifest.workflow_contract_version === 'number'
    ? userManifest.workflow_contract_version
    : null

  if (fromVersion === 2) {
    // Already at v2 — leave the user file untouched (idempotent).
    return { migrated: false, from: 2, warnings: [] }
  }

  const templateText = existsSync(templateManifestPath)
    ? readFileSync(templateManifestPath, 'utf-8')
    : null
  if (!templateText) {
    return { migrated: false, from: fromVersion, warnings: ['template manifest missing'] }
  }
  const templateManifest = YAML.parse(templateText) || {}

  const warnings = []
  const force = !!opts.force

  // Walk phases/steps and inject missing canonical fields.
  for (const [phaseName, templatePhase] of Object.entries(templateManifest.phases || {})) {
    if (!userManifest.phases) userManifest.phases = {}
    if (!userManifest.phases[phaseName]) {
      userManifest.phases[phaseName] = JSON.parse(JSON.stringify(templatePhase))
      continue
    }
    const userPhase = userManifest.phases[phaseName]
    if (!Array.isArray(userPhase.steps)) userPhase.steps = []

    for (const templateStep of templatePhase.steps || []) {
      const userStep = userPhase.steps.find((s) => s && s.id === templateStep.id)
      if (!userStep) {
        userPhase.steps.push(JSON.parse(JSON.stringify(templateStep)))
        continue
      }

      // Inject interaction: on command/checkpoint steps if missing.
      if (templateStep.kind === 'command' && templateStep.interaction) {
        if (!userStep.interaction) {
          userStep.interaction = JSON.parse(JSON.stringify(templateStep.interaction))
        } else if (!force) {
          warnings.push(
            `phases.${phaseName}.${templateStep.id}: keeping user-edited interaction: block (run with --force to overwrite)`
          )
        } else {
          userStep.interaction = JSON.parse(JSON.stringify(templateStep.interaction))
        }
      }

      // Inject on_satisfied: on gate steps if missing.
      if (templateStep.kind === 'gate' && templateStep.on_satisfied) {
        if (!userStep.on_satisfied) {
          userStep.on_satisfied = JSON.parse(JSON.stringify(templateStep.on_satisfied))
        } else if (!force) {
          warnings.push(
            `phases.${phaseName}.${templateStep.id}: keeping user-edited on_satisfied: block (run with --force to overwrite)`
          )
        } else {
          userStep.on_satisfied = JSON.parse(JSON.stringify(templateStep.on_satisfied))
        }
      }

      // Ensure requires: / produces: arrays exist (mirror template only when
      // the user hasn't already declared them).
      if (Array.isArray(templateStep.requires) && !Array.isArray(userStep.requires)) {
        userStep.requires = [...templateStep.requires]
      }
      if (Array.isArray(templateStep.produces) && !Array.isArray(userStep.produces)) {
        userStep.produces = [...templateStep.produces]
      }
    }
  }

  // Top-level interactions: copy from template if missing.
  if (!Array.isArray(userManifest.interactions) && Array.isArray(templateManifest.interactions)) {
    userManifest.interactions = JSON.parse(JSON.stringify(templateManifest.interactions))
  } else if (Array.isArray(userManifest.interactions) && Array.isArray(templateManifest.interactions)) {
    // Append any template interaction entry whose id is not already present.
    const haveIds = new Set(userManifest.interactions.map((e) => e && e.id))
    for (const entry of templateManifest.interactions) {
      if (entry && !haveIds.has(entry.id)) {
        userManifest.interactions.push(JSON.parse(JSON.stringify(entry)))
      }
    }
  }

  // Top-level hooks: mirror template entries that are missing.
  if (Array.isArray(templateManifest.hooks)) {
    if (!Array.isArray(userManifest.hooks)) userManifest.hooks = []
    const haveHookIds = new Set(userManifest.hooks.map((h) => h && h.id))
    for (const hook of templateManifest.hooks) {
      if (hook && !haveHookIds.has(hook.id)) {
        userManifest.hooks.push(JSON.parse(JSON.stringify(hook)))
      }
    }
  }

  // Bump version last, after all injections succeeded.
  userManifest.workflow_contract_version = 2

  // Preserve top-level key order similar to the template: version first.
  const orderedKeys = ['workflow_contract_version', 'phases', 'interactions', 'hooks']
  const ordered = {}
  for (const k of orderedKeys) {
    if (k in userManifest) ordered[k] = userManifest[k]
  }
  for (const k of Object.keys(userManifest)) {
    if (!(k in ordered)) ordered[k] = userManifest[k]
  }

  writeFileSync(userManifestPath, YAML.stringify(ordered), 'utf-8')
  return { migrated: true, from: fromVersion, warnings }
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
  const hasAnyManagedSkills = skillDirs.some((skillDirRoot) => {
    const skillsDir = join(targetDir, skillDirRoot)
    return COMMAND_SKILL_MARKERS.some((marker) => existsSync(join(skillsDir, marker)))
  })

  if (!hasAnyManagedSkills) {
    return updates
  }

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
