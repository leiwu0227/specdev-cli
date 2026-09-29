# Adhoc AH-20260929T003718307Z-976b

- Scope: Simplify guidance placement, static guidance representation, and whitespace-tolerant installation assertion without changing behavior
- Title: Simplify implementation guidance delivery
- Started: 2026-09-29T00:37:18.307Z
- Completed: 2026-09-29T00:38:44.248Z
- Starting working tree: Clean.

## Outcome

Applied the three simplifications in order: moved the unchanged shared guidance to existing implementation, repair, and resolver prompt builders; replaced the constant array/join with a multiline string; made the installation assertion whitespace tolerant. Removed runner phase checks and its assignment-execution dependency. Preserved inline, Mission-child, and review behavior without new classes or runtime I/O. Three authorized focused regressions passed; roadmap constraints retained.

## Focused workflow coexistence

No focused Assignment or Mission coexistence was recorded.

## Delivery path facts

### Requested adopted paths

None.

### Committed paths

- `.specdev/adhoc/2026-09/AH-20260929T003718307Z-976b_simplify-guidance-placement-static-guidance-repr.md`
- `src/commands/implement.js`
- `src/commands/reviewloop.js`
- `src/utils/assignment-execution.js`
- `src/utils/spawned-agent.js`
- `tests/test-update-skill-roots.js`

### Rejected paths

None.

### Remaining owned paths

None.

## Verification summary

No manual verification summary was supplied.

## Verification attempt history

- **guidance-context: passed.** `node tests/test-assignment-context.js` (155 ms, working-tree@f281e4de1fbd152af380c0db89f788d2aca1e690)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 0
  - Output:

    stdout: assignment context tests passed
- **guidance-recovery: passed.** `node tests/test-implement-recovery.js` (24570 ms, working-tree@f281e4de1fbd152af380c0db89f788d2aca1e690)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 0
  - Output:

    stdout: implement recovery tests passed
- **guidance-installation: passed.** `node tests/test-update-skill-roots.js` (395 ms, working-tree@f281e4de1fbd152af380c0db89f788d2aca1e690)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 0
  - Output:

    stdout: Update skill-root migration tests passed.

## Current acceptance evidence

- **guidance-context: passed.** `node tests/test-assignment-context.js` (155 ms, working-tree@f281e4de1fbd152af380c0db89f788d2aca1e690)
- **guidance-recovery: passed.** `node tests/test-implement-recovery.js` (24570 ms, working-tree@f281e4de1fbd152af380c0db89f788d2aca1e690)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 0
  - Output:

    stdout: implement recovery tests passed
- **guidance-installation: passed.** `node tests/test-update-skill-roots.js` (395 ms, working-tree@f281e4de1fbd152af380c0db89f788d2aca1e690)
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
          ".specdev/adhoc/2026-09/AH-20260929T003718307Z-976b_simplify-guidance-placement-static-guidance-repr.md",
          "src/commands/implement.js",
          "src/commands/reviewloop.js",
          "src/utils/assignment-execution.js",
          "src/utils/spawned-agent.js",
          "tests/test-update-skill-roots.js"
        ],
        "rejected": [],
        "remaining": []
      },
      "attempt_history": [
        {
          "version": 1,
          "id": "V-001",
          "label": "guidance-context",
          "annotation": null,
          "command": "node tests/test-assignment-context.js",
          "argv": [
            "node",
            "tests/test-assignment-context.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-09-29T00:38:08.126Z",
          "completed_at": "2026-09-29T00:38:08.281Z",
          "duration_ms": 155,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@f281e4de1fbd152af380c0db89f788d2aca1e690",
          "output": {
            "text": "stdout: assignment context tests passed",
            "truncated": false,
            "captured_bytes": 32
          }
        },
        {
          "version": 1,
          "id": "V-002",
          "label": "guidance-recovery",
          "annotation": null,
          "command": "node tests/test-implement-recovery.js",
          "argv": [
            "node",
            "tests/test-implement-recovery.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-09-29T00:38:08.487Z",
          "completed_at": "2026-09-29T00:38:33.057Z",
          "duration_ms": 24570,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@f281e4de1fbd152af380c0db89f788d2aca1e690",
          "output": {
            "text": "stdout: implement recovery tests passed",
            "truncated": false,
            "captured_bytes": 32
          }
        },
        {
          "version": 1,
          "id": "V-003",
          "label": "guidance-installation",
          "annotation": null,
          "command": "node tests/test-update-skill-roots.js",
          "argv": [
            "node",
            "tests/test-update-skill-roots.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-09-29T00:38:36.710Z",
          "completed_at": "2026-09-29T00:38:37.106Z",
          "duration_ms": 395,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@f281e4de1fbd152af380c0db89f788d2aca1e690",
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
          "label": "guidance-context",
          "annotation": null,
          "command": "node tests/test-assignment-context.js",
          "argv": [
            "node",
            "tests/test-assignment-context.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-09-29T00:38:08.126Z",
          "completed_at": "2026-09-29T00:38:08.281Z",
          "duration_ms": 155,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@f281e4de1fbd152af380c0db89f788d2aca1e690",
          "output": {
            "text": "stdout: assignment context tests passed",
            "truncated": false,
            "captured_bytes": 32
          }
        },
        {
          "version": 1,
          "id": "V-002",
          "label": "guidance-recovery",
          "annotation": null,
          "command": "node tests/test-implement-recovery.js",
          "argv": [
            "node",
            "tests/test-implement-recovery.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-09-29T00:38:08.487Z",
          "completed_at": "2026-09-29T00:38:33.057Z",
          "duration_ms": 24570,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@f281e4de1fbd152af380c0db89f788d2aca1e690",
          "output": {
            "text": "stdout: implement recovery tests passed",
            "truncated": false,
            "captured_bytes": 32
          }
        },
        {
          "version": 1,
          "id": "V-003",
          "label": "guidance-installation",
          "annotation": null,
          "command": "node tests/test-update-skill-roots.js",
          "argv": [
            "node",
            "tests/test-update-skill-roots.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-09-29T00:38:36.710Z",
          "completed_at": "2026-09-29T00:38:37.106Z",
          "duration_ms": 395,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@f281e4de1fbd152af380c0db89f788d2aca1e690",
          "output": {
            "text": "stdout: Update skill-root migration tests passed.",
            "truncated": false,
            "captured_bytes": 42
          }
        }
      ]
    }
