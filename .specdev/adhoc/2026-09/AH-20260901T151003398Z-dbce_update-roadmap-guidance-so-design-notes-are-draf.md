# Adhoc AH-20260901T151003398Z-dbce

- Scope: Update Roadmap guidance so design notes are drafted as *_draft.md, reported by path only, and promoted to final .md after user approval
- Title: roadmap draft promotion workflow
- Started: 2026-09-01T15:10:03.398Z
- Completed: 2026-09-01T15:12:01.382Z
- Starting working tree: Clean.

## Outcome

Roadmap design-note guidance now uses a draft-to-final flow: write *_draft.md, report only the draft path, promote to final .md after user approval, and report only the final path.

## Delivery path facts

### Requested adopted paths

None.

### Committed paths

- `.claude/skills/specdev-roadmap/SKILL.md`
- `.codex/skills/specdev-roadmap/SKILL.md`
- `.specdev/_guides/workflow.md`
- `.specdev/_main.md`
- `.specdev/adhoc/2026-09/AH-20260901T151003398Z-dbce_update-roadmap-guidance-so-design-notes-are-draf.md`
- `.specdev/skills/README.md`
- `src/commands/init.js`
- `src/commands/roadmap.js`
- `templates/.specdev/_guides/workflow.md`
- `templates/.specdev/_main.md`
- `templates/.specdev/skills/README.md`
- `tests/test-init-platform.js`

### Rejected paths

None.

### Remaining owned paths

None.

## Verification summary

git diff --check passed; ./bin/specdev.js roadmap --json reports the draft-to-final presentation rule; stale path-only direct-write wording was not found in active product guidance. Tests were updated but not run because test execution requires explicit user approval.

## Verification attempt history

No structured verification attempts were recorded.

## Current acceptance evidence

No structured acceptance evidence was recorded.

## Structured verification

    {
      "version": 1,
      "path_facts": {
        "requested": [],
        "committed": [
          ".claude/skills/specdev-roadmap/SKILL.md",
          ".codex/skills/specdev-roadmap/SKILL.md",
          ".specdev/_guides/workflow.md",
          ".specdev/_main.md",
          ".specdev/adhoc/2026-09/AH-20260901T151003398Z-dbce_update-roadmap-guidance-so-design-notes-are-draf.md",
          ".specdev/skills/README.md",
          "src/commands/init.js",
          "src/commands/roadmap.js",
          "templates/.specdev/_guides/workflow.md",
          "templates/.specdev/_main.md",
          "templates/.specdev/skills/README.md",
          "tests/test-init-platform.js"
        ],
        "rejected": [],
        "remaining": []
      },
      "attempt_history": [],
      "acceptance_evidence": []
    }
