import { join } from 'node:path'
import fse from 'fs-extra'
import { assignmentContractTemplate, gitSnapshot, relativeToRepo, validateContractPath } from '../utils/assignment-vnext.js'
import { listGuidedCalls, readGuidedCall, startGuidedCall, stepGuidedCall } from '../utils/callable-sync.js'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import { assertWorkspaceEngine } from '../utils/engine.js'
import { readBigPictureStatus } from '../utils/project-context.js'
import { reserveTestAuditId, resolveTestAuditSelector, testAuditArtifactHash } from '../utils/test-audit.js'

export async function testAuditCommand(positionalArgs = [], flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)
  try { assertWorkspaceEngine(targetDir) } catch (error) { return fail(flags, error.message) }
  if (flags.list) return listAudits(targetDir, specdevPath, flags)

  const selector = positionalArgs.length === 1 && /^TA\d{5}$/.test(positionalArgs[0])
    ? positionalArgs[0]
    : null
  if (selector) return resumeAudit(targetDir, specdevPath, selector, flags)

  const scope = positionalArgs.join(' ').trim()
  if (!scope) return fail(flags, 'Usage: specdev test-audit "<test scope>" | specdev test-audit TA00001 [--complete] | specdev test-audit --list')
  const bigPicture = await readBigPictureStatus(specdevPath)
  if (!bigPicture.exists || !bigPicture.filled) return fail(flags, 'big_picture.md is not filled in')

  const id = await reserveTestAuditId(specdevPath)
  const name = `${id}_${slugify(scope)}`
  const auditPath = join(specdevPath, 'test-audits', name)
  const startRevision = (await gitSnapshot(targetDir)).revision || 'unborn'
  await fse.ensureDir(auditPath)
  await fse.writeFile(join(auditPath, 'audit.md'), auditTemplate(scope, startRevision), 'utf-8')
  await fse.writeFile(
    join(auditPath, 'assignment-contract.md'),
    assignmentContractTemplate({ description: `Remove only redundant tests proven unnecessary by ${id}: ${scope}`, kind: 'refactor' }),
    'utf-8'
  )
  const input = { id, path: relativeToRepo(targetDir, auditPath), scope, start_revision: startRevision }
  const started = startGuidedCall(targetDir, 'test-audit-lifecycle', id, input)
  if (!started.synchronized) return fail(flags, 'RippleGraph callable runtime is unavailable; run specdev update')
  return emit(flags, {
    command: 'test-audit', version: 1, status: 'auditing', id, name, path: input.path,
    scope, start_revision: startRevision,
    authority: 'Product code and tests are read-only. Write only audit.md and assignment-contract.md in this Test Audit.',
    next_action: `Inspect the test suite, fill ${input.path}/audit.md and assignment-contract.md, then run specdev test-audit ${id}.`,
  })
}

async function resumeAudit(targetDir, specdevPath, selector, flags) {
  const resolved = await resolveTestAuditSelector(specdevPath, selector)
  if (!resolved || resolved.ambiguous) return fail(flags, `Test Audit not found or ambiguous: ${selector}`)
  const call = readGuidedCall(targetDir, selector)
  if (!call.synchronized) return fail(flags, 'RippleGraph callable runtime is unavailable; run specdev update')
  if (call.state.status === 'completed') return emit(flags, payload(targetDir, resolved, 'completed'))

  if (call.state.position.node === 'audit') {
    const artifacts = await validateAuditArtifacts(resolved.path)
    if (!artifacts.valid) {
      return emit(flags, {
        ...payload(targetDir, resolved, 'auditing'), issues: artifacts.errors,
        authority: 'Product code and tests are read-only.',
        next_action: `Finish ${relativeToRepo(targetDir, join(resolved.path, 'audit.md'))} and assignment-contract.md.`,
      })
    }
    stepGuidedCall(targetDir, selector, {
      audit: relativeToRepo(targetDir, artifacts.auditPath),
      contract: relativeToRepo(targetDir, artifacts.contract.path),
    })
  }

  if (flags.complete) {
    const artifacts = await validateAuditArtifacts(resolved.path)
    if (!artifacts.valid) return fail(flags, artifacts.errors.join('; '))
    const completedRevision = (await gitSnapshot(targetDir)).revision || 'unborn'
    const artifactHash = await testAuditArtifactHash(resolved.path)
    stepGuidedCall(targetDir, selector, { completed_revision: completedRevision, artifact_hash: artifactHash })
    return emit(flags, {
      ...payload(targetDir, resolved, 'completed'), completed_revision: completedRevision,
      artifact_hash: artifactHash,
      next_action: `Promote the exact pruning contract with specdev assignment --from-test-audit=${selector}.`,
    })
  }

  return emit(flags, {
    ...payload(targetDir, resolved, 'awaiting_completion'),
    next_action: `Review the proposed removals, then complete with specdev test-audit ${selector} --complete.`,
  })
}

async function validateAuditArtifacts(auditPath) {
  const auditPathname = join(auditPath, 'audit.md')
  const errors = []
  if (!(await fse.pathExists(auditPathname))) errors.push('audit.md is missing')
  else {
    const content = await fse.readFile(auditPathname, 'utf-8')
    for (const heading of ['Candidates', 'Retained protection', 'Cost impact', 'Confidence']) {
      if (!new RegExp(`^##\\s+${heading}\\s*$`, 'mi').test(content)) errors.push(`audit.md is missing ## ${heading}`)
    }
    if (/\bTODO\b/i.test(content)) errors.push('audit.md still contains TODO placeholders')
  }
  const contract = await validateContractPath(join(auditPath, 'assignment-contract.md'))
  if (!contract.valid) errors.push(...contract.errors.map((error) => `assignment-contract.md: ${error}`))
  return { valid: errors.length === 0, errors, auditPath: auditPathname, contract }
}

async function listAudits(targetDir, specdevPath, flags) {
  const calls = listGuidedCalls(targetDir, 'test-audit-lifecycle')
  const root = join(specdevPath, 'test-audits')
  const entries = await fse.pathExists(root)
    ? (await fse.readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory())
    : []
  const audits = entries.sort((left, right) => left.name.localeCompare(right.name)).flatMap((entry) => {
    const id = entry.name.match(/^TA\d{5}/)?.[0]
    if (!id) return []
    const call = calls.calls.find((candidate) => candidate.id === id)
    return [{ id, name: entry.name, status: call?.status === 'completed' ? 'completed' : call?.position?.node === 'finalize' ? 'awaiting_completion' : 'auditing' }]
  })
  if (flags.json) return emit(flags, { command: 'test-audit list', version: 1, status: 'ok', audits })
  if (audits.length === 0) return console.log('No Test Audits found.')
  console.log('Test Audits:')
  for (const audit of audits) console.log(`  ${audit.id}  ${audit.status}  ${audit.name}`)
}

function auditTemplate(scope, revision) {
  return `# Test Audit: ${scope}\n\nObserved revision: \`${revision}\`\n\n## Candidates\n\n| Test or exact range | Why it is redundant | Existing protection that remains | Estimated saving | Confidence |\n| --- | --- | --- | --- | --- |\n| TODO | TODO | TODO | TODO | TODO |\n\n## Retained protection\n\nTODO\n\n## Cost impact\n\nTODO\n\n## Confidence\n\nTODO\n`
}

function payload(targetDir, resolved, status) {
  return { command: 'test-audit', version: 1, status, id: resolved.id, name: resolved.name, path: relativeToRepo(targetDir, resolved.path) }
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'tests'
}

function emit(flags, value) {
  if (flags.json) console.log(JSON.stringify(value, null, 2))
  else {
    console.log(`Test Audit ${value.id}: ${value.status}`)
    if (value.path) console.log(`Path: ${value.path}`)
    if (value.authority) console.log(`Authority: ${value.authority}`)
    if (value.issues) for (const issue of value.issues) console.log(`  - ${issue}`)
    if (value.next_action) console.log(`Next: ${value.next_action}`)
  }
  return value
}

function fail(flags, message) {
  if (flags.json) console.log(JSON.stringify({ command: 'test-audit', version: 1, status: 'error', error: message }))
  else console.error(message)
  process.exitCode = 1
  return null
}
