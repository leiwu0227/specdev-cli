import { parse } from 'yaml'

const REVIEWER_VERDICTS = new Set(['approved', 'needs_changes', 'blocked'])
const WORKER_STATUSES = new Set(['completed', 'blocked'])

export function parseResultEnvelope(markdown, kind) {
  const content = String(markdown || '').trim()
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) throw new Error('agent result must start with YAML frontmatter')

  let frontmatter
  try {
    frontmatter = parse(match[1])
  } catch (error) {
    throw new Error(`invalid agent result frontmatter: ${error.message}`)
  }
  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    throw new Error('agent result frontmatter must be a mapping')
  }

  if (kind === 'reviewer') validateReviewerResult(frontmatter, content)
  else if (kind === 'worker') validateWorkerResult(frontmatter, content)
  else throw new Error(`unknown result envelope kind: ${kind}`)

  return { frontmatter, markdown: `${content}\n` }
}

function validateReviewerResult(result, content) {
  if (!REVIEWER_VERDICTS.has(result.verdict)) {
    throw new Error('reviewer verdict must be approved, needs_changes, or blocked')
  }
  if (result.material_divergence !== undefined && typeof result.material_divergence !== 'boolean') {
    throw new Error('reviewer material_divergence must be true or false')
  }
  requireSection(content, 'Findings')
}

function validateWorkerResult(result, content) {
  if (!WORKER_STATUSES.has(result.status)) {
    throw new Error('worker status must be completed or blocked')
  }
  if (result.follow_up !== undefined && !['none', 'required'].includes(result.follow_up)) {
    throw new Error('worker follow_up must be none or required')
  }
  requireSection(content, 'Changes')
}

function requireSection(content, heading) {
  if (!new RegExp(`^##\\s+${heading}\\s*$`, 'm').test(content)) {
    throw new Error(`agent result is missing ## ${heading}`)
  }
}
