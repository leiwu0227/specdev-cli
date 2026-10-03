# Adhoc AH-20261003T004203400Z-8fe6

- Scope: Replace fragile guidance wording assertions with installation and reference checks
- Title: Test guidance installation without locking prose
- Started: 2026-10-03T00:42:03.400Z
- Completed: 2026-10-03T00:42:45.651Z
- Starting working tree: Clean.

## Outcome

Replaced sentence-fragment assertions in init and skill-update tests with current source installation, skill metadata, and working reference checks. Preserved CLI behavior and fixture protection checks. Both approved tests passed.

## Focused workflow coexistence

No focused Assignment or Mission coexistence was recorded.

## Delivery path facts

### Requested adopted paths

None.

### Committed paths

- `.specdev/adhoc/2026-10/AH-20261003T004203400Z-8fe6_replace-fragile-guidance-wording-assertions-with.md`
- `tests/test-init-platform.js`
- `tests/test-update-skill-roots.js`

### Rejected paths

None.

### Remaining owned paths

None.

## Verification summary

No manual verification summary was supplied.

## Verification attempt history

- **installation: passed.** `node tests/test-init-platform.js` (2479 ms, working-tree@74822d823748f07000b6f33403b436a0c4685121)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 0
  - Output:

    nue installs current skill content
    stdout:   ✓ specdev-continue has matching skill metadata
    stdout:   ✓ .codex/specdev-discussion installs current skill content
    stdout:   ✓ specdev-discussion has matching skill metadata
    stdout:   ✓ .codex/specdev-roadmap installs current skill content
    stdout:   ✓ specdev-roadmap has matching skill metadata
    stdout:   ✓ .codex/specdev-mission installs current skill content
    stdout:   ✓ specdev-mission has matching skill metadata
    stdout:   ✓ .codex/specdev-knowledge-curation installs current skill content
    stdout:   ✓ specdev-knowledge-curation has matching skill metadata
    stdout:   ✓ .codex/specdev-test-audit installs current skill content
    stdout:   ✓ specdev-test-audit has matching skill metadata
    stdout:   ✓ .codex/specdev-reviewloop installs current skill content
      ✓ specdev-reviewloop has matching skill metadata
    stdout: 
    hook installation:
    stdout:   ✓ .claude/hooks/specdev-session-start.sh exists
    stdout:   ✓ hook script starts with bash shebang
    stdout:   ✓ .claude tracked session hook matches the generated hook source
      ✓ .claude/settings.json exists
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
    124 passed, 0 failed
- **skill-update: passed.** `node tests/test-update-skill-roots.js` (380 ms, working-tree@74822d823748f07000b6f33403b436a0c4685121)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 0
  - Output:

    stdout: Update skill-root migration tests passed.

## Current acceptance evidence

- **installation: passed.** `node tests/test-init-platform.js` (2479 ms, working-tree@74822d823748f07000b6f33403b436a0c4685121)
- **skill-update: passed.** `node tests/test-update-skill-roots.js` (380 ms, working-tree@74822d823748f07000b6f33403b436a0c4685121)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 0
  - Output:

    stdout: Update skill-root migration tests passed.

## Structured verification

    {
      "version": 1,
      "path_facts": {
        "requested": [],
        "committed": [
          ".specdev/adhoc/2026-10/AH-20261003T004203400Z-8fe6_replace-fragile-guidance-wording-assertions-with.md",
          "tests/test-init-platform.js",
          "tests/test-update-skill-roots.js"
        ],
        "rejected": [],
        "remaining": []
      },
      "attempt_history": [
        {
          "version": 1,
          "id": "V-001",
          "label": "installation",
          "annotation": null,
          "command": "node tests/test-init-platform.js",
          "argv": [
            "node",
            "tests/test-init-platform.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-10-03T00:42:29.829Z",
          "completed_at": "2026-10-03T00:42:32.308Z",
          "duration_ms": 2479,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@74822d823748f07000b6f33403b436a0c4685121",
          "output": {
            "text": "stdout: \ndefault init creates all adapters:\nstdout:   ✓ init succeeds\nstdout:   ✓ .specdev created\n  ✓ creates CLAUDE.md\n  ✓ creates AGENTS.md\n  ✓ creates .cursor/rules\nstdout:   ✓ init installs the exact roadmap scaffold and command skill\nstdout:   ✓ roadmap reports the stateless exact-path boundary without creating state\nstdout:   ✓ update preserves roadmap bytes and backfills a missing scaffold file\nstdout:   ✓ update backfills a missing Todo scaffold\nstdout:   ✓ installed guidance matches its source: _main.md\nstdout:   ✓ installed guidance matches its source: _index.md\nstdout:   ✓ installed guidance matches its source: _guides/workflow.md\nstdout:   ✓ installed guidance matches its source: _guides/assignment_guide.md\nstdout:   ✓ installed guidance matches its source: _guides/runtime.md\nstdout:   ✓ installed guidance matches its source: skills/README.md\nstdout:   ✓ installed guidance matches its source: skills/core/brainstorming/SKILL.md\nstdout:   ✓ main guide references project context\nstdout:   ✓ main guide provides the PATH fallback\n  ✓ main guide checks launcher executability\nstdout:   ✓ main guide links to Roadmap rules\n  ✓ main guide links to Assignment rules\nstdout:   ✓ main-guide reference is installed: _guides/workflow.md\nstdout:   ✓ main-guide section exists: _guides/workflow.md#roadmap\nstdout:   ✓ main-guide reference is installed: _guides/workflow.md\nstdout:   ✓ main-guide section exists: _guides/workflow.md#direct-and-adhoc\nstdout:   ✓ main-guide reference is installed: _guides/workflow.md\nstdout:   ✓ main-guide section exists: _guides/workflow.md#assignment\nstdout:   ✓ main-guide reference is installed: _guides/workflow.md\nstdout:   ✓ main-guide section exists: _guides/workflow.md#mission\nstdout:   ✓ main-guide reference is installed: _guides/workflow.md\nstdout:   ✓ main-guide section exists: _guides/workflow.md#discussion\nstdout:   ✓ main-guide reference is installed: _guides/workflow.md\nstdout:   ✓ main-guide section exists: _guides/workflow.md#test-audit\nstdout:   ✓ main-guide reference is installed: skills/core/brainstorming/SKILL.md\nstdout:   ✓ main-guide reference is installed: guides/review.md\nstdout:   ✓ main-guide reference is installed: _guides/workflow.md\nstdout:   ✓ main-guide section exists: _guides/workflow.md#verification\nstdout:   ✓ main-guide reference is installed: _guides/workflow.md\nstdout:   ✓ main-guide section exists: _guides/workflow.md#knowledge\nstdout:   ✓ main-guide reference is installed: _guides/workflow.md\nstdout:   ✓ main-guide section exists: _guides/workflow.md#profiles-and-guides\nstdout:   ✓ main-guide reference is installed: _guides/workflow.md\nstdout:   ✓ main-guide section exists: _guides/workflow.md#commit-identity\nstdout:   ✓ main-guide reference is installed: _guides/runtime.md\nstdout:   ✓ main-guide reference is installed: _index.md\nstdout:   ✓ main-guide reference is installed: _guides/update_guide.md\nstdout:   ✓ main-guide reference is installed: _guides/migration_guide.md\nstdout:   ✓ CLAUDE.md installs the current adapter\nstdout:   ✓ CLAUDE.md references the main guide\n  ✓ CLAUDE.md excludes source-repository advice\nstdout:   ✓ AGENTS.md installs the current adapter\nstdout:   ✓ AGENTS.md references the main guide\n  ✓ AGENTS.md excludes source-repository advice\nstdout:   ✓ .cursor/rules installs the current adapter\nstdout:   ✓ .cursor/rules references the main guide\n  ✓ .cursor/rules excludes source-repository advice\nstdout:   ✓ .claude installs the current skill set without retired skills\nstdout:   ✓ .claude/specdev-adhoc installs current skill content\nstdout:   ✓ specdev-adhoc has matching skill metadata\nstdout:   ✓ .claude/specdev-start installs current skill content\nstdout:   ✓ specdev-start has matching skill metadata\nstdout:   ✓ .claude/specdev-rewind installs current skill content\nstdout:   ✓ specdev-rewind has matching skill metadata\nstdout:   ✓ .claude/specdev-layout-migration installs current skill content\nstdout:   ✓ specdev-layout-migration has matching skill metadata\nstdout:   ✓ .claude/specdev-assignment installs current skill content\nstdout:   ✓ specdev-assignment has matching skill metadata\nstdout:   ✓ .claude/specdev-continue installs current skill content\nstdout:   ✓ specdev-continue has matching skill metadata\nstdout:   ✓ .claude/specdev-discussion installs current skill content\nstdout:   ✓ specdev-discussion has matching skill metadata\nstdout:   ✓ .claude/specdev-roadmap installs current skill content\nstdout:   ✓ specdev-roadmap has matching skill metadata\nstdout:   ✓ .claude/specdev-mission installs current skill content\nstdout:   ✓ specdev-mission has matching skill metadata\nstdout:   ✓ .claude/specdev-knowledge-curation installs current skill content\nstdout:   ✓ specdev-knowledge-curation has matching skill metadata\nstdout:   ✓ .claude/specdev-test-audit installs current skill content\n  ✓ specdev-test-audit has matching skill metadata\nstdout:   ✓ .claude/specdev-reviewloop installs current skill content\nstdout:   ✓ specdev-reviewloop has matching skill metadata\nstdout:   ✓ .codex installs the current skill set without retired skills\nstdout:   ✓ .codex/specdev-adhoc installs current skill content\nstdout:   ✓ specdev-adhoc has matching skill metadata\nstdout:   ✓ .codex/specdev-start installs current skill content\nstdout:   ✓ specdev-start has matching skill metadata\nstdout:   ✓ .codex/specdev-rewind installs current skill content\nstdout:   ✓ specdev-rewind has matching skill metadata\nstdout:   ✓ .codex/specdev-layout-migration installs current skill content\nstdout:   ✓ specdev-layout-migration has matching skill metadata\nstdout:   ✓ .codex/specdev-assignment installs current skill content\nstdout:   ✓ specdev-assignment has matching skill metadata\nstdout:   ✓ .codex/specdev-continue installs current skill content\nstdout:   ✓ specdev-continue has matching skill metadata\nstdout:   ✓ .codex/specdev-discussion installs current skill content\nstdout:   ✓ specdev-discussion has matching skill metadata\nstdout:   ✓ .codex/specdev-roadmap installs current skill content\nstdout:   ✓ specdev-roadmap has matching skill metadata\nstdout:   ✓ .codex/specdev-mission installs current skill content\nstdout:   ✓ specdev-mission has matching skill metadata\nstdout:   ✓ .codex/specdev-knowledge-curation installs current skill content\nstdout:   ✓ specdev-knowledge-curation has matching skill metadata\nstdout:   ✓ .codex/specdev-test-audit installs current skill content\nstdout:   ✓ specdev-test-audit has matching skill metadata\nstdout:   ✓ .codex/specdev-reviewloop installs current skill content\n  ✓ specdev-reviewloop has matching skill metadata\nstdout: \nhook installation:\nstdout:   ✓ .claude/hooks/specdev-session-start.sh exists\nstdout:   ✓ hook script starts with bash shebang\nstdout:   ✓ .claude tracked session hook matches the generated hook source\n  ✓ .claude/settings.json exists\nstdout:   ✓ settings.json contains SessionStart hook pointing to specdev script\nstdout: \n--platform=claude backward compat:\nstdout:   ✓ init with --platform=claude succeeds\nstdout:   ✓ creates CLAUDE.md\n  ✓ creates AGENTS.md\n  ✓ creates .cursor/rules\n\nhook registration idempotent:\nstdout:   ✓ no duplicate hook entry after re-init with --force\n\nhook merges with existing settings:\nstdout:   ✓ preserves existing permissions key\n  ✓ preserves hook registration alongside existing settings\n\ninvalid settings preserved:\nstdout:   ✓ re-init succeeds even with invalid settings\nstdout:   ✓ keeps invalid settings file untouched\n\nadapter drift-detection instruction:\nstdout:   ✓ adapter includes \"Specdev:\" prefix instruction\n\nno-overwrite:\nstdout:   ✓ preserves existing CLAUDE.md content on --force\nstdout:   ✓ preserves existing AGENTS.md content on --force\nstdout:   ✓ preserves existing .cursor/rules content on --force\nstdout: \n124 passed, 0 failed",
            "truncated": false,
            "captured_bytes": 7150
          }
        },
        {
          "version": 1,
          "id": "V-002",
          "label": "skill-update",
          "annotation": null,
          "command": "node tests/test-update-skill-roots.js",
          "argv": [
            "node",
            "tests/test-update-skill-roots.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-10-03T00:42:36.889Z",
          "completed_at": "2026-10-03T00:42:37.269Z",
          "duration_ms": 380,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@74822d823748f07000b6f33403b436a0c4685121",
          "output": {
            "text": "stdout: Update skill-root migration tests passed.",
            "truncated": false,
            "captured_bytes": 42
          }
        }
      ],
      "acceptance_evidence": [
        {
          "version": 1,
          "id": "V-001",
          "label": "installation",
          "annotation": null,
          "command": "node tests/test-init-platform.js",
          "argv": [
            "node",
            "tests/test-init-platform.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-10-03T00:42:29.829Z",
          "completed_at": "2026-10-03T00:42:32.308Z",
          "duration_ms": 2479,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@74822d823748f07000b6f33403b436a0c4685121",
          "output": {
            "text": "stdout: \ndefault init creates all adapters:\nstdout:   ✓ init succeeds\nstdout:   ✓ .specdev created\n  ✓ creates CLAUDE.md\n  ✓ creates AGENTS.md\n  ✓ creates .cursor/rules\nstdout:   ✓ init installs the exact roadmap scaffold and command skill\nstdout:   ✓ roadmap reports the stateless exact-path boundary without creating state\nstdout:   ✓ update preserves roadmap bytes and backfills a missing scaffold file\nstdout:   ✓ update backfills a missing Todo scaffold\nstdout:   ✓ installed guidance matches its source: _main.md\nstdout:   ✓ installed guidance matches its source: _index.md\nstdout:   ✓ installed guidance matches its source: _guides/workflow.md\nstdout:   ✓ installed guidance matches its source: _guides/assignment_guide.md\nstdout:   ✓ installed guidance matches its source: _guides/runtime.md\nstdout:   ✓ installed guidance matches its source: skills/README.md\nstdout:   ✓ installed guidance matches its source: skills/core/brainstorming/SKILL.md\nstdout:   ✓ main guide references project context\nstdout:   ✓ main guide provides the PATH fallback\n  ✓ main guide checks launcher executability\nstdout:   ✓ main guide links to Roadmap rules\n  ✓ main guide links to Assignment rules\nstdout:   ✓ main-guide reference is installed: _guides/workflow.md\nstdout:   ✓ main-guide section exists: _guides/workflow.md#roadmap\nstdout:   ✓ main-guide reference is installed: _guides/workflow.md\nstdout:   ✓ main-guide section exists: _guides/workflow.md#direct-and-adhoc\nstdout:   ✓ main-guide reference is installed: _guides/workflow.md\nstdout:   ✓ main-guide section exists: _guides/workflow.md#assignment\nstdout:   ✓ main-guide reference is installed: _guides/workflow.md\nstdout:   ✓ main-guide section exists: _guides/workflow.md#mission\nstdout:   ✓ main-guide reference is installed: _guides/workflow.md\nstdout:   ✓ main-guide section exists: _guides/workflow.md#discussion\nstdout:   ✓ main-guide reference is installed: _guides/workflow.md\nstdout:   ✓ main-guide section exists: _guides/workflow.md#test-audit\nstdout:   ✓ main-guide reference is installed: skills/core/brainstorming/SKILL.md\nstdout:   ✓ main-guide reference is installed: guides/review.md\nstdout:   ✓ main-guide reference is installed: _guides/workflow.md\nstdout:   ✓ main-guide section exists: _guides/workflow.md#verification\nstdout:   ✓ main-guide reference is installed: _guides/workflow.md\nstdout:   ✓ main-guide section exists: _guides/workflow.md#knowledge\nstdout:   ✓ main-guide reference is installed: _guides/workflow.md\nstdout:   ✓ main-guide section exists: _guides/workflow.md#profiles-and-guides\nstdout:   ✓ main-guide reference is installed: _guides/workflow.md\nstdout:   ✓ main-guide section exists: _guides/workflow.md#commit-identity\nstdout:   ✓ main-guide reference is installed: _guides/runtime.md\nstdout:   ✓ main-guide reference is installed: _index.md\nstdout:   ✓ main-guide reference is installed: _guides/update_guide.md\nstdout:   ✓ main-guide reference is installed: _guides/migration_guide.md\nstdout:   ✓ CLAUDE.md installs the current adapter\nstdout:   ✓ CLAUDE.md references the main guide\n  ✓ CLAUDE.md excludes source-repository advice\nstdout:   ✓ AGENTS.md installs the current adapter\nstdout:   ✓ AGENTS.md references the main guide\n  ✓ AGENTS.md excludes source-repository advice\nstdout:   ✓ .cursor/rules installs the current adapter\nstdout:   ✓ .cursor/rules references the main guide\n  ✓ .cursor/rules excludes source-repository advice\nstdout:   ✓ .claude installs the current skill set without retired skills\nstdout:   ✓ .claude/specdev-adhoc installs current skill content\nstdout:   ✓ specdev-adhoc has matching skill metadata\nstdout:   ✓ .claude/specdev-start installs current skill content\nstdout:   ✓ specdev-start has matching skill metadata\nstdout:   ✓ .claude/specdev-rewind installs current skill content\nstdout:   ✓ specdev-rewind has matching skill metadata\nstdout:   ✓ .claude/specdev-layout-migration installs current skill content\nstdout:   ✓ specdev-layout-migration has matching skill metadata\nstdout:   ✓ .claude/specdev-assignment installs current skill content\nstdout:   ✓ specdev-assignment has matching skill metadata\nstdout:   ✓ .claude/specdev-continue installs current skill content\nstdout:   ✓ specdev-continue has matching skill metadata\nstdout:   ✓ .claude/specdev-discussion installs current skill content\nstdout:   ✓ specdev-discussion has matching skill metadata\nstdout:   ✓ .claude/specdev-roadmap installs current skill content\nstdout:   ✓ specdev-roadmap has matching skill metadata\nstdout:   ✓ .claude/specdev-mission installs current skill content\nstdout:   ✓ specdev-mission has matching skill metadata\nstdout:   ✓ .claude/specdev-knowledge-curation installs current skill content\nstdout:   ✓ specdev-knowledge-curation has matching skill metadata\nstdout:   ✓ .claude/specdev-test-audit installs current skill content\n  ✓ specdev-test-audit has matching skill metadata\nstdout:   ✓ .claude/specdev-reviewloop installs current skill content\nstdout:   ✓ specdev-reviewloop has matching skill metadata\nstdout:   ✓ .codex installs the current skill set without retired skills\nstdout:   ✓ .codex/specdev-adhoc installs current skill content\nstdout:   ✓ specdev-adhoc has matching skill metadata\nstdout:   ✓ .codex/specdev-start installs current skill content\nstdout:   ✓ specdev-start has matching skill metadata\nstdout:   ✓ .codex/specdev-rewind installs current skill content\nstdout:   ✓ specdev-rewind has matching skill metadata\nstdout:   ✓ .codex/specdev-layout-migration installs current skill content\nstdout:   ✓ specdev-layout-migration has matching skill metadata\nstdout:   ✓ .codex/specdev-assignment installs current skill content\nstdout:   ✓ specdev-assignment has matching skill metadata\nstdout:   ✓ .codex/specdev-continue installs current skill content\nstdout:   ✓ specdev-continue has matching skill metadata\nstdout:   ✓ .codex/specdev-discussion installs current skill content\nstdout:   ✓ specdev-discussion has matching skill metadata\nstdout:   ✓ .codex/specdev-roadmap installs current skill content\nstdout:   ✓ specdev-roadmap has matching skill metadata\nstdout:   ✓ .codex/specdev-mission installs current skill content\nstdout:   ✓ specdev-mission has matching skill metadata\nstdout:   ✓ .codex/specdev-knowledge-curation installs current skill content\nstdout:   ✓ specdev-knowledge-curation has matching skill metadata\nstdout:   ✓ .codex/specdev-test-audit installs current skill content\nstdout:   ✓ specdev-test-audit has matching skill metadata\nstdout:   ✓ .codex/specdev-reviewloop installs current skill content\n  ✓ specdev-reviewloop has matching skill metadata\nstdout: \nhook installation:\nstdout:   ✓ .claude/hooks/specdev-session-start.sh exists\nstdout:   ✓ hook script starts with bash shebang\nstdout:   ✓ .claude tracked session hook matches the generated hook source\n  ✓ .claude/settings.json exists\nstdout:   ✓ settings.json contains SessionStart hook pointing to specdev script\nstdout: \n--platform=claude backward compat:\nstdout:   ✓ init with --platform=claude succeeds\nstdout:   ✓ creates CLAUDE.md\n  ✓ creates AGENTS.md\n  ✓ creates .cursor/rules\n\nhook registration idempotent:\nstdout:   ✓ no duplicate hook entry after re-init with --force\n\nhook merges with existing settings:\nstdout:   ✓ preserves existing permissions key\n  ✓ preserves hook registration alongside existing settings\n\ninvalid settings preserved:\nstdout:   ✓ re-init succeeds even with invalid settings\nstdout:   ✓ keeps invalid settings file untouched\n\nadapter drift-detection instruction:\nstdout:   ✓ adapter includes \"Specdev:\" prefix instruction\n\nno-overwrite:\nstdout:   ✓ preserves existing CLAUDE.md content on --force\nstdout:   ✓ preserves existing AGENTS.md content on --force\nstdout:   ✓ preserves existing .cursor/rules content on --force\nstdout: \n124 passed, 0 failed",
            "truncated": false,
            "captured_bytes": 7150
          }
        },
        {
          "version": 1,
          "id": "V-002",
          "label": "skill-update",
          "annotation": null,
          "command": "node tests/test-update-skill-roots.js",
          "argv": [
            "node",
            "tests/test-update-skill-roots.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-10-03T00:42:36.889Z",
          "completed_at": "2026-10-03T00:42:37.269Z",
          "duration_ms": 380,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@74822d823748f07000b6f33403b436a0c4685121",
          "output": {
            "text": "stdout: Update skill-root migration tests passed.",
            "truncated": false,
            "captured_bytes": 42
          }
        }
      ]
    }
