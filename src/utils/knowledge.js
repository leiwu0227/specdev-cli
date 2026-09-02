import { createHash, randomUUID } from 'node:crypto'
import { rename } from 'node:fs/promises'
import { basename, dirname, join, relative, sep } from 'node:path'
import fse from 'fs-extra'
import { parse as parseYaml } from 'yaml'
import {
  discussionArtifactCompletionMatches,
  discussionArtifactManifest,
} from './discussion-artifacts.js'
import { listGuidedCalls, readGuidedCall } from './callable-sync.js'

export const KNOWLEDGE_DB_SUBPATH = 'cache/knowledge.sqlite'
export const KNOWLEDGE_DB_RELATIVE_PATH = `.specdev/${KNOWLEDGE_DB_SUBPATH}`
const SCHEMA_VERSION = 3
const VALID_SCOPES = new Set(['default', 'history', 'workflow', 'all'])
const VALID_SEARCH_MODES = new Set(['precise', 'broad'])
const VALID_KNOWLEDGE_STATUSES = new Set(['active', 'superseded'])
const MAX_PRECISE_FALLBACK_RESULTS = 5

export function normalizeFtsTerms(query) {
  const matches = tokenizeFtsTerms(query)
  const seen = new Set()
  const terms = []
  for (const raw of matches) {
    const term = raw.replace(/^[./:@-]+|[./:@-]+$/g, '')
    const key = term.toLowerCase()
    if (!term || seen.has(key)) continue
    seen.add(key)
    terms.push(term)
  }
  return terms
}

export function parseKnowledgeSearchQuery(query) {
  const input = String(query || '').trim()
  const atoms = []
  let outside = ''
  let phrase = ''
  let quoted = false

  const addTerms = (value) => {
    for (const term of normalizeFtsTerms(value)) atoms.push({ type: 'term', value: term })
  }
  const addPhrase = (value) => {
    const normalized = tokenizeFtsTerms(value).join(' ')
    if (!normalized) throw invalidKnowledgeQuery('quoted phrases must contain searchable text')
    atoms.push({ type: 'phrase', value: normalized })
  }

  for (const character of input) {
    if (character === '"') {
      if (quoted) {
        addPhrase(phrase)
        phrase = ''
      } else {
        addTerms(outside)
        outside = ''
      }
      quoted = !quoted
      continue
    }
    if (quoted) phrase += character
    else outside += character
  }
  if (quoted) throw invalidKnowledgeQuery('quoted phrase is not closed')
  addTerms(outside)

  const seen = new Set()
  const uniqueAtoms = atoms.filter((atom) => {
    const key = `${atom.type}:${atom.value.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (uniqueAtoms.length === 0) {
    throw invalidKnowledgeQuery('query contains no searchable terms or phrases')
  }
  return {
    atoms: uniqueAtoms,
    terms: uniqueAtoms.filter((atom) => atom.type === 'term').map((atom) => atom.value),
    phrases: uniqueAtoms.filter((atom) => atom.type === 'phrase').map((atom) => atom.value),
  }
}

export function normalizeFtsQuery(query, mode = 'broad') {
  if (!VALID_SEARCH_MODES.has(mode)) throw new Error(`invalid knowledge search mode: ${mode}`)
  const separator = mode === 'precise' ? ' AND ' : ' OR '
  return parseKnowledgeSearchQuery(query).atoms.map(escapeFtsAtom).join(separator)
}

export async function buildKnowledgeIndex(specdevPath) {
  const sqlite = await loadSqlite()
  const dbPath = join(specdevPath, KNOWLEDGE_DB_SUBPATH)
  const temporaryPath = `${dbPath}.tmp-${process.pid}-${randomUUID()}`
  await fse.ensureDir(dirname(dbPath))
  const documents = await collectKnowledgeDocuments(specdevPath)
  const fingerprint = sourceFingerprint(documents)
  const db = new sqlite.DatabaseSync(temporaryPath)
  let committed = false
  let buildError = null
  try {
    initializeSchema(db)
    const insertDocument = db.prepare(`
      INSERT INTO documents (
        path, kind, authority, completion_status, assignment_id, mission_id,
        phase, title, content, content_hash, mtime_ms, indexed_at,
        knowledge_status, verified_at, review_after, applies_to, source_paths,
        superseded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertFts = db.prepare(`
      INSERT INTO documents_fts (document_id, title, content, path, kind)
      VALUES (?, ?, ?, ?, ?)
    `)
    const insertMeta = db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)')
    const indexedAt = new Date().toISOString()

    db.exec('BEGIN IMMEDIATE')
    insertMeta.run('schema_version', String(SCHEMA_VERSION))
    insertMeta.run('source_fingerprint', fingerprint)
    insertMeta.run('indexed_at', indexedAt)
    insertMeta.run('document_count', String(documents.length))
    for (const doc of documents) {
      const result = insertDocument.run(
        doc.path,
        doc.kind,
        doc.authority,
        doc.completionStatus,
        doc.assignmentId,
        doc.missionId,
        doc.phase,
        doc.title,
        doc.content,
        doc.contentHash,
        doc.mtimeMs,
        indexedAt,
        doc.knowledgeStatus,
        doc.verifiedAt,
        doc.reviewAfter,
        doc.appliesTo ? JSON.stringify(doc.appliesTo) : null,
        doc.sources.length > 0 ? JSON.stringify(doc.sources) : null,
        doc.supersededBy
      )
      insertFts.run(Number(result.lastInsertRowid), doc.title, doc.content, doc.path, doc.kind)
    }
    db.exec('COMMIT')
    committed = true

    const count = Number(db.prepare('SELECT count(*) AS count FROM documents').get().count)
    const integrity = db.prepare('PRAGMA integrity_check').get().integrity_check
    if (count !== documents.length || integrity !== 'ok') {
      throw new Error(`knowledge rebuild validation failed: rows=${count}, integrity=${integrity}`)
    }
  } catch (error) {
    if (!committed) {
      try {
        db.exec('ROLLBACK')
      } catch {}
    }
    buildError = error
  } finally {
    db.close()
  }
  if (buildError) {
    await fse.remove(temporaryPath).catch(() => {})
    throw buildError
  }

  try {
    await rename(temporaryPath, dbPath)
  } catch (error) {
    await fse.remove(temporaryPath).catch(() => {})
    throw error
  }
  return { databasePath: KNOWLEDGE_DB_RELATIVE_PATH, documentCount: documents.length, fingerprint }
}

export async function searchKnowledgeIndex(specdevPath, query, options = {}) {
  const scope = options.scope || 'default'
  if (!VALID_SCOPES.has(scope)) throw new Error(`invalid knowledge scope: ${scope}`)
  const mode = options.mode || 'precise'
  if (!VALID_SEARCH_MODES.has(mode)) throw new Error(`invalid knowledge search mode: ${mode}`)
  const parsedQuery = parseKnowledgeSearchQuery(query)
  if (await knowledgeIndexIsStale(specdevPath)) await buildKnowledgeIndex(specdevPath)

  const sqlite = await loadSqlite()
  const db = new sqlite.DatabaseSync(join(specdevPath, KNOWLEDGE_DB_SUBPATH), { readOnly: true })
  try {
    const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 10
    const eligibility = scopeEligibility(scope)
    const today = dateOnly(options.now || new Date(), 'search date')
    const freshnessClause = options.includeStale
      ? ''
      : 'AND (d.review_after IS NULL OR d.review_after >= ?)'
    const statement = db.prepare(`
      SELECT
        d.path, d.kind, d.authority, d.completion_status,
        d.assignment_id, d.mission_id, d.phase, d.title, d.content,
        d.knowledge_status, d.verified_at, d.review_after, d.applies_to, d.source_paths,
        d.superseded_by,
        snippet(documents_fts, 2, '[', ']', ' ... ', 24) AS snippet,
        bm25(documents_fts) AS score
      FROM documents_fts
      JOIN documents d ON d.id = documents_fts.document_id
      WHERE documents_fts MATCH ? AND d.authority IN (${eligibility.map(() => '?').join(', ')})
        ${freshnessClause}
      ORDER BY score
      LIMIT ?
    `)
    const runQuery = (ftsQuery) => {
      const parameters = [ftsQuery, ...eligibility]
      if (!options.includeStale) parameters.push(today)
      parameters.push(Math.max(limit * 50, 500))
      return statement.all(...parameters)
    }

    let tier = mode === 'broad' ? 'broad' : parsedQuery.phrases.length > 0 ? 'phrase' : 'complete'
    let resultLimit = limit
    let rows = runQuery(normalizeFtsQuery(query, mode))
    if (mode === 'precise' && rows.length === 0 && parsedQuery.atoms.length > 1) {
      tier = 'partial_fallback'
      resultLimit = Math.min(limit, MAX_PRECISE_FALLBACK_RESULTS)
      rows = runQuery(normalizeFtsQuery(query, 'broad'))
    }

    return rows
      .map((row) => ({
        ...row,
        ...matchDiagnostics(row, parsedQuery),
        match_mode: mode,
        match_tier: tier,
        freshness: knowledgeFreshness(row, today),
        applies_to: parseJsonValue(row.applies_to),
        sources: parseJsonValue(row.source_paths) || [],
      }))
      .sort(
        (left, right) =>
          right.coverage - left.coverage ||
          freshnessRank(left.freshness) - freshnessRank(right.freshness) ||
          authorityRank(left.authority) - authorityRank(right.authority) ||
          left.score - right.score ||
          left.path.localeCompare(right.path)
      )
      .slice(0, resultLimit)
      .map(({ content, applies_to, source_paths, ...row }) => ({
        ...row,
        ...(applies_to ? { applies_to } : {}),
        snippet: normalizeWhitespace(row.snippet),
      }))
  } finally {
    db.close()
  }
}

export async function buildKnowledgeDistillationBrief(specdevPath, options = {}) {
  const documents = await collectKnowledgeDocuments(specdevPath)
  const today = dateOnly(options.now || new Date(), 'distillation date')
  const limit = boundedLimit(options.limit)
  const curated = documents.filter(
    (doc) => doc.path.startsWith('knowledge/') && doc.path !== 'knowledge/_index.md'
  )
  const activeKnowledge = curated.filter((doc) => doc.knowledgeStatus !== 'superseded')
  const citedSources = new Set(activeKnowledge.flatMap((doc) => doc.sources))
  const completedOutcomes = documents
    .filter((doc) => ['assignment_outcome', 'mission_outcome'].includes(doc.kind))
    .filter((doc) => doc.completionStatus === 'completed')
    .filter((doc) => matchesDistillationScope(doc, options))
  const completedDiscussionIds = await readCompletedDiscussionIds(specdevPath, documents)
  const completedDiscussionDesigns = documents
    .filter(
      (doc) => doc.kind === 'discussion_artifact' && doc.path.endsWith('/brainstorm/design.md')
    )
    .filter((doc) => completedDiscussionIds.has(discussionIdFromPath(doc.path)))
    .filter((doc) => matchesDistillationScope(doc, options))
  const unreferencedSourceDocuments = [...completedOutcomes, ...completedDiscussionDesigns]
    .filter((doc) => !citedSources.has(doc.path))
    .sort((left, right) => right.mtimeMs - left.mtimeMs || left.path.localeCompare(right.path))
  const unreferencedSources = await Promise.all(
    unreferencedSourceDocuments.slice(0, limit).map((doc) => sourceSummary(specdevPath, doc))
  )
  const staleFaqDocuments = curated
    .filter((doc) => doc.kind === 'faq' && knowledgeFreshness(doc, today) === 'stale')
    .sort(
      (left, right) =>
        left.reviewAfter.localeCompare(right.reviewAfter) || left.path.localeCompare(right.path)
    )
  const staleFaqs = staleFaqDocuments.slice(0, limit).map((doc) => knowledgeSummary(doc, today))
  const supersededFaqDocuments = curated
    .filter((doc) => doc.kind === 'faq' && doc.knowledgeStatus === 'superseded')
    .sort((left, right) => left.path.localeCompare(right.path))
  const supersededFaqs = supersededFaqDocuments
    .slice(0, limit)
    .map((doc) => knowledgeSummary(doc, today))

  return {
    command: 'knowledge distill',
    version: 1,
    status: 'ok',
    generated_at: new Date().toISOString(),
    limit,
    unreferenced_source_count: unreferencedSourceDocuments.length,
    unreferenced_sources: unreferencedSources,
    stale_faq_count: staleFaqDocuments.length,
    stale_faqs: staleFaqs,
    superseded_faq_count: supersededFaqDocuments.length,
    superseded_faqs: supersededFaqs,
    existing_knowledge_count: curated.length,
    existing_knowledge: curated.slice(0, limit).map((doc) => knowledgeSummary(doc, today)),
    destinations: {
      faq: 'knowledge/faq/',
      architecture: 'knowledge/architecture/',
      codestyle: 'knowledge/codestyle/',
      domain: 'knowledge/domain/',
      workflow: 'knowledge/workflow/',
      workflow_feedback: 'knowledge/workflow_feedback/',
    },
    faq_template: '_templates/faq.md',
    guidance: [
      'Read only the relevant unreferenced outcomes and existing knowledge before editing.',
      'The brief is bounded. Use --assignment, --mission, or --discussion to narrow a follow-up run rather than increasing context indiscriminately.',
      'Route reusable repository troubleshooting to faq; durable design decisions to architecture; SpecDev product problems to product work or workflow_feedback; discard one-off noise.',
      'Search existing knowledge with the topic keywords before writing; update an existing entry when it already owns the topic and do not create a duplicate.',
      'Cite each distilled outcome in frontmatter sources using its .specdev-relative path.',
      'For a stale FAQ, verify it against the current repository or authoritative documentation before refreshing verified_at and review_after.',
      'After Markdown changes, run specdev knowledge rebuild. SQLite remains disposable generated state.',
    ],
  }
}

export async function knowledgeIndexIsStale(specdevPath) {
  const dbPath = join(specdevPath, KNOWLEDGE_DB_SUBPATH)
  if (!(await fse.pathExists(dbPath))) return true
  const expected = sourceFingerprint(await collectKnowledgeSourceStats(specdevPath))
  let sqlite
  let db
  try {
    sqlite = await loadSqlite()
    db = new sqlite.DatabaseSync(dbPath, { readOnly: true })
    const meta = Object.fromEntries(
      db
        .prepare('SELECT key, value FROM metadata')
        .all()
        .map((row) => [row.key, row.value])
    )
    return Number(meta.schema_version) !== SCHEMA_VERSION || meta.source_fingerprint !== expected
  } catch {
    return true
  } finally {
    db?.close()
  }
}

export async function collectKnowledgeDocuments(specdevPath) {
  const files = (await collectKnowledgeSourceStats(specdevPath)).map((entry) => entry.absolutePath)

  const documents = []
  for (const file of files.sort((left, right) => left.localeCompare(right))) {
    const relPath = toSpecdevRelativePath(specdevPath, file)
    const content = await fse.readFile(file, 'utf-8')
    const classification = await classifyDocument(specdevPath, relPath, content)
    const stat = await fse.stat(file)
    documents.push({
      path: relPath,
      content,
      contentHash: hashContent(content),
      title: extractTitle(content, file),
      mtimeMs: Math.trunc(stat.mtimeMs),
      size: stat.size,
      ...classification,
    })
  }
  return documents
}

async function collectKnowledgeSourceStats(specdevPath) {
  const files = []
  // Adhoc receipts are intentionally excluded. They are high-volume historical
  // evidence searched through rg/Git; indexed workflow knowledge explains how.
  for (const root of [
    'project_notes',
    'knowledge',
    'assignments',
    'missions',
    'discussions',
    '_guides',
    'guides',
    'skills',
  ]) {
    const absolute = join(specdevPath, root)
    if (await fse.pathExists(absolute)) await collectMarkdownFiles(absolute, files)
  }
  const stats = []
  for (const absolutePath of files.sort((left, right) => left.localeCompare(right))) {
    const stat = await fse.stat(absolutePath)
    stats.push({
      absolutePath,
      path: toSpecdevRelativePath(specdevPath, absolutePath),
      mtimeMs: Math.trunc(stat.mtimeMs),
      size: stat.size,
    })
  }
  return stats
}

async function classifyDocument(specdevPath, relPath, content) {
  const parts = relPath.split('/')
  if (parts[0] === 'knowledge') {
    const metadata = parseKnowledgeMetadata(content, relPath)
    const workflowFeedback = parts[1] === 'workflow_feedback'
    const superseded = metadata.knowledgeStatus === 'superseded'
    return {
      kind: parts[1] === 'faq' ? 'faq' : workflowFeedback ? 'workflow_feedback' : 'knowledge_note',
      authority: superseded ? 'history' : workflowFeedback ? 'workflow' : 'living',
      completionStatus: null,
      assignmentId: null,
      missionId: null,
      phase: parts[1] || null,
      ...metadata,
    }
  }
  if (parts[0] === 'project_notes') {
    const topLevel = parts.length === 2
    return {
      kind: kindFromProjectNote(parts.at(-1)),
      authority: topLevel ? 'project' : 'all',
      completionStatus: null,
      assignmentId: null,
      missionId: null,
      phase: null,
      ...emptyKnowledgeMetadata(),
    }
  }
  if (parts[0] === 'assignments') {
    const status = await readEntityStatus(join(specdevPath, 'assignments', parts[1]))
    const completed = entityStatusCompleted(status)
    const outcome = parts.length === 3 && parts[2] === 'outcome.md'
    return {
      kind: outcome ? 'assignment_outcome' : 'assignment_artifact',
      authority: completed && outcome ? 'verified_history' : completed ? 'history' : 'all',
      completionStatus: completed ? 'completed' : 'incomplete',
      assignmentId: parts[1] || null,
      missionId: status?.mission || null,
      phase: parts[2] || null,
      ...emptyKnowledgeMetadata(),
    }
  }
  if (parts[0] === 'missions') {
    const completed = entityStatusCompleted(
      await readEntityStatus(join(specdevPath, 'missions', parts[1]))
    )
    const outcome = parts.length === 3 && parts[2] === 'outcome.md'
    return {
      kind: outcome ? 'mission_outcome' : 'mission_artifact',
      authority: completed && outcome ? 'verified_history' : completed ? 'history' : 'all',
      completionStatus: completed ? 'completed' : 'incomplete',
      assignmentId: null,
      missionId: parts[1] || null,
      phase: parts[2] || null,
      ...emptyKnowledgeMetadata(),
    }
  }
  if (parts[0] === 'discussions') {
    return {
      kind: 'discussion_artifact',
      authority: 'all',
      completionStatus: null,
      assignmentId: null,
      missionId: null,
      phase: parts[2] || null,
      ...emptyKnowledgeMetadata(),
    }
  }
  if (['_guides', 'guides', 'skills'].includes(parts[0])) {
    return {
      kind: parts[0] === 'skills' ? 'skill' : 'guide',
      authority: 'workflow',
      completionStatus: null,
      assignmentId: null,
      missionId: null,
      phase: null,
      ...emptyKnowledgeMetadata(),
    }
  }
  return {
    kind: 'markdown',
    authority: 'all',
    completionStatus: null,
    assignmentId: null,
    missionId: null,
    phase: null,
    ...emptyKnowledgeMetadata(),
  }
}

async function readEntityStatus(entityPath) {
  for (const name of ['status.json', 'mission.yaml']) {
    const statusPath = join(entityPath, name)
    if (!(await fse.pathExists(statusPath))) continue
    try {
      return name.endsWith('.json')
        ? await fse.readJson(statusPath)
        : parseYaml(await fse.readFile(statusPath, 'utf-8'))
    } catch {
      return null
    }
  }
  return null
}

function entityStatusCompleted(status) {
  return status?.status === 'completed' || status?.implementation_approved === true
}

function scopeEligibility(scope) {
  if (scope === 'default') return ['living', 'project', 'verified_history']
  if (scope === 'history') return ['living', 'project', 'verified_history', 'history']
  if (scope === 'workflow') return ['living', 'project', 'verified_history', 'workflow']
  return ['living', 'project', 'verified_history', 'history', 'workflow', 'all']
}

function matchedCoverage(row, terms) {
  const diagnostics = matchDiagnostics(row, {
    atoms: terms.map((term) => ({ type: 'term', value: term })),
    terms,
    phrases: [],
  })
  return diagnostics.coverage
}

function matchDiagnostics(row, parsedQuery) {
  const haystack = `${row.title}\n${row.path}\n${row.content}`.toLowerCase()
  const haystackTerms = tokenizeFtsTerms(haystack).map((term) => term.toLowerCase())
  const termSet = new Set(haystackTerms)
  const matchedTerms = parsedQuery.terms.filter(
    (term) => termSet.has(term.toLowerCase()) || haystack.includes(term.toLowerCase())
  )
  const matchedPhrases = parsedQuery.phrases.filter((phrase) =>
    containsTermSequence(
      haystackTerms,
      tokenizeFtsTerms(phrase).map((term) => term.toLowerCase())
    )
  )
  const matchedAtomCount = matchedTerms.length + matchedPhrases.length
  return {
    coverage: matchedAtomCount / parsedQuery.atoms.length,
    matched_terms: matchedTerms,
    matched_phrases: matchedPhrases,
  }
}

function tokenizeFtsTerms(value) {
  return (String(value || '').match(/[A-Za-z0-9_./:@-]+/g) || [])
    .map((term) => term.replace(/^[./:@-]+|[./:@-]+$/g, ''))
    .filter(Boolean)
}

function containsTermSequence(haystack, needle) {
  if (needle.length === 0 || needle.length > haystack.length) return false
  for (let index = 0; index <= haystack.length - needle.length; index += 1) {
    if (needle.every((term, offset) => haystack[index + offset] === term)) return true
  }
  return false
}

function escapeFtsAtom(atom) {
  return `"${atom.value.replaceAll('"', '""')}"`
}

function invalidKnowledgeQuery(message) {
  const error = new Error(`invalid knowledge query: ${message}`)
  error.code = 'KNOWLEDGE_QUERY_INVALID'
  return error
}

function sourceFingerprint(documents) {
  const hash = createHash('sha256')
  for (const doc of documents) {
    hash.update(doc.path)
    hash.update('\0')
    hash.update(String(doc.mtimeMs))
    hash.update('\0')
    hash.update(String(doc.size))
    hash.update('\0')
  }
  return hash.digest('hex')
}

async function loadSqlite() {
  try {
    return await import('node:sqlite')
  } catch {
    const error = new Error(
      'SQLite support is unavailable. Use a Node.js runtime that provides node:sqlite.'
    )
    error.code = 'SQLITE_UNAVAILABLE'
    throw error
  }
}

function initializeSchema(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE documents (
      id INTEGER PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      authority TEXT NOT NULL,
      completion_status TEXT,
      assignment_id TEXT,
      mission_id TEXT,
      phase TEXT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      mtime_ms INTEGER NOT NULL,
      indexed_at TEXT NOT NULL,
      knowledge_status TEXT,
      verified_at TEXT,
      review_after TEXT,
      applies_to TEXT,
      source_paths TEXT,
      superseded_by TEXT
    );
    CREATE VIRTUAL TABLE documents_fts USING fts5(document_id UNINDEXED, title, content, path, kind);
  `)
}

async function collectMarkdownFiles(dir, files) {
  const entries = await fse.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const absolute = join(dir, entry.name)
    if (entry.isDirectory()) await collectMarkdownFiles(absolute, files)
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(absolute)
  }
}

function kindFromProjectNote(fileName = '') {
  if (fileName === 'big_picture.md') return 'big_picture'
  if (fileName === 'working_memory.md') return 'working_memory'
  if (fileName === 'feature_descriptions.md') return 'feature_description'
  return 'project_note'
}

function extractTitle(content, file) {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() || basename(file, '.md')
}

function hashContent(content) {
  return createHash('sha256').update(content).digest('hex')
}

function toSpecdevRelativePath(specdevPath, file) {
  return relative(specdevPath, file).split(sep).join('/')
}

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseKnowledgeMetadata(content, path = 'knowledge document') {
  const match = String(content || '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) return { ...emptyKnowledgeMetadata(), knowledgeStatus: 'active' }
  let frontmatter
  try {
    frontmatter = parseYaml(match[1])
  } catch (error) {
    throw new Error(`${path}: invalid YAML frontmatter: ${error.message}`)
  }
  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    throw new Error(`${path}: knowledge frontmatter must be a mapping`)
  }
  const knowledgeStatus = String(frontmatter.status || 'active')
    .trim()
    .toLowerCase()
  if (!VALID_KNOWLEDGE_STATUSES.has(knowledgeStatus)) {
    throw new Error(`${path}: status must be active or superseded`)
  }
  const verifiedAt = optionalDate(frontmatter.verified_at, `${path} verified_at`)
  const reviewAfter = optionalDate(frontmatter.review_after, `${path} review_after`)
  const appliesTo = normalizeStringMap(frontmatter.applies_to, `${path} applies_to`)
  const sources = normalizeSources(frontmatter.sources, path)
  const supersededBy = frontmatter.superseded_by
    ? normalizeSourcePath(frontmatter.superseded_by, path)
    : null
  return { knowledgeStatus, verifiedAt, reviewAfter, appliesTo, sources, supersededBy }
}

export function knowledgeFreshness(metadata, now = new Date()) {
  if (metadata.knowledgeStatus === 'superseded' || metadata.knowledge_status === 'superseded') {
    return 'superseded'
  }
  const reviewAfter = metadata.reviewAfter || metadata.review_after
  if (!reviewAfter) return 'current'
  return reviewAfter < dateOnly(now, 'freshness date') ? 'stale' : 'current'
}

function emptyKnowledgeMetadata() {
  return {
    knowledgeStatus: null,
    verifiedAt: null,
    reviewAfter: null,
    appliesTo: null,
    sources: [],
    supersededBy: null,
  }
}

function optionalDate(value, field) {
  if (value === undefined || value === null || value === '') return null
  return dateOnly(value, field)
}

function dateOnly(value, field) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return [
      String(value.getFullYear()).padStart(4, '0'),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0'),
    ].join('-')
  }
  const text = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`${field} must use YYYY-MM-DD`)
  const parsed = new Date(`${text}T00:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new Error(`${field} is not a valid calendar date`)
  }
  return text
}

function normalizeStringMap(value, field) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${field} must be a mapping`)
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [String(key), String(item)]))
}

function normalizeSources(value, path) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value))
    throw new Error(`${path}: sources must be a list of .specdev-relative paths`)
  return [...new Set(value.map((source) => normalizeSourcePath(source, path)))]
}

function normalizeSourcePath(value, path) {
  const source = String(value || '')
    .trim()
    .replaceAll('\\', '/')
    .replace(/^\.specdev\//, '')
  if (
    !source ||
    source.startsWith('/') ||
    source === '..' ||
    source.startsWith('../') ||
    source.includes('/../')
  ) {
    throw new Error(`${path}: invalid source path: ${value}`)
  }
  return source
}

function parseJsonValue(value) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function freshnessRank(value) {
  if (value === 'current') return 0
  if (value === 'stale') return 1
  return 2
}

function authorityRank(value) {
  return ['living', 'project', 'verified_history', 'history', 'workflow', 'all'].indexOf(value)
}

function boundedLimit(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 20
}

function matchesDistillationScope(document, options) {
  const assignment = String(options.assignment || '').trim()
  const mission = String(options.mission || '').trim()
  const discussion = String(options.discussion || '').trim()
  if (assignment && !entitySelectorMatches(document.assignmentId, assignment)) return false
  if (mission && !entitySelectorMatches(document.missionId, mission)) return false
  if (discussion && discussionIdFromPath(document.path) !== discussion) return false
  return true
}

function entitySelectorMatches(entity, selector) {
  if (!entity) return false
  return entity === selector || entity.startsWith(`${selector}_`)
}

async function sourceSummary(specdevPath, document) {
  const discussion = discussionIdFromPath(document.path)
  const summary = {
    path: document.path,
    kind: document.kind,
    title: document.title,
    ...(document.assignmentId ? { assignment: document.assignmentId } : {}),
    ...(document.missionId ? { mission: document.missionId } : {}),
    ...(discussion ? { discussion } : {}),
    content_hash: document.contentHash,
  }
  if (!document.assignmentId || document.kind !== 'assignment_outcome') return summary

  const assignmentPath = join(specdevPath, 'assignments', document.assignmentId)
  const progressPath = join(assignmentPath, 'implementation', 'progress.json')
  const verdictPath = join(assignmentPath, 'review', 'implementation-verdict.md')
  const relatedEvidence = []
  if (await fse.pathExists(progressPath))
    relatedEvidence.push(toSpecdevRelativePath(specdevPath, progressPath))
  if (await fse.pathExists(verdictPath))
    relatedEvidence.push(toSpecdevRelativePath(specdevPath, verdictPath))
  const progress = await fse.readJson(progressPath).catch(() => null)
  return {
    ...summary,
    ...(relatedEvidence.length > 0 ? { related_evidence: relatedEvidence } : {}),
    ...(progress
      ? {
          signals: {
            deviation_count: Array.isArray(progress.deviations) ? progress.deviations.length : 0,
            follow_up: progress.follow_up || null,
          },
        }
      : {}),
  }
}

function knowledgeSummary(document, now = new Date()) {
  return {
    path: document.path,
    kind: document.kind,
    title: document.title,
    status: document.knowledgeStatus || 'active',
    freshness: knowledgeFreshness(document, now),
    ...(document.verifiedAt ? { verified_at: document.verifiedAt } : {}),
    ...(document.reviewAfter ? { review_after: document.reviewAfter } : {}),
    ...(document.appliesTo ? { applies_to: document.appliesTo } : {}),
    ...(document.supersededBy ? { superseded_by: document.supersededBy } : {}),
    sources: document.sources,
  }
}

async function readCompletedDiscussionIds(specdevPath, documents) {
  try {
    const projectRoot = dirname(specdevPath)
    const calls = listGuidedCalls(projectRoot, 'discussion-lifecycle')
    const folders = new Map(
      documents
        .filter((doc) => doc.kind === 'discussion_artifact')
        .map((doc) => [discussionIdFromPath(doc.path), doc.path.split('/')[1]])
        .filter(([id, folder]) => id && folder)
    )
    const completed = new Set()
    for (const call of calls.calls.filter((candidate) => candidate.status === 'completed')) {
      const folder = folders.get(call.id)
      if (!folder) continue
      const state = readGuidedCall(projectRoot, call.id).state
      const manifest = await discussionArtifactManifest(join(specdevPath, 'discussions', folder))
      if (discussionArtifactCompletionMatches(state.output, manifest)) completed.add(call.id)
    }
    return completed
  } catch {
    return new Set()
  }
}

function discussionIdFromPath(path) {
  if (!String(path).startsWith('discussions/')) return null
  return (
    String(path)
      .split('/')[1]
      ?.match(/^(D\d{4,5})_/)?.[1] || null
  )
}
