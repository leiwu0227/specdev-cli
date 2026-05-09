# Review: 00014_feature_agent-friendly-workflow — Brainstorm

## Round 1

**Verdict:** approved

### Findings

1. [F1.1] **Goal/scope mismatch: "every command" vs. 12 commands.** The design goal says "Every command accepts `--json` and returns structured output" and the proposal says "Universal `--json` flag across all 12 commands that currently lack it." However, at least 16 commands lack `--json` today — `init`, `start`, `distill`, and `distill done` are not covered in any tier. The design should either narrow the goal statement to match the tiers or add the missing commands. Low severity since some omissions may be intentional (interactive setup commands), but the stated goal is misleading.

2. [F1.2] **`context` skill-listing needs utility extraction or clarification.** The design says `context.js` will use "skills --json logic for skill inventory," but `loadSkills()` in `src/commands/skills.js:81` is a private function. The underlying utility `scanSkillsDir()` is exported from `src/utils/skills.js` and could be called directly, but the design should clarify this implementation path rather than vaguely referencing "skills --json logic." Minor — the utility exists, the design just doesn't name it precisely.

3. [F1.3] **`knowledge list` uses "branch" — not a codebase concept.** The design proposes a `"branch"` field in the `knowledge list` JSON output for the knowledge sub-directory (e.g., `architecture`, `workflow_feedback`). But `classifyDocument()` in `src/utils/knowledge.js:195` returns `kind` and `phase` for this value — "branch" is a new term not used elsewhere. Consider `category` or `kind` for consistency with existing code, or document the intentional divergence.

### Addressed from changelog
- (none -- first round)

## Round 2

**Verdict:** needs-changes

### Findings
1. [F2.1] **Universal `--json` goal still does not match the command list.** The proposal says "machine-readable output across all commands" and the design success criteria say "Every specdev command accepts `--json`", but the tier list still excludes commands present in `src/utils/commands.js`: `init`, `start`, `memory refresh`, `knowledge index`, `knowledge search`, `assignment`, `checkpoint`, `continue`, `status`, `check-review`, `reviewloop`, `distill`, `distill done`, `discussion`, and `version`. Some already support JSON and some may intentionally stay prose-only, but the design should explicitly separate "already covered", "newly covered", and "intentionally excluded" commands. As written, the success criteria are not testable against the actual command surface.
2. [F2.2] **`knowledge list` implementation guidance points at the wrong abstraction.** The design says to "Reuse `collectKnowledgeDocuments()` from `src/utils/knowledge.js` for file discovery", but that utility indexes `project_notes`, `knowledge`, `assignments`, `discussions`, `_guides`, and `skills`; it also classifies documents as `{ kind, assignmentId, phase }`, not `{ branch }`. The proposed `knowledge list` payload is specifically an inventory of `.specdev/knowledge/<branch>/*.md`, so the design should either specify filtering `collectKnowledgeDocuments()` down to knowledge paths and mapping `phase` to the exposed field, or state that `knowledge list` scans the knowledge branches directly.
3. [F2.3] **Hook wording conflates available knowledge files with indexed documents.** The session hook design says to inject "N knowledge files indexed", while `context --json` has two different concepts: `knowledge.files` for files discovered under `.specdev/knowledge/`, and `indexed_document_count` for the SQLite index. Since the search index covers more than knowledge files and may be stale or absent, the design should use precise wording like "N knowledge files available" plus separate index status, or use `indexed_document_count` when claiming documents are indexed.

### Addressed from changelog
- No changelog was present for round 2.
