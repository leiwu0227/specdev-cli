// src/utils/review-feedback.js

/**
 * Parse append-only review-feedback.md into structured rounds.
 * Each round has: { round, verdict, findings[], addressed[] }
 */
export function parseReviewFeedback(content) {
  if (!content || !content.trim()) return { rounds: [] }

  const rounds = []
  const roundSections = content.split(/^## Round /m).filter(Boolean)

  for (const section of roundSections) {
    const roundMatch = section.match(/^(\d+)/)
    if (!roundMatch) continue

    const round = parseInt(roundMatch[1], 10)
    const verdictMatch = section.match(/\*\*Verdict:\*\*\s*(.+)/i)
    const verdict = verdictMatch ? verdictMatch[1].trim().toLowerCase() : 'unknown'

    const findingsMatch = section.match(/### Findings\s*\n([\s\S]*?)(?=\n### |\n## |$)/i)
    const findings = extractBullets(findingsMatch ? findingsMatch[1] : '')

    const addressedMatch = section.match(/### Addressed from changelog\s*\n([\s\S]*?)(?=\n### |\n## |$)/i)
    const addressed = extractBullets(addressedMatch ? addressedMatch[1] : '')

    rounds.push({ round, verdict, findings, addressed })
  }

  return { rounds }
}

/**
 * Get the latest round from review-feedback.md content.
 * Returns null if no rounds found.
 */
export function getLatestRound(content) {
  const { rounds } = parseReviewFeedback(content)
  return rounds.length > 0 ? rounds[rounds.length - 1] : null
}

/**
 * Check if the latest round has needs-changes verdict without a matching
 * changelog entry. Used as a stale feedback guard.
 */
export function hasUnaddressedFindings(feedbackContent, changelogContent) {
  const latest = getLatestRound(feedbackContent)
  if (!latest || latest.verdict !== 'needs-changes') return false

  // Check if changelog has a matching ## Round N entry
  const changelogRoundPattern = new RegExp(`^## Round ${latest.round}\\b`, 'm')
  return !changelogRoundPattern.test(changelogContent || '')
}

function extractBullets(text) {
  const items = []
  for (const line of text.split('\n')) {
    if (!/^\s*[-*\d][\s.)]+/.test(line)) continue
    const trimmed = line.replace(/^\s*[-*\d][\s.)]+/, '').trim()
    if (trimmed && !trimmed.match(/^\(none/i)) {
      items.push(trimmed)
    }
  }
  return items
}
