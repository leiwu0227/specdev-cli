import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  updateSpecdevSystem,
  isValidSpecdevInstallation,
  prepareCommandSkillDirectories,
  updateSkillFiles,
  updateHookScript,
  backfillAdapters,
} from '../utils/update.js'
import { SKILL_FILES, ALL_ADAPTERS, COMMAND_SKILL_DIRS, adapterContent } from './init.js'
import { resolveTargetDir } from '../utils/command-context.js'
import { blankLine, printBullets, printSection } from '../utils/output.js'
import { installWorkspaceEngine } from '../utils/engine.js'
import {
  listGuidedCalls,
  readGuidedCall,
  startGuidedCall,
  stepGuidedCall,
} from '../utils/callable-sync.js'
import {
  UPDATE_COMPLETION_GRAPH,
  adaptersNeedAction,
  inspectUpdateAdapters,
  nextUpdateOperationId,
  publicAdapterStatus,
  validateUpdateAdapters,
} from '../utils/update-completion.js'
import {
  inspectMaintenanceQuiescence,
  reconcileMaintenanceQuiescence,
} from '../utils/maintenance-quiescence.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export async function updateCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const dryRun = flags['dry-run']

  const specdevPath = join(targetDir, '.specdev')
  const templatePath = join(__dirname, '../../templates/.specdev')

  // Check if .specdev exists
  const isValid = await isValidSpecdevInstallation(specdevPath)
  if (!isValid) {
    console.error('❌ No valid .specdev installation found in this directory')
    console.log('   Run "specdev init" first to initialize SpecDev')
    process.exitCode = 1
    return
  }

  if (flags.operation && dryRun) {
    return fail(flags, '--dry-run cannot be combined with --operation; no changes were made')
  }
  if (flags.operation) {
    const operation = String(flags.operation)
    let call
    try {
      call = readGuidedCall(targetDir, operation).state
    } catch (error) {
      return fail(flags, error.message)
    }
    if (call.call?.graphId !== UPDATE_COMPLETION_GRAPH) {
      return fail(flags, `${operation} is not a SpecDev update operation`)
    }
    const maintenance = await reconcileMaintenanceQuiescence(specdevPath)
    if (maintenance.status !== 'quiescent') return blockMaintenance(flags, maintenance)
    return resumeUpdateCompletion(targetDir, operation, flags, maintenance, call)
  }
  if (flags.status) {
    const maintenance = await inspectMaintenanceQuiescence(specdevPath)
    return updateCompletionStatus(targetDir, flags, maintenance)
  }

  const wouldUpdate = [
    '_main.md',
    '_index.md',
    'workflow.json',
    'workflows/',
    '_guides/',
    '_templates/',
    'guides/review.md',
    'guides/library/',
    'skills/core/',
    'skills/tools/ (official built-in only)',
    'skills/README.md',
    'Platform adapters (if missing)',
  ]
  const preserved = [
    'project_notes/ (existing content preserved; missing Roadmap scaffold added)',
    'assignments/',
    'missions/',
    'discussions/',
    'test-audits/',
    'knowledge/',
    'skills/tools/ (custom)',
    'agents.yaml',
    'guides/project/',
    'project_scaffolding/ (legacy custom files)',
    'Existing platform adapters',
  ]

  if (dryRun) {
    const maintenance = await inspectMaintenanceQuiescence(specdevPath)
    const adapterInspection = inspectUpdateAdapters(targetDir, ALL_ADAPTERS)
    if (flags.json) {
      const pkg = await import('../../package.json', { with: { type: 'json' } })
      console.log(
        JSON.stringify(
          {
            command: 'update',
            version: 1,
            status: 'ok',
            dry_run: true,
            cli_version: pkg.default.version,
            release_date: pkg.default.releaseDate || null,
            runtime_status: 'would_update',
            adapter_status: adapterSummary(adapterInspection, true),
            adapters: publicAdapterStatus(adapterInspection),
            operation: null,
            maintenance_quiescence: maintenance,
            next_action: 'Run specdev update to apply the runtime update.',
            would_update: wouldUpdate,
            preserved,
          },
          null,
          2
        )
      )
      return
    }
    printSection('🔍 Dry run mode - would update:')
    printBullets(wouldUpdate, '   - ')
    blankLine()
    printSection('📌 Preserved (not updated):')
    printBullets(preserved, '   - ')
    blankLine()
    printSection(`Adapter completion: ${adapterSummary(adapterInspection, true)}`)
    printMaintenanceInspection(maintenance)
    console.log('Next action: Run specdev update to apply the runtime update.')
    return
  }

  // Update system files
  try {
    const maintenance = await reconcileMaintenanceQuiescence(specdevPath)
    if (maintenance.status !== 'quiescent') return blockMaintenance(flags, maintenance)
    if (!flags.json) {
      console.log('🔄 Updating SpecDev system files...')
      blankLine()
    }

    const repairedSkillRoots = prepareCommandSkillDirectories(targetDir, COMMAND_SKILL_DIRS)
    const updatedPaths = await updateSpecdevSystem(templatePath, specdevPath)
    const engine = installWorkspaceEngine(targetDir)

    const pkg = await import('../../package.json', { with: { type: 'json' } })

    // Update skill files if installed
    const skillUpdates = updateSkillFiles(targetDir, SKILL_FILES, COMMAND_SKILL_DIRS)

    // Update hook script if installed
    const hookSrcDir = join(__dirname, '../../hooks')
    const hookUpdated = updateHookScript(targetDir, hookSrcDir)

    // Backfill missing platform adapters
    const createdAdapters = backfillAdapters(targetDir, ALL_ADAPTERS, adapterContent)

    // Sync tool skill wrappers (suppress JSON from sync when we handle our own)
    const { skillsSyncCommand } = await import('./skills-sync.js')
    if (flags.json) {
      // Suppress sync output when update handles its own JSON
      const origLog = console.log
      console.log = () => {}
      try {
        await skillsSyncCommand({ ...flags, json: undefined })
      } finally {
        console.log = origLog
      }
    } else {
      await skillsSyncCommand(flags)
    }

    const adapters = inspectUpdateAdapters(targetDir, ALL_ADAPTERS, createdAdapters)
    const runtime = {
      cli_version: pkg.default.version,
      release_date: pkg.default.releaseDate || '',
      updated_paths: updatedPaths,
    }
    const commonPayload = {
      command: 'update',
      version: 2,
      cli_version: pkg.default.version,
      release_date: pkg.default.releaseDate || null,
      runtime_status: 'updated',
      updated: updatedPaths,
      repaired_skill_roots: repairedSkillRoots,
      skill_updates: skillUpdates.map((u) => ({ path: u.path, count: u.count })),
      hook_updated: hookUpdated > 0,
      adapters_created: createdAdapters,
      guided_workflows: engine.registered.length - 1,
      maintenance_quiescence: maintenance,
      preserved: [
        'project_notes/ (existing content preserved; missing Roadmap scaffold added)',
        'assignments/',
        'missions/',
        'discussions/',
        'test-audits/',
        'knowledge/',
        'agents.yaml',
        'guides/project/',
        'skills/tools/',
        'project_scaffolding/ (legacy custom files)',
      ],
    }

    if (adaptersNeedAction(adapters)) {
      const calls = listGuidedCalls(targetDir, UPDATE_COMPLETION_GRAPH).calls
      const operation = nextUpdateOperationId(calls)
      const started = startGuidedCall(targetDir, UPDATE_COMPLETION_GRAPH, operation, {
        operation_id: operation,
        runtime,
        adapters,
        started_at: new Date().toISOString(),
      }).state
      if (started.status === 'validation_error') {
        throw new Error(
          `could not start update completion: ${formatValidationErrors(started.errors)}`
        )
      }
      const payload = actionRequiredPayload(commonPayload, operation, adapters, started)
      if (flags.json) return emitJson(payload)
      printUpdateSummary(commonPayload, adapters, createdAdapters)
      printUpdateAction(payload)
      return
    }

    if (flags.json) {
      return emitJson({
        ...commonPayload,
        status: 'ok',
        adapter_status: 'current',
        adapters: publicAdapterStatus(adapters),
        operation: null,
        next_action: 'none',
      })
    }

    const dateSuffix = pkg.default.releaseDate ? ` (${pkg.default.releaseDate})` : ''
    console.log(`✅ SpecDev updated to v${pkg.default.version}${dateSuffix}`)
    blankLine()
    printSection('📝 Updated:')
    updatedPaths.forEach((path) => {
      console.log(`   ✓ ${path}`)
    })

    for (const update of skillUpdates) {
      console.log(`   ✓ ${update.path}/ (${update.count} skill files)`)
    }

    for (const path of repairedSkillRoots) {
      console.log(`   ✓ ${path} (empty file migrated to directory)`)
    }

    if (hookUpdated > 0) {
      console.log('   ✓ .claude/hooks/specdev-session-start.sh')
    }

    if (createdAdapters.length > 0) {
      for (const path of createdAdapters) {
        console.log(`   + ${path} (created — was missing)`)
      }
    }

    blankLine()
    printSection('📌 Preserved:')
    printBullets(
      [
        'project_notes/ (existing documentation preserved; missing Roadmap scaffold added)',
        'assignments/ (your active work)',
        'skills/tools/ (your custom tool skills)',
        'missions/ and discussions/ (your durable work)',
        'test-audits/ and knowledge/ (your durable analysis and guidance)',
        'guides/project/ (your project guidance)',
        'project_scaffolding/ (legacy custom files, if present)',
      ],
      '   • '
    )
    blankLine()
    console.log(
      '💡 Agent profiles live in .specdev/agents.yaml; machine overrides live in ignored cache/agents.local.yaml'
    )

    blankLine()
    console.log('💡 Your project-owned notes, work, profiles, and guides remain untouched')
    console.log('💡 For legacy .specdev layouts, run: specdev migrate')
    console.log(
      '💡 For old assignment root files only, run: specdev migrate legacy-assignments --dry-run'
    )
    console.log(
      '💡 Check _guides/update_guide.md for manual patches to CLAUDE.md and other unmanaged files'
    )
    blankLine()
    console.log('✅ Platform adapters are current; update completion requires no agent action')
  } catch (error) {
    if (flags.json) {
      console.log(
        JSON.stringify(
          { command: 'update', version: 1, status: 'error', error: error.message },
          null,
          2
        )
      )
    } else {
      console.error('❌ Failed to update SpecDev:', error.message)
    }
    process.exitCode = 1
  }
}

async function resumeUpdateCompletion(targetDir, operation, flags, maintenance, initialCall) {
  let call = initialCall
  if (call.status === 'completed') {
    return emitUpdateResult(flags, {
      command: 'update',
      version: 2,
      status: 'ok',
      runtime_status: 'updated',
      adapter_status: 'current',
      operation,
      maintenance_quiescence: maintenance,
      graph: `${call.call.graphId}@${call.call.graphVersion}`,
      receipt: updateReceiptPath(operation, call.outputArtifact),
      adapters: call.output.adapters,
      next_action: 'none',
    })
  }

  const baseline = call.input.adapters
  const validation = validateUpdateAdapters(targetDir, baseline)
  if (!validation.valid) {
    const adapterStatus = baseline.some((adapter) => adapter.status === 'ambiguous')
      ? 'ambiguous'
      : 'reconciliation_required'
    return emitUpdateResult(flags, {
      command: 'update',
      version: 2,
      status: 'agent_action_required',
      runtime_status: 'updated',
      adapter_status: adapterStatus,
      operation,
      maintenance_quiescence: maintenance,
      graph: `${call.call.graphId}@${call.call.graphVersion}`,
      node: call.position.node,
      adapters: publicAdapterStatus(baseline),
      issues: validation.issues,
      next_action: resumeAction(operation, adapterStatus),
    })
  }

  if (call.position.node === 'reconcile-adapters') {
    const stepped = stepGuidedCall(targetDir, operation, {
      reconciled: true,
      preservation_evidence: validation.evidence,
    }).state
    if (stepped.status === 'validation_error') {
      return fail(
        flags,
        `update completion evidence was rejected: ${formatValidationErrors(stepped.errors)}`
      )
    }
    call = stepped
  }

  if (call.status !== 'active' || call.position.node !== 'validate-adapters') {
    return fail(flags, `${operation} is at an unsupported update-completion node`)
  }
  const receipt = {
    operation_id: operation,
    runtime_status: 'updated',
    adapter_status: 'current',
    adapters: validation.evidence,
    completed_at: new Date().toISOString(),
  }
  const completed = stepGuidedCall(targetDir, operation, receipt).state
  if (completed.status === 'validation_error') {
    return fail(
      flags,
      `update completion receipt was rejected: ${formatValidationErrors(completed.errors)}`
    )
  }
  return emitUpdateResult(flags, {
    command: 'update',
    version: 2,
    status: 'ok',
    runtime_status: 'updated',
    adapter_status: 'current',
    operation,
    maintenance_quiescence: maintenance,
    graph: `${completed.call.graphId}@${completed.call.graphVersion}`,
    receipt: updateReceiptPath(operation, completed.outputArtifact),
    adapters: validation.evidence,
    next_action: 'none',
  })
}

function updateReceiptPath(operation, outputArtifact) {
  if (!outputArtifact) return null
  return `.specdev/.ripplegraph/calls/${operation}/${outputArtifact.replaceAll('\\', '/')}`
}

async function updateCompletionStatus(targetDir, flags, maintenance) {
  let calls
  try {
    calls = listGuidedCalls(targetDir, UPDATE_COMPLETION_GRAPH).calls
  } catch (error) {
    return fail(flags, error.message)
  }
  const operations = calls.map((summary) => {
    const call = readGuidedCall(targetDir, summary.id).state
    const baseline = call.input?.adapters || []
    return {
      operation: summary.id,
      status: summary.status,
      runtime_status: call.output?.runtime_status || 'updated',
      adapter_status:
        call.output?.adapter_status ||
        (baseline.some((adapter) => adapter.status === 'ambiguous')
          ? 'ambiguous'
          : 'reconciliation_required'),
      graph: `${call.call.graphId}@${call.call.graphVersion}`,
      node: summary.position.node,
      updated_at: summary.updatedAt,
      next_action:
        summary.status === 'active' ? `specdev update --operation=${summary.id}` : 'none',
    }
  })
  return emitUpdateResult(flags, {
    command: 'update status',
    version: 1,
    status: 'ok',
    maintenance_quiescence: maintenance,
    operations,
    next_action: operations.some((operation) => operation.status === 'active')
      ? operations.find((operation) => operation.status === 'active').next_action
      : 'none',
  })
}

function actionRequiredPayload(common, operation, adapters, state) {
  const adapterStatus = adapters.some((adapter) => adapter.status === 'ambiguous')
    ? 'ambiguous'
    : 'reconciliation_required'
  return {
    ...common,
    status: 'agent_action_required',
    adapter_status: adapterStatus,
    operation,
    graph: `${state.call.graphId}@${state.call.graphVersion}`,
    node: state.position.node,
    adapters: publicAdapterStatus(adapters),
    next_action: resumeAction(operation, adapterStatus),
  }
}

function resumeAction(operation, adapterStatus) {
  return adapterStatus === 'ambiguous'
    ? `Do not rewrite ambiguous project-owned text. Obtain user direction, then run specdev update --operation=${operation}.`
    : `Reconcile only the reported SpecDev adapter guidance, then run specdev update --operation=${operation}.`
}

function adapterSummary(adapters, dryRun = false) {
  if (adapters.some((adapter) => adapter.status === 'ambiguous')) return 'ambiguous'
  if (
    adapters.some((adapter) =>
      ['needs_reconciliation', 'needs_orientation'].includes(adapter.status)
    )
  ) {
    return dryRun ? 'would_require_reconciliation' : 'reconciliation_required'
  }
  if (adapters.some((adapter) => adapter.status === 'missing')) return 'would_backfill'
  return 'current'
}

function printUpdateSummary(common, adapters, createdAdapters) {
  const dateSuffix = common.release_date ? ` (${common.release_date})` : ''
  console.log(`✅ SpecDev runtime updated to v${common.cli_version}${dateSuffix}`)
  if (createdAdapters.length > 0) {
    for (const path of createdAdapters) console.log(`   + ${path} (created — was missing)`)
  }
  console.log(`Adapter completion: ${adapterSummary(adapters)}`)
}

function printUpdateAction(payload) {
  console.log(`Operation: ${payload.operation}`)
  for (const adapter of payload.adapters.filter(
    (item) => !['current', 'backfilled'].includes(item.status)
  )) {
    console.log(`   ${adapter.path}: ${adapter.status}`)
  }
  if (payload.issues) for (const issue of payload.issues) console.log(`   ! ${issue}`)
  console.log(`Next action: ${payload.next_action}`)
}

function emitUpdateResult(flags, payload) {
  if (flags.json) return emitJson(payload)
  printMaintenanceInspection(payload.maintenance_quiescence)
  if (payload.operations) {
    if (payload.operations.length === 0) console.log('No update completion operations found.')
    else {
      console.log('Update completion operations:')
      for (const operation of payload.operations) {
        console.log(`  ${operation.operation}  ${operation.status}  ${operation.node}`)
      }
    }
    if (payload.next_action !== 'none') console.log(`Next action: ${payload.next_action}`)
    return
  }
  if (payload.status === 'ok') {
    console.log(`✅ Update operation ${payload.operation} is complete`)
    if (payload.receipt) console.log(`Receipt: ${payload.receipt}`)
    return
  }
  printUpdateAction(payload)
}

function emitJson(payload) {
  console.log(JSON.stringify(payload, null, 2))
}

function fail(flags, message) {
  if (flags.json) emitJson({ command: 'update', version: 2, status: 'error', error: message })
  else console.error(`❌ Failed to update SpecDev: ${message}`)
  process.exitCode = 1
}

function blockMaintenance(flags, maintenance) {
  const payload = {
    command: 'update',
    version: 2,
    status: 'blocked',
    state: 'maintenance_not_quiescent',
    mutated: maintenance.reconciled_attempts?.length > 0,
    maintenance_quiescence: maintenance,
    next_action: maintenanceNextAction(maintenance),
  }
  if (flags.json) emitJson(payload)
  else {
    console.error('❌ SpecDev update blocked: maintenance is not quiescent.')
    printMaintenanceInspection(maintenance, console.error)
    console.error(`Next: ${payload.next_action}`)
  }
  process.exitCode = 1
}

function printMaintenanceInspection(maintenance, output = console.log) {
  if (!maintenance || maintenance.status === 'quiescent') return
  output(`Maintenance quiescence: ${maintenance.status}`)
  for (const blocker of maintenance.blockers || []) {
    const label = blocker.attempt || 'Attempt registry'
    const owners = formatAttemptOwners(blocker.owners)
    output(`  ${label}${owners}: ${blocker.reason} (${blocker.liveness})`)
  }
  for (const stale of maintenance.stale_attempts || []) {
    const owners = formatAttemptOwners(stale.owners)
    output(`  ${stale.attempt}${owners}: stale local process; mutating update will interrupt it`)
  }
}

function formatAttemptOwners(owners = []) {
  if (owners.length === 0) return ''
  return ` [${owners.map((owner) => `${owner.kind} ${owner.id}`).join(', ')}]`
}

function maintenanceNextAction(maintenance) {
  const first = maintenance.blockers?.[0]
  if (first?.next_action) return first.next_action
  return 'Retry specdev update so stale Attempt reconciliation can converge from current state.'
}

function formatValidationErrors(errors = []) {
  return errors.map((error) => `${error.path || '$'} ${error.message}`).join('; ')
}
