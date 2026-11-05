# Adhoc AH-20261105T014231905Z-73e8

- Scope: Add explicit preview/apply recovery for empty callable runtime directories, preserve substantive or unsafe entries, and repair the six inspected local remnants
- Title: Recover empty callable runtime remnants
- Started: 2026-11-05T01:42:31.905Z
- Completed: 2026-11-05T01:46:20.769Z
- Starting working tree: Clean.

## Outcome

Added explicit cleanup --empty-calls preview/apply recovery. Requires quiescent Attempts, preserves all files and symlinks, and uses existing empty-directory removal without inferring terminal lifecycle authority. Added regression coverage for preview, new data after preview, retained checkpoints and evidence, symlinks, ambiguous Attempt state, idempotence, status recovery, ordinary cleanup, and flag validation. Both approved tests passed. Applied local-source recovery to exactly D00009 and D00016 through D00020; all six data-bearing calls remained. Local and installed update --status now return ok with no pending operations; repeat empty-call preview has zero candidates. Simplification checkpoint: reused existing quiescence and safe filesystem helpers, no new classes or duplicate test-only production path; ordinary terminal cleanup stays separate from empty-shell recovery. Installed documentation was checkpointed before Adhoc in 45966d2.

## Focused workflow coexistence

No focused Assignment or Mission coexistence was recorded.

## Delivery path facts

### Requested adopted paths

None.

### Committed paths

- `.specdev/adhoc/2026-11/AH-20261105T014231905Z-73e8_add-explicit-preview-apply-recovery-for-empty-ca.md`
- `package.json`
- `src/commands/cleanup.js`
- `src/utils/cleanup.js`
- `src/utils/commands.js`
- `templates/.specdev/_guides/runtime.md`
- `templates/.specdev/_index.md`
- `tests/test-cleanup-empty-calls.js`

### Rejected paths

None.

### Remaining owned paths

None.

## Verification summary

Read-only local and installed update --status returned ok; repeat recovery preview has zero candidates; git diff --check passed.

## Verification attempt history

- **empty-call-recovery: passed.** `node tests/test-cleanup-empty-calls.js` (1344 ms, working-tree@45966d220f2a2edb5831adc0394dbe3325d12697)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 0
  - Output:

    stdout: Empty callable recovery checks passed
- **vnext-foundations: passed.** `node tests/test-vnext-foundations.js` (3353 ms, working-tree@45966d220f2a2edb5831adc0394dbe3325d12697)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 0
  - Output:

    stderr: SpecDev Attempt-00001: reviewer agent started (claude/fixture).
    stderr: SpecDev Attempt-00001 progress: reviewer; 0s elapsed; process live_local; logs quiet; milestone none; state command_or_output_active; fresh.
    stderr: SpecDev Attempt-00001: agent finished after 1s.
    stderr: SpecDev Attempt-00002: reviewer agent started (claude/fixture).
    stderr: SpecDev Attempt-00002 progress: reviewer; 0s elapsed; process live_local; logs quiet; milestone none; state command_or_output_active; fresh.
    stderr: SpecDev Attempt-00002: agent finished after 1s.
    stderr: SpecDev Attempt-00003: reviewer agent started (claude/fixture).
    stderr: SpecDev Attempt-00003 progress: reviewer; 0s elapsed; process live_local; logs quiet; milestone none; state command_or_output_active; fresh.
    stderr: SpecDev Attempt-00003: agent finished after 1s.
    stderr: SpecDev Attempt-00004: reviewer agent started (claude/fixture).
    stderr: SpecDev Attempt-00004 progress: reviewer; 0s elapsed; process live_local; logs quiet; milestone none; state command_or_output_active; fresh.
    stderr: SpecDev Attempt-00004: agent finished after 1s.
    stdout: vNext foundation tests passed.

## Current acceptance evidence

- **empty-call-recovery: passed.** `node tests/test-cleanup-empty-calls.js` (1344 ms, working-tree@45966d220f2a2edb5831adc0394dbe3325d12697)
- **vnext-foundations: passed.** `node tests/test-vnext-foundations.js` (3353 ms, working-tree@45966d220f2a2edb5831adc0394dbe3325d12697)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 0
  - Output:

    stderr: SpecDev Attempt-00001: reviewer agent started (claude/fixture).
    stderr: SpecDev Attempt-00001 progress: reviewer; 0s elapsed; process live_local; logs quiet; milestone none; state command_or_output_active; fresh.
    stderr: SpecDev Attempt-00001: agent finished after 1s.
    stderr: SpecDev Attempt-00002: reviewer agent started (claude/fixture).
    stderr: SpecDev Attempt-00002 progress: reviewer; 0s elapsed; process live_local; logs quiet; milestone none; state command_or_output_active; fresh.
    stderr: SpecDev Attempt-00002: agent finished after 1s.
    stderr: SpecDev Attempt-00003: reviewer agent started (claude/fixture).
    stderr: SpecDev Attempt-00003 progress: reviewer; 0s elapsed; process live_local; logs quiet; milestone none; state command_or_output_active; fresh.
    stderr: SpecDev Attempt-00003: agent finished after 1s.
    stderr: SpecDev Attempt-00004: reviewer agent started (claude/fixture).
    stderr: SpecDev Attempt-00004 progress: reviewer; 0s elapsed; process live_local; logs quiet; milestone none; state command_or_output_active; fresh.
    stderr: SpecDev Attempt-00004: agent finished after 1s.
    stdout: vNext foundation tests passed.

## Structured verification

    {
      "version": 1,
      "path_facts": {
        "requested": [],
        "committed": [
          ".specdev/adhoc/2026-11/AH-20261105T014231905Z-73e8_add-explicit-preview-apply-recovery-for-empty-ca.md",
          "package.json",
          "src/commands/cleanup.js",
          "src/utils/cleanup.js",
          "src/utils/commands.js",
          "templates/.specdev/_guides/runtime.md",
          "templates/.specdev/_index.md",
          "tests/test-cleanup-empty-calls.js"
        ],
        "rejected": [],
        "remaining": []
      },
      "attempt_history": [
        {
          "version": 1,
          "id": "V-001",
          "label": "empty-call-recovery",
          "annotation": null,
          "command": "node tests/test-cleanup-empty-calls.js",
          "argv": [
            "node",
            "tests/test-cleanup-empty-calls.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-11-05T01:45:45.954Z",
          "completed_at": "2026-11-05T01:45:47.299Z",
          "duration_ms": 1344,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@45966d220f2a2edb5831adc0394dbe3325d12697",
          "output": {
            "text": "stdout: Empty callable recovery checks passed",
            "truncated": false,
            "captured_bytes": 38
          }
        },
        {
          "version": 1,
          "id": "V-002",
          "label": "vnext-foundations",
          "annotation": null,
          "command": "node tests/test-vnext-foundations.js",
          "argv": [
            "node",
            "tests/test-vnext-foundations.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-11-05T01:45:53.502Z",
          "completed_at": "2026-11-05T01:45:56.855Z",
          "duration_ms": 3353,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@45966d220f2a2edb5831adc0394dbe3325d12697",
          "output": {
            "text": "stderr: SpecDev Attempt-00001: reviewer agent started (claude/fixture).\nstderr: SpecDev Attempt-00001 progress: reviewer; 0s elapsed; process live_local; logs quiet; milestone none; state command_or_output_active; fresh.\nstderr: SpecDev Attempt-00001: agent finished after 1s.\nstderr: SpecDev Attempt-00002: reviewer agent started (claude/fixture).\nstderr: SpecDev Attempt-00002 progress: reviewer; 0s elapsed; process live_local; logs quiet; milestone none; state command_or_output_active; fresh.\nstderr: SpecDev Attempt-00002: agent finished after 1s.\nstderr: SpecDev Attempt-00003: reviewer agent started (claude/fixture).\nstderr: SpecDev Attempt-00003 progress: reviewer; 0s elapsed; process live_local; logs quiet; milestone none; state command_or_output_active; fresh.\nstderr: SpecDev Attempt-00003: agent finished after 1s.\nstderr: SpecDev Attempt-00004: reviewer agent started (claude/fixture).\nstderr: SpecDev Attempt-00004 progress: reviewer; 0s elapsed; process live_local; logs quiet; milestone none; state command_or_output_active; fresh.\nstderr: SpecDev Attempt-00004: agent finished after 1s.\nstdout: vNext foundation tests passed.",
            "truncated": false,
            "captured_bytes": 1043
          }
        }
      ],
      "acceptance_evidence": [
        {
          "version": 1,
          "id": "V-001",
          "label": "empty-call-recovery",
          "annotation": null,
          "command": "node tests/test-cleanup-empty-calls.js",
          "argv": [
            "node",
            "tests/test-cleanup-empty-calls.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-11-05T01:45:45.954Z",
          "completed_at": "2026-11-05T01:45:47.299Z",
          "duration_ms": 1344,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@45966d220f2a2edb5831adc0394dbe3325d12697",
          "output": {
            "text": "stdout: Empty callable recovery checks passed",
            "truncated": false,
            "captured_bytes": 38
          }
        },
        {
          "version": 1,
          "id": "V-002",
          "label": "vnext-foundations",
          "annotation": null,
          "command": "node tests/test-vnext-foundations.js",
          "argv": [
            "node",
            "tests/test-vnext-foundations.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-11-05T01:45:53.502Z",
          "completed_at": "2026-11-05T01:45:56.855Z",
          "duration_ms": 3353,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@45966d220f2a2edb5831adc0394dbe3325d12697",
          "output": {
            "text": "stderr: SpecDev Attempt-00001: reviewer agent started (claude/fixture).\nstderr: SpecDev Attempt-00001 progress: reviewer; 0s elapsed; process live_local; logs quiet; milestone none; state command_or_output_active; fresh.\nstderr: SpecDev Attempt-00001: agent finished after 1s.\nstderr: SpecDev Attempt-00002: reviewer agent started (claude/fixture).\nstderr: SpecDev Attempt-00002 progress: reviewer; 0s elapsed; process live_local; logs quiet; milestone none; state command_or_output_active; fresh.\nstderr: SpecDev Attempt-00002: agent finished after 1s.\nstderr: SpecDev Attempt-00003: reviewer agent started (claude/fixture).\nstderr: SpecDev Attempt-00003 progress: reviewer; 0s elapsed; process live_local; logs quiet; milestone none; state command_or_output_active; fresh.\nstderr: SpecDev Attempt-00003: agent finished after 1s.\nstderr: SpecDev Attempt-00004: reviewer agent started (claude/fixture).\nstderr: SpecDev Attempt-00004 progress: reviewer; 0s elapsed; process live_local; logs quiet; milestone none; state command_or_output_active; fresh.\nstderr: SpecDev Attempt-00004: agent finished after 1s.\nstdout: vNext foundation tests passed.",
            "truncated": false,
            "captured_bytes": 1043
          }
        }
      ]
    }
