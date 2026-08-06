# Implementation plan

## Guides

**Implementation Guides:** []

**Review Guides:** []

The available frontend and API-security guides do not apply to this local Node.js CLI lifecycle, Git classification, generated Markdown guidance, or command-evidence storage change.

## Tasks

1. **T-1 — Make Adhoc worktree decisions explicit and stable (AC-1, AC-4).** Add a versioned product-versus-concurrent-workflow classification shared by start, finish, and human/JSON rendering; persist the start decision; preserve callable artifacts outside staging; and expand successful and recovered finish payloads with commit, subject, committed paths, verification, remaining-path classifications, and product cleanliness.
2. **T-2 — Capture structured verification attempts (AC-3, AC-4).** Add `adhoc verify --label="..." [--annotation="..."] -- <command>` with direct argv execution, bounded output, duration/exit status/revision capture, atomic active-state persistence, failed-attempt history, latest-per-label acceptance evidence, legacy `--verification` compatibility, and readable receipt sections.
3. **T-3 — Improve subjects and generated operator guidance (AC-2, AC-5).** Support an independent `start --title`, derive default subjects at readable word or clause boundaries, document a single executable launcher resolver, revise Adhoc and installed workflow instructions around explicit classification/repeated runs, and define announcements at meaningful phase or plan-change boundaries.
4. **T-4 — Add focused regression evidence and delivery receipts (AC-1, AC-2, AC-3, AC-4, AC-5).** Extend the existing command-level Adhoc fixture and targeted generation assertions, perform authorized non-test static checks, request repository-required approval before running any focused tests, then record exact verification receipts, deviations, and acceptance outcomes.
