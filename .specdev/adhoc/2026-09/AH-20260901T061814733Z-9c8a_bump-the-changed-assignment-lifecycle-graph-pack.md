# Adhoc AH-20260901T061814733Z-9c8a

- Scope: Bump the changed Assignment lifecycle graph package version so specdev update installs the inline-execution graph without mutating immutable assignment-lifecycle@2.3.0, and align focused graph-package expectations
- Title: bump assignment graph package
- Started: 2026-09-01T06:18:14.733Z
- Completed: 2026-09-01T06:20:27.579Z
- Starting working tree: Clean.

## Outcome

Bumped the changed Assignment lifecycle graph to 2.4.0, preserved immutable 2.3.0 for pinned runs, aligned graph-package expectations, and verified the working-tree update installs and selects 2.4.0 successfully.

## Delivery path facts

### Requested adopted paths

None.

### Committed paths

- `.claude/skills/specdev-reviewloop/SKILL.md`
- `.codex/skills/specdev-reviewloop/SKILL.md`
- `.specdev/.ripplegraph/registry.json`
- `.specdev/adhoc/2026-09/AH-20260901T061814733Z-9c8a_bump-the-changed-assignment-lifecycle-graph-pack.md`
- `.specdev/workflows/assignment-lifecycle@2.4.0/graph.json`
- `.specdev/workflows/catalog.json`
- `templates/.specdev/workflows/assignment-lifecycle/graph.json`
- `tests/test-engine-graphpackages.js`

### Rejected paths

None.

### Remaining owned paths

None.

## Verification summary

No manual verification summary was supplied.

## Verification attempt history

- **assignment-graph-version: passed.** `node tests/test-engine-graphpackages.js` (96 ms, working-tree@b7b3212d632a835c9a06787b222711c72f85d319)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 0
  - Output:

    stdout: Engine graph package tests passed.
- **working-tree-update: passed.** `node bin/specdev.js update` (146 ms, working-tree@b7b3212d632a835c9a06787b222711c72f85d319)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 0
  - Output:

    stdout: 🔄 Updating SpecDev system files...
    stdout: 
    stdout: Sync complete — everything up to date
    stdout: ✅ SpecDev updated to v0.0.4 (2026-09-01)
    stdout: 
    stdout: 📝 Updated:
    stdout:    ✓ _main.md
       ✓ _index.md
       ✓ workflow.json
    stdout:    ✓ _guides
    stdout:    ✓ _templates
    stdout:    ✓ guides/review.md
       ✓ guides/library
    stdout:    ✓ skills/core
       ✓ skills/README.md
       ✓ workflows
    stdout:    ✓ .claude/skills/ (12 skill files)
       ✓ .codex/skills/ (12 skill files)
    stdout:    ✓ .claude/hooks/specdev-session-start.sh
    
    📌 Preserved:
    stdout:    • project_notes/ (existing documentation preserved; missing Roadmap scaffold added)
    stdout:    • assignments/ (your active work)
       • skills/tools/ (your custom tool skills)
       • missions/ and discussions/ (your durable work)
    stdout:    • test-audits/ and knowledge/ (your durable analysis and guidance)
       • guides/project/ (your project guidance)
    stdout:    • project_scaffolding/ (legacy custom files, if present)
    
    stdout: 💡 Agent profiles live in .specdev/agents.yaml; machine overrides live in ignored cache/agents.local.yaml
    
    stdout: 💡 Your project-owned notes, work, profiles, and guides remain untouched
    💡 For legacy .specdev layouts, run: specdev migrate
    💡 For old assignment root files only, run: specdev migrate legacy-assignments --dry-run
    💡 Check _guides/update_guide.md for manual patches to CLAUDE.md and other unmanaged files
    
    stdout: ✅ Platform adapters are current; update completion requires no agent action

## Current acceptance evidence

- **assignment-graph-version: passed.** `node tests/test-engine-graphpackages.js` (96 ms, working-tree@b7b3212d632a835c9a06787b222711c72f85d319)
- **working-tree-update: passed.** `node bin/specdev.js update` (146 ms, working-tree@b7b3212d632a835c9a06787b222711c72f85d319)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 0
  - Output:

    stdout: 🔄 Updating SpecDev system files...
    stdout: 
    stdout: Sync complete — everything up to date
    stdout: ✅ SpecDev updated to v0.0.4 (2026-09-01)
    stdout: 
    stdout: 📝 Updated:
    stdout:    ✓ _main.md
       ✓ _index.md
       ✓ workflow.json
    stdout:    ✓ _guides
    stdout:    ✓ _templates
    stdout:    ✓ guides/review.md
       ✓ guides/library
    stdout:    ✓ skills/core
       ✓ skills/README.md
       ✓ workflows
    stdout:    ✓ .claude/skills/ (12 skill files)
       ✓ .codex/skills/ (12 skill files)
    stdout:    ✓ .claude/hooks/specdev-session-start.sh
    
    📌 Preserved:
    stdout:    • project_notes/ (existing documentation preserved; missing Roadmap scaffold added)
    stdout:    • assignments/ (your active work)
       • skills/tools/ (your custom tool skills)
       • missions/ and discussions/ (your durable work)
    stdout:    • test-audits/ and knowledge/ (your durable analysis and guidance)
       • guides/project/ (your project guidance)
    stdout:    • project_scaffolding/ (legacy custom files, if present)
    
    stdout: 💡 Agent profiles live in .specdev/agents.yaml; machine overrides live in ignored cache/agents.local.yaml
    
    stdout: 💡 Your project-owned notes, work, profiles, and guides remain untouched
    💡 For legacy .specdev layouts, run: specdev migrate
    💡 For old assignment root files only, run: specdev migrate legacy-assignments --dry-run
    💡 Check _guides/update_guide.md for manual patches to CLAUDE.md and other unmanaged files
    
    stdout: ✅ Platform adapters are current; update completion requires no agent action

## Structured verification

    {
      "version": 1,
      "path_facts": {
        "requested": [],
        "committed": [
          ".claude/skills/specdev-reviewloop/SKILL.md",
          ".codex/skills/specdev-reviewloop/SKILL.md",
          ".specdev/.ripplegraph/registry.json",
          ".specdev/adhoc/2026-09/AH-20260901T061814733Z-9c8a_bump-the-changed-assignment-lifecycle-graph-pack.md",
          ".specdev/workflows/assignment-lifecycle@2.4.0/graph.json",
          ".specdev/workflows/catalog.json",
          "templates/.specdev/workflows/assignment-lifecycle/graph.json",
          "tests/test-engine-graphpackages.js"
        ],
        "rejected": [],
        "remaining": []
      },
      "attempt_history": [
        {
          "version": 1,
          "id": "V-001",
          "label": "assignment-graph-version",
          "annotation": null,
          "command": "node tests/test-engine-graphpackages.js",
          "argv": [
            "node",
            "tests/test-engine-graphpackages.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-09-01T06:19:25.865Z",
          "completed_at": "2026-09-01T06:19:25.961Z",
          "duration_ms": 96,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@b7b3212d632a835c9a06787b222711c72f85d319",
          "output": {
            "text": "stdout: Engine graph package tests passed.",
            "truncated": false,
            "captured_bytes": 35
          }
        },
        {
          "version": 1,
          "id": "V-002",
          "label": "working-tree-update",
          "annotation": null,
          "command": "node bin/specdev.js update",
          "argv": [
            "node",
            "bin/specdev.js",
            "update"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-09-01T06:19:58.876Z",
          "completed_at": "2026-09-01T06:19:59.023Z",
          "duration_ms": 146,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@b7b3212d632a835c9a06787b222711c72f85d319",
          "output": {
            "text": "stdout: 🔄 Updating SpecDev system files...\nstdout: \nstdout: Sync complete — everything up to date\nstdout: ✅ SpecDev updated to v0.0.4 (2026-09-01)\nstdout: \nstdout: 📝 Updated:\nstdout:    ✓ _main.md\n   ✓ _index.md\n   ✓ workflow.json\nstdout:    ✓ _guides\nstdout:    ✓ _templates\nstdout:    ✓ guides/review.md\n   ✓ guides/library\nstdout:    ✓ skills/core\n   ✓ skills/README.md\n   ✓ workflows\nstdout:    ✓ .claude/skills/ (12 skill files)\n   ✓ .codex/skills/ (12 skill files)\nstdout:    ✓ .claude/hooks/specdev-session-start.sh\n\n📌 Preserved:\nstdout:    • project_notes/ (existing documentation preserved; missing Roadmap scaffold added)\nstdout:    • assignments/ (your active work)\n   • skills/tools/ (your custom tool skills)\n   • missions/ and discussions/ (your durable work)\nstdout:    • test-audits/ and knowledge/ (your durable analysis and guidance)\n   • guides/project/ (your project guidance)\nstdout:    • project_scaffolding/ (legacy custom files, if present)\n\nstdout: 💡 Agent profiles live in .specdev/agents.yaml; machine overrides live in ignored cache/agents.local.yaml\n\nstdout: 💡 Your project-owned notes, work, profiles, and guides remain untouched\n💡 For legacy .specdev layouts, run: specdev migrate\n💡 For old assignment root files only, run: specdev migrate legacy-assignments --dry-run\n💡 Check _guides/update_guide.md for manual patches to CLAUDE.md and other unmanaged files\n\nstdout: ✅ Platform adapters are current; update completion requires no agent action",
            "truncated": false,
            "captured_bytes": 1385
          }
        }
      ],
      "acceptance_evidence": [
        {
          "version": 1,
          "id": "V-001",
          "label": "assignment-graph-version",
          "annotation": null,
          "command": "node tests/test-engine-graphpackages.js",
          "argv": [
            "node",
            "tests/test-engine-graphpackages.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-09-01T06:19:25.865Z",
          "completed_at": "2026-09-01T06:19:25.961Z",
          "duration_ms": 96,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@b7b3212d632a835c9a06787b222711c72f85d319",
          "output": {
            "text": "stdout: Engine graph package tests passed.",
            "truncated": false,
            "captured_bytes": 35
          }
        },
        {
          "version": 1,
          "id": "V-002",
          "label": "working-tree-update",
          "annotation": null,
          "command": "node bin/specdev.js update",
          "argv": [
            "node",
            "bin/specdev.js",
            "update"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-09-01T06:19:58.876Z",
          "completed_at": "2026-09-01T06:19:59.023Z",
          "duration_ms": 146,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@b7b3212d632a835c9a06787b222711c72f85d319",
          "output": {
            "text": "stdout: 🔄 Updating SpecDev system files...\nstdout: \nstdout: Sync complete — everything up to date\nstdout: ✅ SpecDev updated to v0.0.4 (2026-09-01)\nstdout: \nstdout: 📝 Updated:\nstdout:    ✓ _main.md\n   ✓ _index.md\n   ✓ workflow.json\nstdout:    ✓ _guides\nstdout:    ✓ _templates\nstdout:    ✓ guides/review.md\n   ✓ guides/library\nstdout:    ✓ skills/core\n   ✓ skills/README.md\n   ✓ workflows\nstdout:    ✓ .claude/skills/ (12 skill files)\n   ✓ .codex/skills/ (12 skill files)\nstdout:    ✓ .claude/hooks/specdev-session-start.sh\n\n📌 Preserved:\nstdout:    • project_notes/ (existing documentation preserved; missing Roadmap scaffold added)\nstdout:    • assignments/ (your active work)\n   • skills/tools/ (your custom tool skills)\n   • missions/ and discussions/ (your durable work)\nstdout:    • test-audits/ and knowledge/ (your durable analysis and guidance)\n   • guides/project/ (your project guidance)\nstdout:    • project_scaffolding/ (legacy custom files, if present)\n\nstdout: 💡 Agent profiles live in .specdev/agents.yaml; machine overrides live in ignored cache/agents.local.yaml\n\nstdout: 💡 Your project-owned notes, work, profiles, and guides remain untouched\n💡 For legacy .specdev layouts, run: specdev migrate\n💡 For old assignment root files only, run: specdev migrate legacy-assignments --dry-run\n💡 Check _guides/update_guide.md for manual patches to CLAUDE.md and other unmanaged files\n\nstdout: ✅ Platform adapters are current; update completion requires no agent action",
            "truncated": false,
            "captured_bytes": 1385
          }
        }
      ]
    }
