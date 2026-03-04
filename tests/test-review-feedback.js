// tests/test-review-feedback.js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseReviewFeedback, getLatestRound, hasUnaddressedFindings } from '../src/utils/review-feedback.js'

describe('parseReviewFeedback', () => {
  it('returns empty result for null/empty content', () => {
    assert.deepStrictEqual(parseReviewFeedback(''), { rounds: [] })
    assert.deepStrictEqual(parseReviewFeedback(null), { rounds: [] })
    assert.deepStrictEqual(parseReviewFeedback(undefined), { rounds: [] })
  })

  it('parses single round with needs-changes', () => {
    const content = `## Round 1\n\n**Verdict:** needs-changes\n\n### Findings\n1. [F1.1] Missing tests\n2. [F1.2] Bad naming\n\n### Addressed from changelog\n- (none — first round)\n`
    const result = parseReviewFeedback(content)
    assert.equal(result.rounds.length, 1)
    assert.equal(result.rounds[0].round, 1)
    assert.equal(result.rounds[0].verdict, 'needs-changes')
    assert.equal(result.rounds[0].findings.length, 2)
    assert.match(result.rounds[0].findings[0], /F1\.1/)
    assert.match(result.rounds[0].findings[1], /F1\.2/)
  })

  it('parses single round with approved verdict', () => {
    const content = `## Round 1\n\n**Verdict:** approved\n\n### Findings\n- (none)\n`
    const result = parseReviewFeedback(content)
    assert.equal(result.rounds.length, 1)
    assert.equal(result.rounds[0].verdict, 'approved')
    assert.equal(result.rounds[0].findings.length, 0)
  })

  it('parses multiple rounds', () => {
    const content = `## Round 1\n\n**Verdict:** needs-changes\n\n### Findings\n1. [F1.1] Fix X\n\n### Addressed from changelog\n- (none — first round)\n\n## Round 2\n\n**Verdict:** approved\n\n### Findings\n- (none)\n\n### Addressed from changelog\n- [F1.1] ✓ Fixed X\n`
    const result = parseReviewFeedback(content)
    assert.equal(result.rounds.length, 2)
    assert.equal(result.rounds[0].round, 1)
    assert.equal(result.rounds[0].verdict, 'needs-changes')
    assert.equal(result.rounds[0].findings.length, 1)
    assert.equal(result.rounds[1].round, 2)
    assert.equal(result.rounds[1].verdict, 'approved')
    assert.equal(result.rounds[1].findings.length, 0)
    assert.equal(result.rounds[1].addressed.length, 1)
    assert.match(result.rounds[1].addressed[0], /F1\.1/)
  })

  it('parses addressed items correctly', () => {
    const content = `## Round 2\n\n**Verdict:** approved\n\n### Findings\n- (none)\n\n### Addressed from changelog\n- [F1.1] ✓ proposal.md now complete\n- [F1.2] ✓ rename scope clarified\n`
    const result = parseReviewFeedback(content)
    assert.equal(result.rounds[0].addressed.length, 2)
    assert.match(result.rounds[0].addressed[0], /F1\.1/)
    assert.match(result.rounds[0].addressed[1], /F1\.2/)
  })
})

describe('getLatestRound', () => {
  it('returns null for empty content', () => {
    assert.equal(getLatestRound(''), null)
    assert.equal(getLatestRound(null), null)
    assert.equal(getLatestRound(undefined), null)
  })

  it('returns latest round data', () => {
    const content = `## Round 1\n\n**Verdict:** needs-changes\n\n### Findings\n1. [F1.1] Fix X\n`
    const latest = getLatestRound(content)
    assert.equal(latest.round, 1)
    assert.equal(latest.verdict, 'needs-changes')
  })

  it('returns the last round when multiple exist', () => {
    const content = `## Round 1\n\n**Verdict:** needs-changes\n\n### Findings\n1. [F1.1] Fix X\n\n## Round 2\n\n**Verdict:** approved\n\n### Findings\n- (none)\n`
    const latest = getLatestRound(content)
    assert.equal(latest.round, 2)
    assert.equal(latest.verdict, 'approved')
  })
})

describe('hasUnaddressedFindings', () => {
  it('returns false when no feedback file content', () => {
    assert.equal(hasUnaddressedFindings('', ''), false)
    assert.equal(hasUnaddressedFindings(null, null), false)
    assert.equal(hasUnaddressedFindings(undefined, ''), false)
  })

  it('returns true when latest verdict is needs-changes and no changelog entry', () => {
    const feedback = `## Round 1\n\n**Verdict:** needs-changes\n\n### Findings\n1. [F1.1] Fix X\n`
    assert.equal(hasUnaddressedFindings(feedback, ''), true)
    assert.equal(hasUnaddressedFindings(feedback, null), true)
  })

  it('returns false when latest verdict is needs-changes but changelog has matching round', () => {
    const feedback = `## Round 1\n\n**Verdict:** needs-changes\n\n### Findings\n1. [F1.1] Fix X\n`
    const changelog = `## Round 1\n\n### Changes\n1. [F1.1] Fixed X\n`
    assert.equal(hasUnaddressedFindings(feedback, changelog), false)
  })

  it('returns false when latest verdict is approved', () => {
    const feedback = `## Round 1\n\n**Verdict:** approved\n\n### Findings\n- (none)\n`
    assert.equal(hasUnaddressedFindings(feedback, ''), false)
  })

  it('checks against the latest round number', () => {
    const feedback = `## Round 1\n\n**Verdict:** needs-changes\n\n### Findings\n1. [F1.1] Fix X\n\n## Round 2\n\n**Verdict:** needs-changes\n\n### Findings\n1. [F2.1] Fix Y\n`
    // Changelog has Round 1 but not Round 2
    const changelog = `## Round 1\n\n### Changes\n1. [F1.1] Fixed X\n`
    assert.equal(hasUnaddressedFindings(feedback, changelog), true)
    // Changelog has Round 2
    const changelog2 = `## Round 1\n\n### Changes\n1. [F1.1] Fixed X\n\n## Round 2\n\n### Changes\n1. [F2.1] Fixed Y\n`
    assert.equal(hasUnaddressedFindings(feedback, changelog2), false)
  })
})
