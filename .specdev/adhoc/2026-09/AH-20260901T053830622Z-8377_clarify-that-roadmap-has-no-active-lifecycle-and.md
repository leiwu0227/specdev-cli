# Adhoc AH-20260901T053830622Z-8377

- Scope: Clarify that Roadmap has no active lifecycle and is immediately superseded when the user selects another lane, without an exit command or state transition
- Title: clarify roadmap lane supersession
- Started: 2026-09-01T05:38:30.622Z
- Completed: 2026-09-01T05:39:37.856Z
- Starting working tree: Clean.

## Outcome

Clarified that Roadmap has no active lifecycle and is immediately superseded when the user selects another lane, with no exit command or state transition.

## Delivery path facts

### Requested adopted paths

None.

### Committed paths

- `.claude/hooks/specdev-session-start.sh`
- `.claude/skills/specdev-roadmap/SKILL.md`
- `.codex/skills/specdev-roadmap/SKILL.md`
- `.specdev/adhoc/2026-09/AH-20260901T053830622Z-8377_clarify-that-roadmap-has-no-active-lifecycle-and.md`
- `hooks/session-start.sh`
- `src/commands/init.js`
- `templates/.specdev/_guides/workflow.md`
- `templates/.specdev/_main.md`
- `templates/.specdev/skills/README.md`
- `tests/test-init-platform.js`

### Rejected paths

None.

### Remaining owned paths

None.

## Verification summary

git diff --check passed; canonical skill, generated host copies, workflow guidance, hooks, and focused assertions were synchronized. The focused test was not run because test approval was not granted.

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
          ".claude/hooks/specdev-session-start.sh",
          ".claude/skills/specdev-roadmap/SKILL.md",
          ".codex/skills/specdev-roadmap/SKILL.md",
          ".specdev/adhoc/2026-09/AH-20260901T053830622Z-8377_clarify-that-roadmap-has-no-active-lifecycle-and.md",
          "hooks/session-start.sh",
          "src/commands/init.js",
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
