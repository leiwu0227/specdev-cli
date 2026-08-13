import { createHash } from 'node:crypto'
import { execFile as execFileCallback } from 'node:child_process'
import { dirname, join, relative, sep } from 'node:path'
import { promisify } from 'node:util'
import fse from 'fs-extra'
import { gitStatusEntries, requireGitHead, currentGitBranch } from './git-delivery.js'
import {
  buildKnowledgeDistillationBrief,
  buildKnowledgeIndex,
  collectKnowledgeDocuments,
  knowledgeIndexIsStale,
  parseKnowledgeMetadata,
} from './knowledge.js'

const KNOWLEDGE_BRANCHES = new Set([
  'faq',
  'architecture',
  'codestyle',
  'domain',
  'workflow',
  'workflow_feedback',
])
const CURATION_VERSION = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const MAX_REPOSITORY_EVIDENCE = 8
const MAX_REPOSITORY_EVIDENCE_LINES = 200
const MAX_REPOSITORY_EVIDENCE_BYTES = 32 * 1024
const MAX_REPOSITORY_FILE_BYTES = 512 * 1024
const BIG_PICTURE_PATH = 'project_notes/big_picture.md'
const execFile = promisify(execFileCallback)

export async function scanKnowledgeCuration(targetDir, specdevPath, options = {}) {
  const limit = boundedLimit(options.limit)
  const documents = await collectKnowledgeDocuments(specdevPath)
  const boundary = await readGitBoundary(targetDir)
  const repositoryEvidence = await inspectRepositoryEvidence(
    targetDir,
    options.repositoryEvidence || [],
    boundary
  )
  const dirty = new Set(boundary.entries.map((entry) => fromRepoPath(entry.path)))
  const brief = await buildKnowledgeDistillationBrief(specdevPath, {
    assignment: options.assignment,
    mission: options.mission,
    discussion: options.discussion,
    limit,
  })
  const documentHashes = Object.fromEntries(
    documents.map((document) => [document.path, document.contentHash])
  )
  const existingKnowledge = documents
    .filter(
      (document) =>
        isKnowledgeDestination(document.path) && document.knowledgeStatus !== 'superseded'
    )
    .sort((left, right) => left.path.localeCompare(right.path))
  const eligibleSources = brief.unreferenced_sources.filter((source) => !dirty.has(source.path))
  const excludedDirt = boundary.entries.map((entry) => {
    const specdevRelative = fromRepoPath(entry.path)
    return {
      path: specdevRelative || entry.path,
      status: entry.status,
      reason: specdevRelative ? 'dirty_specdev_path' : 'unrelated_product_dirt',
    }
  })
  const ownersByTitle = new Map()
  for (const owner of existingKnowledge) {
    const key = owner.title.trim().toLowerCase()
    ownersByTitle.set(key, [...(ownersByTitle.get(key) || []), owner.path])
  }
  const scanIdentity = {
    version: CURATION_VERSION,
    revision: boundary.revision,
    branch: boundary.branch,
    git_entries: boundary.entries,
    documents: documentHashes,
    repository_evidence: repositoryEvidence,
  }
  const scanId = digest(scanIdentity)

  return {
    command: 'knowledge curate',
    version: CURATION_VERSION,
    status: 'scan_ready',
    mutation_free: true,
    scan_id: scanId,
    generated_at: new Date().toISOString(),
    limit,
    boundary,
    eligible_source_count: brief.unreferenced_source_count,
    eligible_sources: eligibleSources,
    excluded_dirty_sources: brief.unreferenced_sources
      .filter((source) => dirty.has(source.path))
      .map((source) => ({ path: source.path, reason: 'dirty_source' })),
    stale_faq_count: brief.stale_faq_count,
    stale_faqs: brief.stale_faqs,
    superseded_faq_count: brief.superseded_faq_count,
    superseded_faqs: brief.superseded_faqs,
    owner_count: existingKnowledge.length,
    owners: existingKnowledge.slice(0, limit).map((document) => ({
      path: document.path,
      title: document.title,
      branch: document.phase,
      content_hash: document.contentHash,
      sources: document.sources,
    })),
    owners_truncated: existingKnowledge.length > limit,
    owner_conflicts: [...ownersByTitle.entries()]
      .filter(([, paths]) => paths.length > 1)
      .map(([topic, paths]) => ({ topic, paths })),
    project_context: {
      path: BIG_PICTURE_PATH,
      content_hash: documentHashes[BIG_PICTURE_PATH] || null,
      authority: 'separate_explicit_approval',
    },
    excluded_dirt: excludedDirt,
    repository_evidence: repositoryEvidence,
    proposal_template: {
      version: CURATION_VERSION,
      scan_id: scanId,
      summary: '',
      repository_evidence: repositoryEvidence,
      changes: [],
      big_picture: null,
      conflicts: [],
      exclusions: excludedDirt.map((entry) => ({ path: entry.path, reason: entry.reason })),
    },
    next_action:
      'Write the exact proposal JSON in ignored cache, then run `specdev knowledge curate --proposal=<path>` to validate and bind it for approval.',
  }
}

export async function prepareKnowledgeCuration(targetDir, specdevPath, proposalPath) {
  const rawProposal = await fse.readJson(proposalPath)
  const scan = await scanKnowledgeCuration(targetDir, specdevPath, {
    ...(rawProposal.scope || {}),
    repositoryEvidence: repositoryEvidenceSelectors(rawProposal.repository_evidence),
  })
  const documents = await collectKnowledgeDocuments(specdevPath)
  const documentHashes = Object.fromEntries(
    documents.map((document) => [document.path, document.contentHash])
  )
  const proposal = validateProposal(rawProposal, scan, documentHashes)
  const activePath = curationJournalPath(specdevPath)
  const existing = await readJsonIfExists(activePath)
  const proposalId = digest(proposal)
  if (existing && !['completed', 'cancelled'].includes(existing.phase)) {
    if (existing.proposal_id !== proposalId) {
      throw new Error(
        `Another knowledge curation proposal is active (${existing.proposal_id}); resume it or use --cancel before preparing a different proposal.`
      )
    }
    return publicJournal(existing)
  }

  const bigPictureApproval = proposal.big_picture
    ? digest({
        path: BIG_PICTURE_PATH,
        previous_hash: proposal.big_picture.previous_hash,
        content: proposal.big_picture.content,
      })
    : null
  const journal = {
    version: CURATION_VERSION,
    phase: 'awaiting_approval',
    proposal_id: proposalId,
    big_picture_approval: bigPictureApproval,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    scan: {
      scan_id: scan.scan_id,
      boundary: scan.boundary,
      document_hashes: documentHashes,
      repository_evidence: scan.repository_evidence,
    },
    proposal,
    published_paths: [],
    index: { status: 'pending', recovery_command: 'specdev knowledge rebuild' },
    receipt: null,
  }
  await writeJsonAtomic(activePath, journal)
  return publicJournal(journal)
}

export async function applyKnowledgeCuration(targetDir, specdevPath, approvals = {}, hooks = {}) {
  const path = curationJournalPath(specdevPath)
  let journal = await readJsonIfExists(path)
  if (!journal) throw new Error('No prepared knowledge curation proposal is active')
  if (journal.phase === 'completed') return publicJournal(journal)
  if (approvals.proposal !== journal.proposal_id) {
    throw new Error(
      `Approval does not match the active proposal. Confirm exactly ${journal.proposal_id}.`
    )
  }
  let publishBigPicture = Boolean(journal.proposal.big_picture)
    ? approvals.bigPicture === journal.big_picture_approval
    : false
  if (approvals.bigPicture && approvals.bigPicture !== journal.big_picture_approval) {
    throw new Error('Big-picture approval is stale or does not match the exact old and new content')
  }

  if (journal.phase === 'awaiting_approval') {
    await assertPublicationBoundary(targetDir, specdevPath, journal, publishBigPicture)
    journal = await updateJournal(path, journal, {
      phase: 'approved',
      approvals: {
        proposal: approvals.proposal,
        approved_at: new Date().toISOString(),
        big_picture: publishBigPicture ? approvals.bigPicture : null,
      },
    })
  } else {
    publishBigPicture = Boolean(journal.approvals?.big_picture)
  }

  const selectedChanges = [
    ...journal.proposal.changes,
    ...(publishBigPicture ? [{ path: BIG_PICTURE_PATH, ...journal.proposal.big_picture }] : []),
  ]
  if (['approved', 'publishing'].includes(journal.phase)) {
    journal = await updateJournal(path, journal, { phase: 'publishing' })
    for (const change of selectedChanges) {
      const destination = safeSpecdevPath(specdevPath, change.path)
      const current = await hashFile(destination)
      const desired = hashText(change.content)
      if (current === desired) {
        if (!journal.published_paths.includes(change.path)) {
          journal.published_paths.push(change.path)
          journal = await updateJournal(path, journal, {
            published_paths: [...journal.published_paths],
          })
        }
        continue
      }
      if (current !== change.previous_hash) {
        throw new Error(
          `${change.path} changed after approval; publication stopped without overwrite`
        )
      }
      await writeTextAtomic(destination, change.content)
      journal.published_paths.push(change.path)
      journal = await updateJournal(path, journal, {
        published_paths: [...new Set(journal.published_paths)],
      })
    }
    journal = await updateJournal(path, journal, { phase: 'published' })
  }

  const receiptPath = curationReceiptPath(specdevPath, journal.proposal_id)
  if (journal.phase === 'published') {
    const receipt = buildReceipt(journal, selectedChanges, publishBigPicture)
    await writeJsonAtomic(receiptPath, receipt)
    journal = await updateJournal(path, journal, {
      phase: 'receipt_written',
      receipt: toSpecdevRelative(specdevPath, receiptPath),
    })
  }

  if (['receipt_written', 'index_stale'].includes(journal.phase)) {
    const indexWasStale = await knowledgeIndexIsStale(specdevPath)
    const shouldRebuild = selectedChanges.length > 0 || indexWasStale
    if (shouldRebuild) {
      try {
        const rebuild = hooks.buildIndex
          ? await hooks.buildIndex(specdevPath)
          : await buildKnowledgeIndex(specdevPath)
        journal.index = {
          status: 'ok',
          rebuilt: true,
          document_count: rebuild.documentCount,
          recovery_command: null,
        }
      } catch (error) {
        journal.index = {
          status: 'stale',
          rebuilt: false,
          error: error.message,
          recovery_command: 'specdev knowledge rebuild',
        }
        journal = await updateJournal(path, journal, { phase: 'index_stale', index: journal.index })
        await finalizeReceiptIndex(receiptPath, journal.index, 'published_index_stale')
        return publicJournal(journal)
      }
    } else {
      journal.index = {
        status: 'current',
        rebuilt: false,
        recovery_command: null,
      }
    }
    await finalizeReceiptIndex(receiptPath, journal.index, 'completed')
    journal = await updateJournal(path, journal, { phase: 'completed', index: journal.index })
  }
  return publicJournal(journal)
}

export async function knowledgeCurationStatus(specdevPath) {
  const journal = await readJsonIfExists(curationJournalPath(specdevPath))
  return journal ? publicJournal(journal) : null
}

export async function cancelKnowledgeCuration(specdevPath) {
  const path = curationJournalPath(specdevPath)
  const journal = await readJsonIfExists(path)
  if (!journal) return null
  if (
    journal.published_paths?.length > 0 ||
    !['awaiting_approval', 'approved'].includes(journal.phase)
  ) {
    throw new Error('Published knowledge curation cannot be cancelled; resume it to convergence')
  }
  await fse.remove(path)
  return { command: 'knowledge curate', version: CURATION_VERSION, status: 'cancelled' }
}

function validateProposal(proposal, scan, documentHashes) {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
    throw new Error('Curation proposal must be a JSON object')
  }
  if (proposal.version !== CURATION_VERSION) throw new Error('Curation proposal version must be 1')
  if (proposal.scan_id !== scan.scan_id) {
    throw new Error('Curation scan is stale; rerun the mutation-free scan and rebuild the proposal')
  }
  if (!Array.isArray(proposal.changes)) throw new Error('Curation proposal changes must be a list')
  if (!Array.isArray(proposal.conflicts))
    throw new Error('Curation proposal conflicts must be a list')
  if (!Array.isArray(proposal.exclusions))
    throw new Error('Curation proposal exclusions must be a list')
  if (proposal.changes.length > MAX_LIMIT)
    throw new Error(`Curation proposal exceeds ${MAX_LIMIT} changes`)

  const repositoryEvidence = validateRepositoryEvidence(
    proposal.repository_evidence,
    scan.repository_evidence
  )
  const evidenceReferences = new Set(repositoryEvidence.map((evidence) => evidence.reference))
  const usedEvidenceReferences = new Set()

  const knownDocuments = new Map(Object.entries(documentHashes))
  const dirtyPaths = new Set(scan.boundary.entries.map((entry) => fromRepoPath(entry.path)))
  const paths = new Set()
  const changes = proposal.changes.map((change, index) => {
    const field = `changes[${index}]`
    if (!change || typeof change !== 'object' || Array.isArray(change)) {
      throw new Error(`${field} must be an object`)
    }
    const path = normalizeRelativePath(change.path, `${field}.path`)
    if (!isKnowledgeDestination(path)) throw new Error(`${field}.path is not a curated destination`)
    if (paths.has(path)) throw new Error(`Duplicate proposal destination: ${path}`)
    paths.add(path)
    if (dirtyPaths.has(path)) throw new Error(`${path} is dirty and has ambiguous ownership`)
    if (!['create', 'update', 'supersede'].includes(change.action)) {
      throw new Error(`${field}.action must be create, update, or supersede`)
    }
    if (typeof change.content !== 'string' || !change.content.trim()) {
      throw new Error(`${field}.content must be non-empty Markdown`)
    }
    const previousHash = knownDocuments.get(path) || null
    if ((change.previous_hash || null) !== previousHash) {
      throw new Error(`${path} previous_hash does not match the scanned destination`)
    }
    if (change.action === 'create' && previousHash) throw new Error(`${path} already exists`)
    if (change.action !== 'create' && !previousHash) throw new Error(`${path} does not exist`)
    if (hashText(change.content) === previousHash) {
      throw new Error(`${path} content is unchanged; omit it from the proposal`)
    }
    validateOwnerCheck(change.owner_check, change.action, path, scan, field)
    validateVerification(change.verification, field)
    validateKnowledgeContent(change, path, knownDocuments, dirtyPaths, scan)
    const changeRepositoryEvidence = normalizeEvidenceReferences(
      change.repository_evidence,
      evidenceReferences,
      field
    )
    for (const reference of changeRepositoryEvidence) usedEvidenceReferences.add(reference)
    return {
      path,
      action: change.action,
      previous_hash: previousHash,
      content: change.content,
      owner_check: normalizeOwnerCheck(change.owner_check),
      verification: normalizeVerification(change.verification),
      ...(changeRepositoryEvidence.length > 0
        ? { repository_evidence: changeRepositoryEvidence }
        : {}),
    }
  })
  const proposedPaths = new Set(changes.map((change) => change.path))
  for (const change of changes.filter((item) => item.action === 'supersede')) {
    const replacement = parseKnowledgeMetadata(change.content, change.path).supersededBy
    if (replacement === change.path) throw new Error(`${change.path} cannot supersede itself`)
    if (!knownDocuments.has(replacement) && !proposedPaths.has(replacement)) {
      throw new Error(
        `${change.path} superseded_by target is not current or proposed: ${replacement}`
      )
    }
  }

  for (const evidence of repositoryEvidence) {
    if (!usedEvidenceReferences.has(evidence.reference)) {
      throw new Error(
        `repository evidence ${evidence.reference} is not attributed to a proposed knowledge change`
      )
    }
  }

  let bigPicture = null
  if (proposal.big_picture !== null && proposal.big_picture !== undefined) {
    const value = proposal.big_picture
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('big_picture must be null or an object')
    }
    if ((value.previous_hash || null) !== scan.project_context.content_hash) {
      throw new Error('big_picture previous_hash does not match current project context')
    }
    if (typeof value.content !== 'string' || !value.content.trim()) {
      throw new Error('big_picture.content must be non-empty Markdown')
    }
    if (hashText(value.content) === scan.project_context.content_hash) {
      throw new Error('big_picture content is unchanged; omit the proposal')
    }
    if (typeof value.reason !== 'string' || !value.reason.trim()) {
      throw new Error('big_picture.reason is required')
    }
    validateVerification(value.verification, 'big_picture')
    bigPicture = {
      previous_hash: value.previous_hash || null,
      content: value.content,
      reason: value.reason.trim(),
      verification: normalizeVerification(value.verification),
    }
  }

  return {
    version: CURATION_VERSION,
    scan_id: proposal.scan_id,
    ...(proposal.scope ? { scope: normalizeScope(proposal.scope) } : {}),
    summary: String(proposal.summary || '').trim(),
    repository_evidence: repositoryEvidence,
    changes,
    big_picture: bigPicture,
    conflicts: normalizeFindings(proposal.conflicts, 'conflicts'),
    exclusions: normalizeFindings(proposal.exclusions, 'exclusions'),
  }
}

function validateKnowledgeContent(change, path, knownDocuments, dirtyPaths, scan) {
  const metadata = parseKnowledgeMetadata(change.content, path)
  if (metadata.sources.length === 0)
    throw new Error(`${path} must cite at least one durable source`)
  const existingSources = new Set(scan.owners.find((owner) => owner.path === path)?.sources || [])
  const eligibleSources = new Set(scan.eligible_sources.map((source) => source.path))
  for (const source of metadata.sources) {
    if (!knownDocuments.has(source))
      throw new Error(`${path} cites unknown or changed source ${source}`)
    if (source === path) throw new Error(`${path} cannot cite itself as provenance`)
    if (dirtyPaths.has(source)) throw new Error(`${path} cites dirty source ${source}`)
    if (!existingSources.has(source) && !eligibleSources.has(source)) {
      throw new Error(`${path} cites source outside the bounded scan: ${source}`)
    }
  }
  if (change.action === 'supersede') {
    if (metadata.knowledgeStatus !== 'superseded' || !metadata.supersededBy) {
      throw new Error(`${path} supersession requires status: superseded and superseded_by`)
    }
  } else if (metadata.knowledgeStatus === 'superseded') {
    throw new Error(`${path} uses superseded metadata without a supersede action`)
  }
  if (path.startsWith('knowledge/faq/')) {
    if (!metadata.verifiedAt || !metadata.reviewAfter) {
      throw new Error(`${path} FAQ publication requires verified_at and review_after`)
    }
    const currentEvidence = normalizeVerification(change.verification).some(
      (evidence) =>
        ['repository', 'authoritative_documentation'].includes(evidence.kind) &&
        evidence.verified_at === metadata.verifiedAt &&
        evidence.verified_at === today()
    )
    if (!currentEvidence) {
      throw new Error(
        `${path} freshness requires repository or authoritative-documentation evidence matching verified_at`
      )
    }
  }
}

function validateOwnerCheck(ownerCheck, action, path, scan, field) {
  if (!ownerCheck || typeof ownerCheck !== 'object' || Array.isArray(ownerCheck)) {
    throw new Error(`${field}.owner_check is required`)
  }
  if (typeof ownerCheck.query !== 'string' || !ownerCheck.query.trim()) {
    throw new Error(`${field}.owner_check.query is required`)
  }
  if (!Array.isArray(ownerCheck.matches))
    throw new Error(`${field}.owner_check.matches must be a list`)
  if (ownerCheck.decision !== action) {
    throw new Error(`${field}.owner_check.decision must match action ${action}`)
  }
  const ownerPaths = new Set(scan.owners.map((owner) => owner.path))
  for (const match of ownerCheck.matches) {
    if (!ownerPaths.has(match))
      throw new Error(`${field}.owner_check references unknown owner ${match}`)
  }
  if (action === 'create' && ownerCheck.matches.length > 0) {
    throw new Error(`${path} cannot be created while owner_check identifies an existing owner`)
  }
  if (action !== 'create' && !ownerCheck.matches.includes(path)) {
    throw new Error(`${field}.owner_check must identify ${path} as the owning note`)
  }
}

function validateVerification(verification, field) {
  if (!Array.isArray(verification) || verification.length === 0) {
    throw new Error(`${field}.verification requires attributable evidence`)
  }
  for (const [index, evidence] of verification.entries()) {
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
      throw new Error(`${field}.verification[${index}] must be an object`)
    }
    if (!['repository', 'authoritative_documentation', 'reviewed_source'].includes(evidence.kind)) {
      throw new Error(`${field}.verification[${index}].kind is invalid`)
    }
    if (typeof evidence.reference !== 'string' || !evidence.reference.trim()) {
      throw new Error(`${field}.verification[${index}].reference is required`)
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(evidence.verified_at || ''))) {
      throw new Error(`${field}.verification[${index}].verified_at must use YYYY-MM-DD`)
    }
  }
}

async function assertPublicationBoundary(targetDir, specdevPath, journal, publishBigPicture) {
  const current = await readGitBoundary(targetDir)
  if (
    current.revision !== journal.scan.boundary.revision ||
    current.branch !== journal.scan.boundary.branch
  ) {
    throw new Error(
      'Git revision or branch changed after proposal approval; rescan before publication'
    )
  }
  if (JSON.stringify(current.entries) !== JSON.stringify(journal.scan.boundary.entries)) {
    throw new Error(
      'Git dirty-path boundary changed after proposal approval; rescan before publication'
    )
  }
  const selected = new Set(journal.proposal.changes.map((change) => change.path))
  if (publishBigPicture) selected.add(BIG_PICTURE_PATH)
  const documents = await collectKnowledgeDocuments(specdevPath)
  const currentHashes = new Map(documents.map((document) => [document.path, document.contentHash]))
  for (const [documentPath, expectedHash] of Object.entries(journal.scan.document_hashes)) {
    if (selected.has(documentPath)) continue
    if (currentHashes.get(documentPath) !== expectedHash) {
      throw new Error(`${documentPath} changed after proposal approval; rescan before publication`)
    }
  }
  for (const documentPath of currentHashes.keys()) {
    if (!selected.has(documentPath) && !(documentPath in journal.scan.document_hashes)) {
      throw new Error(`${documentPath} appeared after proposal approval; rescan before publication`)
    }
  }
  await assertRepositoryEvidence(targetDir, journal.proposal.repository_evidence, current.revision)
}

function buildReceipt(journal, selectedChanges, publishBigPicture) {
  return {
    version: CURATION_VERSION,
    id: `KC-${journal.proposal_id.slice(0, 12)}`,
    proposal_id: journal.proposal_id,
    scan_id: journal.scan.scan_id,
    approvals: journal.approvals,
    changed_paths: selectedChanges.map((change) => change.path),
    knowledge_changes: journal.proposal.changes.map((change) => ({
      path: change.path,
      action: change.action,
      content_hash: hashText(change.content),
      sources: parseKnowledgeMetadata(change.content, change.path).sources,
      verification: change.verification,
      ...(change.repository_evidence ? { repository_evidence: change.repository_evidence } : {}),
    })),
    repository_evidence: journal.proposal.repository_evidence,
    big_picture: publishBigPicture
      ? { approved: true, content_hash: hashText(journal.proposal.big_picture.content) }
      : { approved: false, proposed: Boolean(journal.proposal.big_picture) },
    conflicts: journal.proposal.conflicts,
    exclusions: journal.proposal.exclusions,
    publication: { status: 'published', published_at: new Date().toISOString() },
    index: { status: 'pending', recovery_command: 'specdev knowledge rebuild' },
    status: 'pending_index',
  }
}

async function finalizeReceiptIndex(path, index, status) {
  const receipt = await fse.readJson(path)
  await writeJsonAtomic(path, {
    ...receipt,
    index,
    status,
    completed_at: new Date().toISOString(),
  })
}

function publicJournal(journal) {
  const status =
    journal.phase === 'awaiting_approval'
      ? 'awaiting_approval'
      : journal.phase === 'index_stale'
        ? 'published_index_stale'
        : journal.phase === 'completed'
          ? 'completed'
          : 'in_progress'
  return {
    command: 'knowledge curate',
    version: CURATION_VERSION,
    status,
    phase: journal.phase,
    proposal_id: journal.proposal_id,
    big_picture_approval: journal.big_picture_approval,
    proposed_paths: journal.proposal.changes.map((change) => change.path),
    repository_evidence_count: journal.proposal.repository_evidence.length,
    big_picture_proposed: Boolean(journal.proposal.big_picture),
    published_paths: journal.published_paths,
    index: journal.index,
    receipt: journal.receipt,
    ...(status === 'awaiting_approval'
      ? {
          confirmation: `specdev knowledge curate --approve=${journal.proposal_id}`,
          ...(journal.big_picture_approval
            ? {
                big_picture_confirmation: `--approve-big-picture=${journal.big_picture_approval}`,
              }
            : {}),
        }
      : {}),
    ...(status === 'published_index_stale'
      ? { recovery_command: 'specdev knowledge rebuild' }
      : {}),
  }
}

async function readGitBoundary(targetDir) {
  const [revision, branch, entries] = await Promise.all([
    requireGitHead(targetDir),
    currentGitBranch(targetDir),
    gitStatusEntries(targetDir),
  ])
  return { revision, branch, entries }
}

async function inspectRepositoryEvidence(targetDir, value, boundary) {
  const selectors = normalizeRepositoryEvidenceSelectors(value)
  if (selectors.length > MAX_REPOSITORY_EVIDENCE) {
    throw new Error(`Repository evidence accepts at most ${MAX_REPOSITORY_EVIDENCE} locations`)
  }
  const dirtyPaths = new Set(boundary.entries.map((entry) => normalizeProjectPath(entry.path)))
  const references = new Set()
  const evidence = []
  for (const selector of selectors) {
    const reference = evidenceReference(selector)
    if (references.has(reference)) {
      throw new Error(`Repository evidence location is ambiguous or duplicated: ${reference}`)
    }
    references.add(reference)
    if (dirtyPaths.has(selector.path)) {
      throw new Error(
        `Repository evidence ${selector.path} is dirty; restore or commit it, then rescan before proposing curation`
      )
    }
    if (isGeneratedRepositoryEvidencePath(selector.path)) {
      throw new Error(`Repository evidence ${selector.path} appears generated and is not eligible`)
    }

    const absolute = join(targetDir, selector.path)
    const back = relative(targetDir, absolute).split(sep).join('/')
    if (back !== selector.path) {
      throw new Error(`Repository evidence escapes the project: ${selector.path}`)
    }
    const stat = await fse.lstat(absolute).catch(() => null)
    if (!stat || !stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`Repository evidence ${selector.path} must be a readable regular file`)
    }
    const real = await fse.realpath(absolute).catch(() => null)
    if (!real || relative(targetDir, real).split(sep).join('/').startsWith('../')) {
      throw new Error(`Repository evidence ${selector.path} resolves outside the project`)
    }
    if (stat.size > MAX_REPOSITORY_FILE_BYTES) {
      throw new Error(
        `Repository evidence ${selector.path} exceeds the ${MAX_REPOSITORY_FILE_BYTES}-byte file bound`
      )
    }

    const tracked = await gitProbe(targetDir, ['ls-files', '--error-unmatch', '--', selector.path])
    if (!tracked.ok) {
      throw new Error(
        `Repository evidence ${selector.path} must be an unambiguous tracked file at ${boundary.revision}`
      )
    }
    const ignored = await gitProbe(targetDir, [
      'check-ignore',
      '--no-index',
      '-q',
      '--',
      selector.path,
    ])
    if (ignored.ok) {
      throw new Error(
        `Repository evidence ${selector.path} is ignored and not eligible; choose tracked source and rescan`
      )
    }
    const attributes = await gitProbe(targetDir, ['check-attr', '--all', '--', selector.path])
    if (
      attributes.ok &&
      /(?:^|\n)[^\n]+:\s*(?:linguist-generated|generated):\s*(?:set|true)\s*$/m.test(
        attributes.stdout
      )
    ) {
      throw new Error(
        `Repository evidence ${selector.path} is marked generated and is not eligible`
      )
    }

    const bytes = await fse.readFile(absolute).catch(() => null)
    if (!bytes) throw new Error(`Repository evidence ${selector.path} is not readable`)
    const text = bytes.toString('utf8')
    if (!Buffer.from(text, 'utf8').equals(bytes)) {
      throw new Error(`Repository evidence ${selector.path} must be UTF-8 text`)
    }
    const lines = text.match(/[^\n]*\n|[^\n]+$/g) || []
    if (selector.line_end > lines.length) {
      throw new Error(
        `Repository evidence ${reference} exceeds the file's ${lines.length} attributable lines`
      )
    }
    const lineCount = selector.line_end - selector.line_start + 1
    if (lineCount > MAX_REPOSITORY_EVIDENCE_LINES) {
      throw new Error(
        `Repository evidence ${reference} exceeds the ${MAX_REPOSITORY_EVIDENCE_LINES}-line bound`
      )
    }
    const selectedBytes = Buffer.from(
      lines.slice(selector.line_start - 1, selector.line_end).join(''),
      'utf8'
    )
    if (selectedBytes.length > MAX_REPOSITORY_EVIDENCE_BYTES) {
      throw new Error(
        `Repository evidence ${reference} exceeds the ${MAX_REPOSITORY_EVIDENCE_BYTES}-byte selection bound`
      )
    }
    evidence.push({
      reference,
      path: selector.path,
      line_start: selector.line_start,
      line_end: selector.line_end,
      revision: boundary.revision,
      content_hash: hashText(selectedBytes),
      file_hash: hashText(bytes),
      byte_length: selectedBytes.length,
    })
  }
  return evidence.sort((left, right) => left.reference.localeCompare(right.reference))
}

async function assertRepositoryEvidence(targetDir, expected, revision) {
  if (!Array.isArray(expected) || expected.length === 0) return
  const boundary = await readGitBoundary(targetDir)
  if (boundary.revision !== revision) {
    throw new Error('Repository evidence Git boundary changed; rescan before publication')
  }
  const actual = await inspectRepositoryEvidence(
    targetDir,
    repositoryEvidenceSelectors(expected),
    boundary
  )
  if (stableStringify(actual) !== stableStringify(expected)) {
    throw new Error(
      'Repository evidence bytes or attributable locations changed; rescan before publication'
    )
  }
}

function validateRepositoryEvidence(value, expected) {
  const proposed = Array.isArray(value) ? value : value === undefined ? [] : null
  if (!proposed) throw new Error('repository_evidence must be a list')
  if (stableStringify(proposed) !== stableStringify(expected || [])) {
    throw new Error('repository_evidence does not match the current bounded scan')
  }
  return (expected || []).map((evidence) => ({ ...evidence }))
}

function normalizeEvidenceReferences(value, knownReferences, field) {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error(`${field}.repository_evidence must be a list`)
  const references = [...new Set(value.map((item) => String(item || '').trim()))]
  for (const reference of references) {
    if (!knownReferences.has(reference)) {
      throw new Error(`${field}.repository_evidence references unknown evidence ${reference}`)
    }
  }
  return references.sort()
}

function repositoryEvidenceSelectors(value) {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error('repository_evidence must be a list')
  return value.map((item) => {
    if (typeof item === 'string') return item
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('repository_evidence entries must be bound evidence objects')
    }
    return {
      path: item.path,
      line_start: item.line_start,
      line_end: item.line_end,
    }
  })
}

function normalizeRepositoryEvidenceSelectors(value) {
  const items =
    typeof value === 'string'
      ? value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : Array.isArray(value)
        ? value
        : value === undefined || value === null
          ? []
          : [value]
  return items.map((item, index) => {
    if (typeof item === 'string') {
      const match = item.match(/^(.+)#L([1-9]\d*)(?:-L?([1-9]\d*))?$/)
      if (!match) {
        throw new Error(`Repository evidence ${index + 1} must use project/path#Lstart-Lend`)
      }
      return normalizeRepositoryEvidenceSelector(match[1], match[2], match[3] || match[2])
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Repository evidence ${index + 1} must be a location string or object`)
    }
    return normalizeRepositoryEvidenceSelector(item.path, item.line_start, item.line_end)
  })
}

function normalizeRepositoryEvidenceSelector(pathValue, startValue, endValue) {
  const path = normalizeProjectPath(pathValue)
  if (
    !path ||
    path.startsWith('/') ||
    path === '..' ||
    path.startsWith('../') ||
    path.includes('/../') ||
    path === '.specdev' ||
    path.startsWith('.specdev/') ||
    path === '.git' ||
    path.startsWith('.git/')
  ) {
    throw new Error('Repository evidence paths must be safe project-relative product paths')
  }
  const lineStart = Number(startValue)
  const lineEnd = Number(endValue)
  if (
    !Number.isInteger(lineStart) ||
    !Number.isInteger(lineEnd) ||
    lineStart < 1 ||
    lineEnd < lineStart
  ) {
    throw new Error(`Repository evidence ${path} requires a valid ascending line range`)
  }
  return { path, line_start: lineStart, line_end: lineEnd }
}

function evidenceReference(selector) {
  return `${selector.path}#L${selector.line_start}-L${selector.line_end}`
}

function normalizeProjectPath(value) {
  return String(value || '')
    .trim()
    .replaceAll('\\', '/')
}

function isGeneratedRepositoryEvidencePath(path) {
  const parts = path.toLowerCase().split('/')
  if (
    parts.some((part) =>
      ['node_modules', 'dist', 'build', 'coverage', '.next', 'generated'].includes(part)
    )
  ) {
    return true
  }
  return /(?:\.min\.[^.]+|\.map|\.generated\.[^.]+)$/.test(parts.at(-1))
}

async function gitProbe(targetDir, args) {
  try {
    const { stdout = '' } = await execFile('git', args, { cwd: targetDir, encoding: 'utf8' })
    return { ok: true, stdout }
  } catch (error) {
    return { ok: false, stdout: error.stdout || '', stderr: error.stderr || '' }
  }
}

function normalizeOwnerCheck(value) {
  return {
    query: value.query.trim(),
    matches: [
      ...new Set(value.matches.map((item) => normalizeRelativePath(item, 'owner match'))),
    ].sort(),
    decision: String(value.decision || '').trim(),
  }
}

function normalizeVerification(value) {
  return value.map((evidence) => ({
    kind: evidence.kind,
    reference: evidence.reference.trim(),
    verified_at: evidence.verified_at,
  }))
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeFindings(value, field) {
  return value.map((finding, index) => {
    if (!finding || typeof finding !== 'object' || Array.isArray(finding)) {
      throw new Error(`${field}[${index}] must be an object`)
    }
    const path = normalizeRelativePath(finding.path || finding.topic || '', `${field}[${index}]`)
    const reason = String(finding.reason || finding.resolution || '').trim()
    if (!reason) throw new Error(`${field}[${index}] requires a reason or resolution`)
    return { path, reason }
  })
}

function normalizeScope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('scope must be an object')
  const normalized = {}
  for (const key of ['assignment', 'mission', 'discussion']) {
    if (value[key] !== undefined) normalized[key] = String(value[key]).trim()
  }
  if (value.limit !== undefined) normalized.limit = boundedLimit(value.limit)
  return normalized
}

function isKnowledgeDestination(path) {
  const parts = String(path || '').split('/')
  return (
    parts.length >= 3 &&
    parts[0] === 'knowledge' &&
    KNOWLEDGE_BRANCHES.has(parts[1]) &&
    parts.at(-1).endsWith('.md') &&
    parts.at(-1) !== '.gitkeep'
  )
}

function normalizeRelativePath(value, field) {
  const path = String(value || '')
    .trim()
    .replaceAll('\\', '/')
    .replace(/^\.specdev\//, '')
  if (
    !path ||
    path.startsWith('/') ||
    path === '..' ||
    path.startsWith('../') ||
    path.includes('/../')
  ) {
    throw new Error(`${field} must be a safe .specdev-relative path`)
  }
  return path
}

function safeSpecdevPath(specdevPath, relPath) {
  const normalized = normalizeRelativePath(relPath, 'destination path')
  const absolute = join(specdevPath, normalized)
  const back = relative(specdevPath, absolute).split(sep).join('/')
  if (back !== normalized) throw new Error(`Destination escapes .specdev: ${relPath}`)
  return absolute
}

function fromRepoPath(repoPath) {
  const normalized = String(repoPath || '').replaceAll('\\', '/')
  return normalized.startsWith('.specdev/') ? normalized.slice('.specdev/'.length) : null
}

function curationJournalPath(specdevPath) {
  return join(specdevPath, 'cache', 'knowledge-curation', 'active.json')
}

function curationReceiptPath(specdevPath, proposalId) {
  return join(specdevPath, 'knowledge-curations', `KC-${proposalId.slice(0, 12)}.json`)
}

async function updateJournal(path, journal, patch) {
  const next = { ...journal, ...patch, updated_at: new Date().toISOString() }
  await writeJsonAtomic(path, next)
  return next
}

async function readJsonIfExists(path) {
  return (await fse.pathExists(path)) ? fse.readJson(path) : null
}

async function hashFile(path) {
  return (await fse.pathExists(path)) ? hashText(await fse.readFile(path)) : null
}

function hashText(value) {
  return createHash('sha256').update(value).digest('hex')
}

function digest(value) {
  return hashText(stableStringify(value))
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function boundedLimit(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, MAX_LIMIT) : DEFAULT_LIMIT
}

function toSpecdevRelative(specdevPath, path) {
  return relative(specdevPath, path).split(sep).join('/')
}

async function writeTextAtomic(path, content) {
  const temporary = `${path}.tmp-${process.pid}`
  await fse.ensureDir(dirname(path))
  await fse.writeFile(temporary, content, 'utf-8')
  await fse.move(temporary, path, { overwrite: true })
}

async function writeJsonAtomic(path, value) {
  const temporary = `${path}.tmp-${process.pid}`
  await fse.ensureDir(dirname(path))
  await fse.writeJson(temporary, value, { spaces: 2 })
  await fse.move(temporary, path, { overwrite: true })
}
