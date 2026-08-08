import { parse } from 'yaml'

const REVIEWER_VERDICTS = new Set(['approved', 'needs_changes', 'blocked'])
const WORKER_STATUSES = new Set(['completed', 'blocked'])
const RESULT_CONTRACTS = Object.freeze({
  reviewer: Object.freeze({
    allowedKeys: new Set([
      'verdict',
      'material_divergence',
      'scope_divergence',
      'procedure_divergence',
      'evidence_integrity',
      'user_reapproval_required',
    ]),
    requiredKeys: ['verdict', 'material_divergence'],
    section: 'Findings',
    instructions: [
      'Choose exactly one verdict: approved, needs_changes, or blocked.',
      'Set material_divergence to exactly true or false.',
      'Set scope_divergence to none, clarifying, or material; procedure_divergence to none, disclosed, or material; evidence_integrity to complete, incomplete, or changed; and user_reapproval_required to true or false.',
      'The example below is valid YAML. Replace its values; do not copy a list of alternatives.',
    ],
    template: `---
verdict: approved
material_divergence: false
scope_divergence: none
procedure_divergence: none
evidence_integrity: complete
user_reapproval_required: false
---

## Findings

No blocking findings.`,
    fallback: `---
verdict: blocked
material_divergence: false
---

## Findings

The original review did not state every required semantic value unambiguously, so no workflow transition is authorized.`,
  }),
  worker: Object.freeze({
    allowedKeys: new Set(['status', 'revision', 'follow_up']),
    requiredKeys: ['status', 'follow_up'],
    section: 'Changes',
    instructions: [
      'Choose exactly one status: completed or blocked.',
      'Set follow_up to exactly none or required.',
      'revision is optional; when present it must be a Git revision, working-tree@HEAD value, or null.',
      'The example below is valid YAML. Replace its values; do not copy a list of alternatives.',
    ],
    template: `---
status: completed
revision: null
follow_up: none
---

## Changes

Concise completed changes and evidence.`,
    fallback: `---
status: blocked
revision: null
follow_up: required
---

## Changes

The original result did not state every required semantic value unambiguously, so completion is not authorized.`,
  }),
})

export function resultEnvelopeInstructions(kind) {
  const contract = resultContract(kind)
  return [
    'The first byte of the result must be the first `-` in the YAML frontmatter below.',
    'Return no preamble, explanation, or Markdown code fence around the result.',
    ...contract.instructions,
    `Use only these frontmatter keys: ${[...contract.allowedKeys].join(', ')}.`,
    `The ## ${contract.section} section must contain meaningful text.`,
    '',
    contract.template,
  ].join('\n')
}

export function resultEnvelopeBlockedFallback(kind) {
  return resultContract(kind).fallback
}

export function parseResultEnvelope(markdown, kind) {
  const content = String(markdown || '').trimEnd()
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

  validateFrontmatterShape(frontmatter, kind)

  if (kind === 'reviewer') validateReviewerResult(frontmatter, content)
  else if (kind === 'worker') validateWorkerResult(frontmatter, content)
  else throw new Error(`unknown result envelope kind: ${kind}`)

  return { frontmatter, markdown: `${content}\n` }
}

function validateReviewerResult(result, content) {
  if (!REVIEWER_VERDICTS.has(result.verdict)) {
    throw new Error('reviewer verdict must be approved, needs_changes, or blocked')
  }
  if (typeof result.material_divergence !== 'boolean') {
    throw new Error('reviewer material_divergence must be true or false')
  }
  const structuredKeys = [
    'scope_divergence',
    'procedure_divergence',
    'evidence_integrity',
    'user_reapproval_required',
  ]
  const present = structuredKeys.filter((key) => Object.hasOwn(result, key))
  if (present.length > 0 && present.length !== structuredKeys.length) {
    throw new Error('reviewer structured divergence fields must be supplied together')
  }
  if (present.length > 0) {
    if (!['none', 'clarifying', 'material'].includes(result.scope_divergence)) {
      throw new Error('reviewer scope_divergence must be none, clarifying, or material')
    }
    if (!['none', 'disclosed', 'material'].includes(result.procedure_divergence)) {
      throw new Error('reviewer procedure_divergence must be none, disclosed, or material')
    }
    if (!['complete', 'incomplete', 'changed'].includes(result.evidence_integrity)) {
      throw new Error('reviewer evidence_integrity must be complete, incomplete, or changed')
    }
    if (typeof result.user_reapproval_required !== 'boolean') {
      throw new Error('reviewer user_reapproval_required must be true or false')
    }
    const projectedMaterial =
      result.scope_divergence === 'material' ||
      result.procedure_divergence === 'material' ||
      result.user_reapproval_required
    if (result.material_divergence !== projectedMaterial) {
      throw new Error('reviewer material_divergence does not match the structured projection')
    }
  } else {
    result.scope_divergence = result.material_divergence ? 'material' : 'none'
    result.procedure_divergence = 'none'
    result.evidence_integrity = 'complete'
    result.user_reapproval_required = result.material_divergence
    result.taxonomy_source = 'legacy_projection'
  }
  requireSectionContent(content, 'Findings')
}

function validateWorkerResult(result, content) {
  if (!WORKER_STATUSES.has(result.status)) {
    throw new Error('worker status must be completed or blocked')
  }
  if (!['none', 'required'].includes(result.follow_up)) {
    throw new Error('worker follow_up must be none or required')
  }
  if (
    result.revision !== undefined &&
    result.revision !== null &&
    (typeof result.revision !== 'string' || !result.revision.trim())
  ) {
    throw new Error('worker revision must be a non-empty string or null')
  }
  requireSectionContent(content, 'Changes')
}

function validateFrontmatterShape(frontmatter, kind) {
  const contract = resultContract(kind)
  for (const key of contract.requiredKeys) {
    if (!Object.hasOwn(frontmatter, key)) {
      throw new Error(`${kind} frontmatter is missing required key: ${key}`)
    }
  }
  const unknown = Object.keys(frontmatter).filter((key) => !contract.allowedKeys.has(key))
  if (unknown.length > 0) {
    throw new Error(
      `${kind} frontmatter has unknown key${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}`
    )
  }
}

function requireSectionContent(content, heading) {
  const headingMatch = new RegExp(`^##\\s+${heading}\\s*$`, 'm').exec(content)
  if (!headingMatch) {
    throw new Error(`agent result is missing ## ${heading}`)
  }
  const sectionStart = headingMatch.index + headingMatch[0].length
  const remainder = content.slice(sectionStart).replace(/^\r?\n/, '')
  const nextSection = /^##\s+/m.exec(remainder)
  const body = (nextSection ? remainder.slice(0, nextSection.index) : remainder).trim()
  if (!body) throw new Error(`agent result has an empty ## ${heading} section`)
}

function resultContract(kind) {
  const contract = RESULT_CONTRACTS[kind]
  if (!contract) throw new Error(`unknown result envelope kind: ${kind}`)
  return contract
}
