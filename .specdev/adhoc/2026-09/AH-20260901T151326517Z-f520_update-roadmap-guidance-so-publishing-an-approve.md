# Adhoc AH-20260901T151326517Z-f520

- Scope: Update Roadmap guidance so publishing an approved design note automatically creates a commit
- Title: roadmap publish auto commit
- Started: 2026-09-01T15:13:26.517Z
- Completed: 2026-09-01T15:15:05.896Z
- Starting working tree: Clean.

## Outcome

Roadmap guidance now requires an automatic Git commit when an approved design-note draft is promoted and published.

## Delivery path facts

### Requested adopted paths

None.

### Committed paths

- `.claude/skills/specdev-roadmap/SKILL.md`
- `.codex/skills/specdev-roadmap/SKILL.md`
- `.specdev/_guides/workflow.md`
- `.specdev/_main.md`
- `.specdev/adhoc/2026-09/AH-20260901T151326517Z-f520_update-roadmap-guidance-so-publishing-an-approve.md`
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

git diff --check passed; ./bin/specdev.js roadmap --json reports that published design-note changes are committed after user approval; stale Roadmap no-automatic-commit wording was not found in active guidance. Tests were updated but not run because test execution requires explicit user approval.

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
          ".specdev/adhoc/2026-09/AH-20260901T151326517Z-f520_update-roadmap-guidance-so-publishing-an-approve.md",
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
