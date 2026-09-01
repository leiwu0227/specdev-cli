# Adhoc AH-20260901T050927374Z-36d2

- Scope: Allow bounded feature/module Roadmap design notes and require every roadmap design Markdown file to stay below 800 words
- Title: constrain roadmap design notes
- Started: 2026-09-01T05:09:27.374Z
- Completed: 2026-09-01T05:12:20.299Z
- Starting working tree: Clean.

## Outcome

Expanded Roadmap design notes to direct designs/*.md with a 799-word maximum and independent minimally overlapping feature/module guidance.

## Delivery path facts

### Requested adopted paths

None.

### Committed paths

- `.claude/hooks/specdev-session-start.sh`
- `.claude/skills/specdev-roadmap/SKILL.md`
- `.codex/skills/specdev-roadmap/SKILL.md`
- `.specdev/adhoc/2026-09/AH-20260901T050927374Z-36d2_allow-bounded-feature-module-roadmap-design-note.md`
- `hooks/session-start.sh`
- `src/commands/init.js`
- `src/commands/roadmap.js`
- `templates/.specdev/_guides/workflow.md`
- `templates/.specdev/_index.md`
- `templates/.specdev/_main.md`
- `templates/.specdev/skills/README.md`
- `tests/test-init-platform.js`

### Rejected paths

None.

### Remaining owned paths

None.

## Verification summary

No manual verification summary was supplied.

## Verification attempt history

- **roadmap-lane: failed.** `node tests/test-init-platform.js` (2170 ms, working-tree@a077906cb0fb01dd71c85f30ffce8ec2624c806e)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 1
  - Output:

    ful-phase announcement guidance
    stdout:   ✓ .codex/specdev-reviewloop tracked host copy matches generated skill prose
    stdout:   ✓ .codex/specdev-reviewloop uses meaningful-phase announcement guidance
    stdout:   ✓ .codex/specdev-rewind tracked host copy matches generated skill prose
    stdout:   ✓ .codex/specdev-rewind uses meaningful-phase announcement guidance
    stderr:   ❌ .codex/specdev-roadmap tracked host copy matches generated skill prose
    stdout:   ✓ .codex/specdev-roadmap uses meaningful-phase announcement guidance
    stdout:   ✓ .codex/specdev-start tracked host copy matches generated skill prose
    stdout:   ✓ .codex/specdev-start uses meaningful-phase announcement guidance
    stdout:   ✓ .codex/specdev-test-audit tracked host copy matches generated skill prose
    stdout:   ✓ .codex/specdev-test-audit uses meaningful-phase announcement guidance
    
    hook installation:
      ✓ .claude/hooks/specdev-session-start.sh exists
    stdout:   ✓ hook script starts with bash shebang
    stdout:   ✓ SessionStart guidance exposes Direct writes and meaningful-phase announcements
    stdout:   ✓ .claude/settings.json exists
    stdout:   ✓ settings.json contains SessionStart hook pointing to specdev script
    stdout: 
    --platform=claude backward compat:
    stdout:   ✓ init with --platform=claude succeeds
    stdout:   ✓ creates CLAUDE.md
      ✓ creates AGENTS.md
      ✓ creates .cursor/rules
    
    hook registration idempotent:
    stdout:   ✓ no duplicate hook entry after re-init with --force
    
    hook merges with existing settings:
    stdout:   ✓ preserves existing permissions key
      ✓ preserves hook registration alongside existing settings
    
    invalid settings preserved:
    stdout:   ✓ re-init succeeds even with invalid settings
    stdout:   ✓ keeps invalid settings file untouched
    
    adapter drift-detection instruction:
    stdout:   ✓ adapter includes "Specdev:" prefix instruction
    
    no-overwrite:
    stdout:   ✓ preserves existing CLAUDE.md content on --force
    stdout:   ✓ preserves existing AGENTS.md content on --force
    stdout:   ✓ preserves existing .cursor/rules content on --force
    stdout: 
    124 passed, 2 failed
- **roadmap-lane: passed.** `node tests/test-init-platform.js` (2251 ms, working-tree@a077906cb0fb01dd71c85f30ffce8ec2624c806e)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 0
  - Output:

    e announcement guidance
    stdout:   ✓ .codex/specdev-reviewloop tracked host copy matches generated skill prose
    stdout:   ✓ .codex/specdev-reviewloop uses meaningful-phase announcement guidance
    stdout:   ✓ .codex/specdev-rewind tracked host copy matches generated skill prose
    stdout:   ✓ .codex/specdev-rewind uses meaningful-phase announcement guidance
    stdout:   ✓ .codex/specdev-roadmap tracked host copy matches generated skill prose
    stdout:   ✓ .codex/specdev-roadmap uses meaningful-phase announcement guidance
    stdout:   ✓ .codex/specdev-start tracked host copy matches generated skill prose
    stdout:   ✓ .codex/specdev-start uses meaningful-phase announcement guidance
    stdout:   ✓ .codex/specdev-test-audit tracked host copy matches generated skill prose
    stdout:   ✓ .codex/specdev-test-audit uses meaningful-phase announcement guidance
    
    hook installation:
    stdout:   ✓ .claude/hooks/specdev-session-start.sh exists
    stdout:   ✓ hook script starts with bash shebang
    stdout:   ✓ SessionStart guidance exposes Direct writes and meaningful-phase announcements
    stdout:   ✓ .claude/settings.json exists
    stdout:   ✓ settings.json contains SessionStart hook pointing to specdev script
    stdout: 
    --platform=claude backward compat:
    stdout:   ✓ init with --platform=claude succeeds
    stdout:   ✓ creates CLAUDE.md
      ✓ creates AGENTS.md
      ✓ creates .cursor/rules
    
    hook registration idempotent:
    stdout:   ✓ no duplicate hook entry after re-init with --force
    
    hook merges with existing settings:
    stdout:   ✓ preserves existing permissions key
      ✓ preserves hook registration alongside existing settings
    
    invalid settings preserved:
    stdout:   ✓ re-init succeeds even with invalid settings
    stdout:   ✓ keeps invalid settings file untouched
    
    adapter drift-detection instruction:
    stdout:   ✓ adapter includes "Specdev:" prefix instruction
    
    no-overwrite:
    stdout:   ✓ preserves existing CLAUDE.md content on --force
    stdout:   ✓ preserves existing AGENTS.md content on --force
    stdout:   ✓ preserves existing .cursor/rules content on --force
    stdout: 
    126 passed, 0 failed

## Current acceptance evidence

- **roadmap-lane: passed.** `node tests/test-init-platform.js` (2251 ms, working-tree@a077906cb0fb01dd71c85f30ffce8ec2624c806e)

## Structured verification

    {
      "version": 1,
      "path_facts": {
        "requested": [],
        "committed": [
          ".claude/hooks/specdev-session-start.sh",
          ".claude/skills/specdev-roadmap/SKILL.md",
          ".codex/skills/specdev-roadmap/SKILL.md",
          ".specdev/adhoc/2026-09/AH-20260901T050927374Z-36d2_allow-bounded-feature-module-roadmap-design-note.md",
          "hooks/session-start.sh",
          "src/commands/init.js",
          "src/commands/roadmap.js",
          "templates/.specdev/_guides/workflow.md",
          "templates/.specdev/_index.md",
          "templates/.specdev/_main.md",
          "templates/.specdev/skills/README.md",
          "tests/test-init-platform.js"
        ],
        "rejected": [],
        "remaining": []
      },
      "attempt_history": [
        {
          "version": 1,
          "id": "V-001",
          "label": "roadmap-lane",
          "annotation": null,
          "command": "node tests/test-init-platform.js",
          "argv": [
            "node",
            "tests/test-init-platform.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-09-01T05:11:15.368Z",
          "completed_at": "2026-09-01T05:11:17.539Z",
          "duration_ms": 2170,
          "exit_status": 1,
          "status": "failed",
          "tested_revision": "working-tree@a077906cb0fb01dd71c85f30ffce8ec2624c806e",
          "output": {
            "text": "stdout: \ndefault init creates all adapters:\nstdout:   ✓ init succeeds\nstdout:   ✓ .specdev created\n  ✓ creates CLAUDE.md\nstdout:   ✓ creates AGENTS.md\nstdout:   ✓ creates .cursor/rules\nstdout:   ✓ init installs the exact roadmap scaffold and command skill\nstdout:   ✓ roadmap reports the stateless exact-path boundary without creating state\nstdout:   ✓ update preserves roadmap bytes and backfills a missing scaffold file\nstdout:   ✓ _main.md uses a repository-root-relative project context path\nstdout:   ✓ _main.md installs the copyable PATH fallback\nstdout:   ✓ _main.md checks workspace launcher executability before use\nstdout:   ✓ _main.md defines phase-level announcement granularity\nstdout:   ✓ _main.md defines Direct documentation eligibility, proportional orientation, and explicit Adhoc routing\nstdout:   ✓ _main.md defines the cross-repository handoff-note ownership boundary\nstdout:   ✓ CLAUDE.md points to _main.md\nstdout:   ✓ AGENTS.md points to _main.md\nstdout:   ✓ AGENTS.md does not inject SpecDev source-repository advice\nstdout:   ✓ .cursor/rules points to _main.md\nstdout:   ✓ CLAUDE.md preserves explicit lane selection and destination-repository re-anchoring\nstdout:   ✓ CLAUDE.md exposes the Direct documentation fast path and explicit Adhoc example\nstdout:   ✓ AGENTS.md preserves explicit lane selection and destination-repository re-anchoring\nstdout:   ✓ AGENTS.md exposes the Direct documentation fast path and explicit Adhoc example\nstdout:   ✓ .cursor/rules preserves explicit lane selection and destination-repository re-anchoring\nstdout:   ✓ .cursor/rules exposes the Direct documentation fast path and explicit Adhoc example\nstdout: \ndefault init installs Claude extras:\nstdout:   ✓ .claude/skills/ directory created\nstdout:   ✓ specdev-start/SKILL.md installed\nstdout:   ✓ specdev-adhoc/SKILL.md installed\nstdout:   ✓ specdev-assignment/SKILL.md installed\nstdout:   ✓ specdev-rewind/SKILL.md installed\n  ✓ specdev-brainstorm removed (redundant with assignment)\nstdout:   ✓ specdev-continue/SKILL.md installed\nstdout:   ✓ specdev-mission/SKILL.md installed\nstdout:   ✓ specdev-reviewloop/SKILL.md installed\nstdout:   ✓ retired specdev-review skill is absent\nstdout:   ✓ start skill references big_picture.md\nstdout:   ✓ start skill includes Q&A instructions\nstdout:   ✓ Adhoc skill documents structured verification\nstdout:   ✓ Adhoc skill documents the independent short title\nstdout:   ✓ Adhoc skill explains concurrent callable classification\nstdout:   ✓ Adhoc skill documents transactional exact staging\nstdout:   ✓ Adhoc skill documents Git-derived delivery facts\nstdout:   ✓ Adhoc skill documents non-terminal active Assignment coexistence and blocking boundaries\nstdout:   ✓ .claude Adhoc skill preserves the handoff-note exemption and repo-B classification boundary\nstdout:   ✓ .claude Adhoc skill makes explicit activation and documentation routing visible\nstdout:   ✓ .claude Adhoc skill retains ownership and transaction guidance\n  ✓ .claude Adhoc skill preserves active Assignment ownership without implicit shelving\nstdout:   ✓ .codex Adhoc skill preserves the handoff-note exemption and repo-B classification boundary\nstdout:   ✓ .codex Adhoc skill makes explicit activation and documentation routing visible\nstdout:   ✓ .codex Adhoc skill retains ownership and transaction guidance\nstdout:   ✓ .codex Adhoc skill preserves active Assignment ownership without implicit shelving\nstdout:   ✓ assignment skill references specdev assignment command\nstdout:   ✓ assignment skill includes prefix instruction\n  ✓ assignment skill requires a contract preview before approval\nstdout:   ✓ mission skill requires a contract preview before approval\nstdout:   ✓ rewind skill references _main.md\nstdout:   ✓ roadmap skill requires explicit selection and approval without workflow history\nstdout:   ✓ continue skill references durable workflow resume\nstdout:   ✓ reviewloop skill references repository profiles\nstdout:   ✓ reviewloop skill distinguishes native advisory reviews from authoritative reviewloop verdicts\n  ✓ reviewloop skill requires a contract preview before approval\nstdout:   ✓ .claude/specdev-adhoc tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-adhoc uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-assignment tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-assignment uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-continue tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-continue uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-discussion tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-discussion uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-knowledge-curation tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-knowledge-curation uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-layout-migration tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-layout-migration uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-mission tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-mission uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-reviewloop tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-reviewloop uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-rewind tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-rewind uses meaningful-phase announcement guidance\nstderr:   ❌ .claude/specdev-roadmap tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-roadmap uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-start tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-start uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-test-audit tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-test-audit uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-adhoc tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-adhoc uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-assignment tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-assignment uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-continue tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-continue uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-discussion tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-discussion uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-knowledge-curation tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-knowledge-curation uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-layout-migration tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-layout-migration uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-mission tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-mission uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-reviewloop tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-reviewloop uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-rewind tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-rewind uses meaningful-phase announcement guidance\nstderr:   ❌ .codex/specdev-roadmap tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-roadmap uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-start tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-start uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-test-audit tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-test-audit uses meaningful-phase announcement guidance\n\nhook installation:\n  ✓ .claude/hooks/specdev-session-start.sh exists\nstdout:   ✓ hook script starts with bash shebang\nstdout:   ✓ SessionStart guidance exposes Direct writes and meaningful-phase announcements\nstdout:   ✓ .claude/settings.json exists\nstdout:   ✓ settings.json contains SessionStart hook pointing to specdev script\nstdout: \n--platform=claude backward compat:\nstdout:   ✓ init with --platform=claude succeeds\nstdout:   ✓ creates CLAUDE.md\n  ✓ creates AGENTS.md\n  ✓ creates .cursor/rules\n\nhook registration idempotent:\nstdout:   ✓ no duplicate hook entry after re-init with --force\n\nhook merges with existing settings:\nstdout:   ✓ preserves existing permissions key\n  ✓ preserves hook registration alongside existing settings\n\ninvalid settings preserved:\nstdout:   ✓ re-init succeeds even with invalid settings\nstdout:   ✓ keeps invalid settings file untouched\n\nadapter drift-detection instruction:\nstdout:   ✓ adapter includes \"Specdev:\" prefix instruction\n\nno-overwrite:\nstdout:   ✓ preserves existing CLAUDE.md content on --force\nstdout:   ✓ preserves existing AGENTS.md content on --force\nstdout:   ✓ preserves existing .cursor/rules content on --force\nstdout: \n124 passed, 2 failed",
            "truncated": false,
            "captured_bytes": 8624
          }
        },
        {
          "version": 1,
          "id": "V-002",
          "label": "roadmap-lane",
          "annotation": null,
          "command": "node tests/test-init-platform.js",
          "argv": [
            "node",
            "tests/test-init-platform.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-09-01T05:12:09.691Z",
          "completed_at": "2026-09-01T05:12:11.943Z",
          "duration_ms": 2251,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@a077906cb0fb01dd71c85f30ffce8ec2624c806e",
          "output": {
            "text": "stdout: \ndefault init creates all adapters:\nstdout:   ✓ init succeeds\nstdout:   ✓ .specdev created\n  ✓ creates CLAUDE.md\nstdout:   ✓ creates AGENTS.md\nstdout:   ✓ creates .cursor/rules\nstdout:   ✓ init installs the exact roadmap scaffold and command skill\nstdout:   ✓ roadmap reports the stateless exact-path boundary without creating state\nstdout:   ✓ update preserves roadmap bytes and backfills a missing scaffold file\nstdout:   ✓ _main.md uses a repository-root-relative project context path\nstdout:   ✓ _main.md installs the copyable PATH fallback\nstdout:   ✓ _main.md checks workspace launcher executability before use\nstdout:   ✓ _main.md defines phase-level announcement granularity\nstdout:   ✓ _main.md defines Direct documentation eligibility, proportional orientation, and explicit Adhoc routing\nstdout:   ✓ _main.md defines the cross-repository handoff-note ownership boundary\nstdout:   ✓ CLAUDE.md points to _main.md\nstdout:   ✓ AGENTS.md points to _main.md\nstdout:   ✓ AGENTS.md does not inject SpecDev source-repository advice\nstdout:   ✓ .cursor/rules points to _main.md\nstdout:   ✓ CLAUDE.md preserves explicit lane selection and destination-repository re-anchoring\nstdout:   ✓ CLAUDE.md exposes the Direct documentation fast path and explicit Adhoc example\nstdout:   ✓ AGENTS.md preserves explicit lane selection and destination-repository re-anchoring\nstdout:   ✓ AGENTS.md exposes the Direct documentation fast path and explicit Adhoc example\nstdout:   ✓ .cursor/rules preserves explicit lane selection and destination-repository re-anchoring\nstdout:   ✓ .cursor/rules exposes the Direct documentation fast path and explicit Adhoc example\nstdout: \ndefault init installs Claude extras:\nstdout:   ✓ .claude/skills/ directory created\nstdout:   ✓ specdev-start/SKILL.md installed\n  ✓ specdev-adhoc/SKILL.md installed\nstdout:   ✓ specdev-assignment/SKILL.md installed\nstdout:   ✓ specdev-rewind/SKILL.md installed\nstdout:   ✓ specdev-brainstorm removed (redundant with assignment)\nstdout:   ✓ specdev-continue/SKILL.md installed\n  ✓ specdev-mission/SKILL.md installed\nstdout:   ✓ specdev-reviewloop/SKILL.md installed\nstdout:   ✓ retired specdev-review skill is absent\nstdout:   ✓ start skill references big_picture.md\n  ✓ start skill includes Q&A instructions\nstdout:   ✓ Adhoc skill documents structured verification\nstdout:   ✓ Adhoc skill documents the independent short title\nstdout:   ✓ Adhoc skill explains concurrent callable classification\nstdout:   ✓ Adhoc skill documents transactional exact staging\nstdout:   ✓ Adhoc skill documents Git-derived delivery facts\nstdout:   ✓ Adhoc skill documents non-terminal active Assignment coexistence and blocking boundaries\nstdout:   ✓ .claude Adhoc skill preserves the handoff-note exemption and repo-B classification boundary\nstdout:   ✓ .claude Adhoc skill makes explicit activation and documentation routing visible\nstdout:   ✓ .claude Adhoc skill retains ownership and transaction guidance\nstdout:   ✓ .claude Adhoc skill preserves active Assignment ownership without implicit shelving\nstdout:   ✓ .codex Adhoc skill preserves the handoff-note exemption and repo-B classification boundary\nstdout:   ✓ .codex Adhoc skill makes explicit activation and documentation routing visible\nstdout:   ✓ .codex Adhoc skill retains ownership and transaction guidance\n  ✓ .codex Adhoc skill preserves active Assignment ownership without implicit shelving\nstdout:   ✓ assignment skill references specdev assignment command\nstdout:   ✓ assignment skill includes prefix instruction\n  ✓ assignment skill requires a contract preview before approval\nstdout:   ✓ mission skill requires a contract preview before approval\nstdout:   ✓ rewind skill references _main.md\nstdout:   ✓ roadmap skill requires explicit selection and approval without workflow history\nstdout:   ✓ continue skill references durable workflow resume\nstdout:   ✓ reviewloop skill references repository profiles\nstdout:   ✓ reviewloop skill distinguishes native advisory reviews from authoritative reviewloop verdicts\n  ✓ reviewloop skill requires a contract preview before approval\nstdout:   ✓ .claude/specdev-adhoc tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-adhoc uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-assignment tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-assignment uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-continue tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-continue uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-discussion tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-discussion uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-knowledge-curation tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-knowledge-curation uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-layout-migration tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-layout-migration uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-mission tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-mission uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-reviewloop tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-reviewloop uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-rewind tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-rewind uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-roadmap tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-roadmap uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-start tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-start uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-test-audit tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-test-audit uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-adhoc tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-adhoc uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-assignment tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-assignment uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-continue tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-continue uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-discussion tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-discussion uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-knowledge-curation tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-knowledge-curation uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-layout-migration tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-layout-migration uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-mission tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-mission uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-reviewloop tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-reviewloop uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-rewind tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-rewind uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-roadmap tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-roadmap uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-start tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-start uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-test-audit tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-test-audit uses meaningful-phase announcement guidance\n\nhook installation:\nstdout:   ✓ .claude/hooks/specdev-session-start.sh exists\nstdout:   ✓ hook script starts with bash shebang\nstdout:   ✓ SessionStart guidance exposes Direct writes and meaningful-phase announcements\nstdout:   ✓ .claude/settings.json exists\nstdout:   ✓ settings.json contains SessionStart hook pointing to specdev script\nstdout: \n--platform=claude backward compat:\nstdout:   ✓ init with --platform=claude succeeds\nstdout:   ✓ creates CLAUDE.md\n  ✓ creates AGENTS.md\n  ✓ creates .cursor/rules\n\nhook registration idempotent:\nstdout:   ✓ no duplicate hook entry after re-init with --force\n\nhook merges with existing settings:\nstdout:   ✓ preserves existing permissions key\n  ✓ preserves hook registration alongside existing settings\n\ninvalid settings preserved:\nstdout:   ✓ re-init succeeds even with invalid settings\nstdout:   ✓ keeps invalid settings file untouched\n\nadapter drift-detection instruction:\nstdout:   ✓ adapter includes \"Specdev:\" prefix instruction\n\nno-overwrite:\nstdout:   ✓ preserves existing CLAUDE.md content on --force\nstdout:   ✓ preserves existing AGENTS.md content on --force\nstdout:   ✓ preserves existing .cursor/rules content on --force\nstdout: \n126 passed, 0 failed",
            "truncated": false,
            "captured_bytes": 8624
          }
        }
      ],
      "acceptance_evidence": [
        {
          "version": 1,
          "id": "V-002",
          "label": "roadmap-lane",
          "annotation": null,
          "command": "node tests/test-init-platform.js",
          "argv": [
            "node",
            "tests/test-init-platform.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-09-01T05:12:09.691Z",
          "completed_at": "2026-09-01T05:12:11.943Z",
          "duration_ms": 2251,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@a077906cb0fb01dd71c85f30ffce8ec2624c806e",
          "output": {
            "text": "stdout: \ndefault init creates all adapters:\nstdout:   ✓ init succeeds\nstdout:   ✓ .specdev created\n  ✓ creates CLAUDE.md\nstdout:   ✓ creates AGENTS.md\nstdout:   ✓ creates .cursor/rules\nstdout:   ✓ init installs the exact roadmap scaffold and command skill\nstdout:   ✓ roadmap reports the stateless exact-path boundary without creating state\nstdout:   ✓ update preserves roadmap bytes and backfills a missing scaffold file\nstdout:   ✓ _main.md uses a repository-root-relative project context path\nstdout:   ✓ _main.md installs the copyable PATH fallback\nstdout:   ✓ _main.md checks workspace launcher executability before use\nstdout:   ✓ _main.md defines phase-level announcement granularity\nstdout:   ✓ _main.md defines Direct documentation eligibility, proportional orientation, and explicit Adhoc routing\nstdout:   ✓ _main.md defines the cross-repository handoff-note ownership boundary\nstdout:   ✓ CLAUDE.md points to _main.md\nstdout:   ✓ AGENTS.md points to _main.md\nstdout:   ✓ AGENTS.md does not inject SpecDev source-repository advice\nstdout:   ✓ .cursor/rules points to _main.md\nstdout:   ✓ CLAUDE.md preserves explicit lane selection and destination-repository re-anchoring\nstdout:   ✓ CLAUDE.md exposes the Direct documentation fast path and explicit Adhoc example\nstdout:   ✓ AGENTS.md preserves explicit lane selection and destination-repository re-anchoring\nstdout:   ✓ AGENTS.md exposes the Direct documentation fast path and explicit Adhoc example\nstdout:   ✓ .cursor/rules preserves explicit lane selection and destination-repository re-anchoring\nstdout:   ✓ .cursor/rules exposes the Direct documentation fast path and explicit Adhoc example\nstdout: \ndefault init installs Claude extras:\nstdout:   ✓ .claude/skills/ directory created\nstdout:   ✓ specdev-start/SKILL.md installed\n  ✓ specdev-adhoc/SKILL.md installed\nstdout:   ✓ specdev-assignment/SKILL.md installed\nstdout:   ✓ specdev-rewind/SKILL.md installed\nstdout:   ✓ specdev-brainstorm removed (redundant with assignment)\nstdout:   ✓ specdev-continue/SKILL.md installed\n  ✓ specdev-mission/SKILL.md installed\nstdout:   ✓ specdev-reviewloop/SKILL.md installed\nstdout:   ✓ retired specdev-review skill is absent\nstdout:   ✓ start skill references big_picture.md\n  ✓ start skill includes Q&A instructions\nstdout:   ✓ Adhoc skill documents structured verification\nstdout:   ✓ Adhoc skill documents the independent short title\nstdout:   ✓ Adhoc skill explains concurrent callable classification\nstdout:   ✓ Adhoc skill documents transactional exact staging\nstdout:   ✓ Adhoc skill documents Git-derived delivery facts\nstdout:   ✓ Adhoc skill documents non-terminal active Assignment coexistence and blocking boundaries\nstdout:   ✓ .claude Adhoc skill preserves the handoff-note exemption and repo-B classification boundary\nstdout:   ✓ .claude Adhoc skill makes explicit activation and documentation routing visible\nstdout:   ✓ .claude Adhoc skill retains ownership and transaction guidance\nstdout:   ✓ .claude Adhoc skill preserves active Assignment ownership without implicit shelving\nstdout:   ✓ .codex Adhoc skill preserves the handoff-note exemption and repo-B classification boundary\nstdout:   ✓ .codex Adhoc skill makes explicit activation and documentation routing visible\nstdout:   ✓ .codex Adhoc skill retains ownership and transaction guidance\n  ✓ .codex Adhoc skill preserves active Assignment ownership without implicit shelving\nstdout:   ✓ assignment skill references specdev assignment command\nstdout:   ✓ assignment skill includes prefix instruction\n  ✓ assignment skill requires a contract preview before approval\nstdout:   ✓ mission skill requires a contract preview before approval\nstdout:   ✓ rewind skill references _main.md\nstdout:   ✓ roadmap skill requires explicit selection and approval without workflow history\nstdout:   ✓ continue skill references durable workflow resume\nstdout:   ✓ reviewloop skill references repository profiles\nstdout:   ✓ reviewloop skill distinguishes native advisory reviews from authoritative reviewloop verdicts\n  ✓ reviewloop skill requires a contract preview before approval\nstdout:   ✓ .claude/specdev-adhoc tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-adhoc uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-assignment tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-assignment uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-continue tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-continue uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-discussion tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-discussion uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-knowledge-curation tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-knowledge-curation uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-layout-migration tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-layout-migration uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-mission tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-mission uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-reviewloop tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-reviewloop uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-rewind tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-rewind uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-roadmap tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-roadmap uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-start tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-start uses meaningful-phase announcement guidance\nstdout:   ✓ .claude/specdev-test-audit tracked host copy matches generated skill prose\nstdout:   ✓ .claude/specdev-test-audit uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-adhoc tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-adhoc uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-assignment tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-assignment uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-continue tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-continue uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-discussion tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-discussion uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-knowledge-curation tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-knowledge-curation uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-layout-migration tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-layout-migration uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-mission tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-mission uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-reviewloop tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-reviewloop uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-rewind tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-rewind uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-roadmap tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-roadmap uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-start tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-start uses meaningful-phase announcement guidance\nstdout:   ✓ .codex/specdev-test-audit tracked host copy matches generated skill prose\nstdout:   ✓ .codex/specdev-test-audit uses meaningful-phase announcement guidance\n\nhook installation:\nstdout:   ✓ .claude/hooks/specdev-session-start.sh exists\nstdout:   ✓ hook script starts with bash shebang\nstdout:   ✓ SessionStart guidance exposes Direct writes and meaningful-phase announcements\nstdout:   ✓ .claude/settings.json exists\nstdout:   ✓ settings.json contains SessionStart hook pointing to specdev script\nstdout: \n--platform=claude backward compat:\nstdout:   ✓ init with --platform=claude succeeds\nstdout:   ✓ creates CLAUDE.md\n  ✓ creates AGENTS.md\n  ✓ creates .cursor/rules\n\nhook registration idempotent:\nstdout:   ✓ no duplicate hook entry after re-init with --force\n\nhook merges with existing settings:\nstdout:   ✓ preserves existing permissions key\n  ✓ preserves hook registration alongside existing settings\n\ninvalid settings preserved:\nstdout:   ✓ re-init succeeds even with invalid settings\nstdout:   ✓ keeps invalid settings file untouched\n\nadapter drift-detection instruction:\nstdout:   ✓ adapter includes \"Specdev:\" prefix instruction\n\nno-overwrite:\nstdout:   ✓ preserves existing CLAUDE.md content on --force\nstdout:   ✓ preserves existing AGENTS.md content on --force\nstdout:   ✓ preserves existing .cursor/rules content on --force\nstdout: \n126 passed, 0 failed",
            "truncated": false,
            "captured_bytes": 8624
          }
        }
      ]
    }
