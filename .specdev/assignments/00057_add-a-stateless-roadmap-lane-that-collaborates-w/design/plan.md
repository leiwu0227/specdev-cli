# Implementation plan

Fresh knowledge search: `specdev knowledge search 'roadmap stateless lane scaffold preservation'`.
Relevant current-authority lead read: `.specdev/project_notes/upgrade.md` (selective
scaffolding and project-owned update preservation). No parent-selected Mission
knowledge paths were supplied. Current source and templates remain authoritative.

**Implementation Guides:** []

**Review Guides:** []

## Tasks

1. **T-1 — Add the stateless Roadmap command and installed lane protocol**
   (AC-1, AC-3). Register `specdev roadmap`, provide human and JSON output that
   names the three allowed Markdown paths and the approval/read-only/stateless
   boundaries, add the generated `specdev-roadmap` command skill, and expose the
   lane in help, adapters, and installed workflow/index guidance.
2. **T-2 — Add and preserve the fixed roadmap scaffold** (AC-2). Add the three
   project-note template files for fresh initialization and extend selective
   update backfill so missing roadmap files are created without overwriting or
   migrating existing roadmap bytes, including the legacy singular filename.
3. **T-3 — Add focused maintained command-level regression coverage** (AC-1,
   AC-2, AC-3). Extend the existing init/platform coverage to prove command
   discovery, protocol installation, the exact scaffold, update preservation,
   and the absence of Roadmap-specific workflow, ID, receipt, history, commit,
   or out-of-layout filesystem effects.
4. **T-4 — Qualify the candidate and finish delivery receipts** (AC-1, AC-2,
   AC-3). Inspect the focused diff and non-test structural checks, run only the
   smallest relevant test after repository-required user confirmation, then
   record exact verification status and the concise acceptance outcome.
