# Adhoc AH-20261030T071542143Z-f16a

- Scope: Reuse the confirmed snapshot status instead of duplicating original recovery status
- Title: Remove duplicate recovery status
- Started: 2026-10-30T07:15:42.143Z
- Completed: 2026-10-30T07:16:37.264Z
- Starting working tree: Clean.

## Outcome

Use the confirmed plan snapshot status for retry capture and stop storing duplicate original_status. Existing plans and digests remain unchanged. Boundary tests passed, including new pending records and old-style records carrying the unused extra field. Simplification checkpoint: remove redundant durable data without a migration or compatibility branch.

## Focused workflow coexistence

No focused Assignment or Mission coexistence was recorded.

## Delivery path facts

### Requested adopted paths

None.

### Committed paths

- `.specdev/adhoc/2026-10/AH-20261030T071542143Z-f16a_reuse-the-confirmed-snapshot-status-instead-of-d.md`
- `src/commands/assignment-boundary.js`
- `tests/test-assignment-boundary.js`

### Rejected paths

None.

### Remaining owned paths

None.

## Verification summary

No manual verification summary was supplied.

## Verification attempt history

- **assignment-boundary: passed.** `node tests/test-assignment-boundary.js` (15681 ms, working-tree@bab47696ea3c2c0e279bacc5407539559a2c8de4)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 0
  - Output:

    stderr: Switched to a new branch 'divergent'
    stdout: Assignment boundary recovery tests passed.

## Current acceptance evidence

- **assignment-boundary: passed.** `node tests/test-assignment-boundary.js` (15681 ms, working-tree@bab47696ea3c2c0e279bacc5407539559a2c8de4)

## Structured verification

    {
      "version": 1,
      "path_facts": {
        "requested": [],
        "committed": [
          ".specdev/adhoc/2026-10/AH-20261030T071542143Z-f16a_reuse-the-confirmed-snapshot-status-instead-of-d.md",
          "src/commands/assignment-boundary.js",
          "tests/test-assignment-boundary.js"
        ],
        "rejected": [],
        "remaining": []
      },
      "attempt_history": [
        {
          "version": 1,
          "id": "V-001",
          "label": "assignment-boundary",
          "annotation": null,
          "command": "node tests/test-assignment-boundary.js",
          "argv": [
            "node",
            "tests/test-assignment-boundary.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-10-30T07:15:53.403Z",
          "completed_at": "2026-10-30T07:16:09.085Z",
          "duration_ms": 15681,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@bab47696ea3c2c0e279bacc5407539559a2c8de4",
          "output": {
            "text": "stderr: Switched to a new branch 'divergent'\nstdout: Assignment boundary recovery tests passed.",
            "truncated": false,
            "captured_bytes": 80
          }
        }
      ],
      "acceptance_evidence": [
        {
          "version": 1,
          "id": "V-001",
          "label": "assignment-boundary",
          "annotation": null,
          "command": "node tests/test-assignment-boundary.js",
          "argv": [
            "node",
            "tests/test-assignment-boundary.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-10-30T07:15:53.403Z",
          "completed_at": "2026-10-30T07:16:09.085Z",
          "duration_ms": 15681,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@bab47696ea3c2c0e279bacc5407539559a2c8de4",
          "output": {
            "text": "stderr: Switched to a new branch 'divergent'\nstdout: Assignment boundary recovery tests passed.",
            "truncated": false,
            "captured_bytes": 80
          }
        }
      ]
    }
