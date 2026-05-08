import { createHash } from 'node:crypto'
import { basename, dirname, join, relative, sep } from 'node:path'
import fse from 'fs-extra'

export const KNOWLEDGE_DB_RELATIVE_PATH = '.specdev/cache/knowledge.sqlite'

const INDEXED_MARKDOWN_ROOTS = [
  'project_notes',
  'knowledge',
  'assignments',
  'discussions',
  '_guides',
  'skills',
]

export async function buildKnowledgeIndex(specdevPath) {
  const sqlite = await loadSqlite()
  const dbPath = join(specdevPath, 'cache', 'knowledge.sqlite')
  await fse.ensureDir(dirname(dbPath))
  await fse.remove(dbPath)

  const db = new sqlite.DatabaseSync(dbPath)
  try {
    initializeSchema(db)
    const documents = await collectKnowledgeDocuments(specdevPath)
    const insertDocument = db.prepare(`
      INSERT INTO documents (
        path, kind, assignment_id, phase, title, content, content_hash, mtime_ms, indexed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertFts = db.prepare(`
      INSERT INTO documents_fts (document_id, title, content, path, kind, assignment_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    const indexedAt = new Date().toISOString()

    db.exec('BEGIN')
    for (const doc of documents) {
      const result = insertDocument.run(
        doc.path,
        doc.kind,
        doc.assignmentId,
        doc.phase,
        doc.title,
        doc.content,
        hashContent(doc.content),
        doc.mtimeMs,
        indexedAt
      )
      const documentId = Number(result.lastInsertRowid)
      insertFts.run(documentId, doc.title, doc.content, doc.path, doc.kind, doc.assignmentId)
    }
    db.exec('COMMIT')

    return {
      databasePath: KNOWLEDGE_DB_RELATIVE_PATH,
      documentCount: documents.length,
    }
  } catch (error) {
    try {
      db.exec('ROLLBACK')
    } catch {
      // Ignore rollback failures when no transaction is active.
    }
    throw error
  } finally {
    db.close()
  }
}

export async function searchKnowledgeIndex(specdevPath, query, options = {}) {
  const dbPath = join(specdevPath, 'cache', 'knowledge.sqlite')
  if (!(await fse.pathExists(dbPath))) {
    const error = new Error('Knowledge index not found. Run: specdev knowledge index')
    error.code = 'KNOWLEDGE_INDEX_MISSING'
    throw error
  }

  const sqlite = await loadSqlite()
  const db = new sqlite.DatabaseSync(dbPath, { readOnly: true })
  try {
    const limit = Number.isInteger(options.limit) ? options.limit : 10
    const rows = db.prepare(`
      SELECT
        d.path,
        d.kind,
        d.assignment_id AS assignment_id,
        d.phase,
        d.title,
        snippet(documents_fts, 2, '[', ']', ' ... ', 24) AS snippet,
        bm25(documents_fts) AS score
      FROM documents_fts
      JOIN documents d ON d.id = documents_fts.document_id
      WHERE documents_fts MATCH ?
      ORDER BY score
      LIMIT ?
    `).all(query, limit)

    return rows.map((row) => ({
      path: row.path,
      kind: row.kind,
      assignment_id: row.assignment_id,
      phase: row.phase,
      title: row.title,
      snippet: normalizeWhitespace(row.snippet),
      score: row.score,
    }))
  } finally {
    db.close()
  }
}

export async function collectKnowledgeDocuments(specdevPath) {
  const files = []
  for (const root of INDEXED_MARKDOWN_ROOTS) {
    const absRoot = join(specdevPath, root)
    if (!(await fse.pathExists(absRoot))) continue
    await collectMarkdownFiles(absRoot, files)
  }

  const documents = []
  for (const file of files.sort((a, b) => a.localeCompare(b))) {
    const content = await fse.readFile(file, 'utf-8')
    const stat = await fse.stat(file)
    const relPath = toSpecdevRelativePath(specdevPath, file)
    documents.push({
      path: relPath,
      content,
      title: extractTitle(content, file),
      mtimeMs: Math.trunc(stat.mtimeMs),
      ...classifyDocument(relPath),
    })
  }
  return documents
}

async function loadSqlite() {
  const originalEmitWarning = process.emitWarning
  try {
    process.emitWarning = function suppressSqliteExperimentalWarning(warning, ...args) {
      const message = typeof warning === 'string' ? warning : warning?.message
      if (String(message || '').includes('SQLite is an experimental feature')) return
      return originalEmitWarning.call(process, warning, ...args)
    }
    return await import('node:sqlite')
  } catch {
    const error = new Error('SQLite support is unavailable in this Node.js runtime. Use a Node version that provides node:sqlite.')
    error.code = 'SQLITE_UNAVAILABLE'
    throw error
  } finally {
    process.emitWarning = originalEmitWarning
  }
}

function initializeSchema(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE documents (
      id INTEGER PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      assignment_id TEXT,
      phase TEXT,
      title TEXT,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      mtime_ms INTEGER NOT NULL,
      indexed_at TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE documents_fts USING fts5(
      document_id UNINDEXED,
      title,
      content,
      path,
      kind,
      assignment_id
    );
  `)
}

async function collectMarkdownFiles(dir, files) {
  const entries = await fse.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const absPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'cache') continue
      await collectMarkdownFiles(absPath, files)
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(absPath)
    }
  }
}

function classifyDocument(relPath) {
  const parts = relPath.split('/')
  if (parts[0] === 'project_notes') {
    return { kind: kindFromProjectNote(parts[1]), assignmentId: null, phase: null }
  }
  if (parts[0] === 'knowledge') {
    return {
      kind: parts[1] === '_workflow_feedback' ? 'workflow_feedback' : 'knowledge_note',
      assignmentId: null,
      phase: parts[1] || null,
    }
  }
  if (parts[0] === 'assignments') {
    return {
      kind: kindFromAssignmentPath(parts),
      assignmentId: parts[1] || null,
      phase: parts[2] || null,
    }
  }
  if (parts[0] === 'discussions') {
    return {
      kind: kindFromDiscussionPath(parts),
      assignmentId: parts[1] || null,
      phase: parts[2] || null,
    }
  }
  if (parts[0] === '_guides') {
    return { kind: 'guide', assignmentId: null, phase: null }
  }
  if (parts[0] === 'skills') {
    return { kind: 'skill', assignmentId: null, phase: null }
  }
  return { kind: 'markdown', assignmentId: null, phase: null }
}

function kindFromProjectNote(fileName = '') {
  if (fileName === 'big_picture.md') return 'big_picture'
  if (fileName === 'working_memory.md') return 'working_memory'
  if (fileName === 'feature_descriptions.md') return 'feature_description'
  return 'project_note'
}

function kindFromAssignmentPath(parts) {
  const phase = parts[2]
  const fileName = parts[3]
  if (phase === 'brainstorm' && fileName === 'proposal.md') return 'assignment_proposal'
  if (phase === 'brainstorm' && fileName === 'design.md') return 'assignment_design'
  if (phase === 'breakdown' && fileName === 'plan.md') return 'assignment_plan'
  if (phase === 'capture' && fileName === 'project-notes-diff.md') return 'assignment_capture_project'
  if (phase === 'capture' && fileName === 'workflow-diff.md') return 'assignment_capture_workflow'
  return 'assignment_artifact'
}

function kindFromDiscussionPath(parts) {
  const phase = parts[2]
  const fileName = parts[3]
  if (phase === 'brainstorm' && fileName === 'proposal.md') return 'discussion_proposal'
  if (phase === 'brainstorm' && fileName === 'design.md') return 'discussion_design'
  return 'discussion_artifact'
}

function extractTitle(content, file) {
  const heading = content.match(/^#\s+(.+)$/m)
  return heading ? heading[1].trim() : basename(file, '.md')
}

function hashContent(content) {
  return createHash('sha256').update(content).digest('hex')
}

function toSpecdevRelativePath(specdevPath, file) {
  return relative(specdevPath, file).split(sep).join('/')
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}
