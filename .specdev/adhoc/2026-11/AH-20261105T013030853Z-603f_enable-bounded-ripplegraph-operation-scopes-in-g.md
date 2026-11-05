# Adhoc AH-20261105T013030853Z-603f

- Scope: Enable bounded RippleGraph operation scopes in generic transition commands and explicit context forwarding in guided adapters; include the pending RippleGraph dependency update
- Title: Enable scoped RippleGraph package reuse
- Started: 2026-11-05T01:30:30.853Z
- Completed: 2026-11-05T01:34:18.220Z
- Starting working tree: Existing changes adopted with user approval (2 paths).

## Outcome

Enabled short RippleGraph operation scopes for generic do, decide, step, action, and cancel commands. Guided workflow and callable adapters forward optional contexts without changing synchronous callers. Included the approved GitHub RippleGraph pin and registered the focused regression test. All four approved checks passed. The scope test initially counted registry records as graph manifests; corrected the counter and retained the failed attempt and passing rerun. Benchmark: invalid-step command core median 0.582 ms unscoped versus 0.445 ms scoped across 21 alternating batches; not an end-to-end CLI or Mission speed claim. Simplification review: retained existing adapters and one command scope boundary, no new classes or SpecDev cache, shared scoped/unscoped implementation, all affected source files within roadmap caps. Broader semantic-command scope adoption remains deferred pending measurement. Existing previously reported dependency audit findings were not addressed by this bounded change.

## Focused workflow coexistence

No focused Assignment or Mission coexistence was recorded.

## Delivery path facts

### Requested adopted paths

- `package-lock.json`
- `package.json`

### Committed paths

- `.specdev/adhoc/2026-11/AH-20261105T013030853Z-603f_enable-bounded-ripplegraph-operation-scopes-in-g.md`
- `package-lock.json`
- `package.json`
- `src/commands/engine.js`
- `src/utils/callable-sync.js`
- `src/utils/engine-sync.js`
- `tests/test-engine-operation-scope.js`

### Rejected paths

None.

### Remaining owned paths

None.

## Verification summary

No manual verification summary was supplied.

## Verification attempt history

- **operation-scope: failed.** `node tests/test-engine-operation-scope.js --benchmark` (177 ms, working-tree@4929aa89e9b0e609e5f0c4158859ad2f2d2c0d9c)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 1
  - Output:

    stderr: node:internal/modules/run_main:107
        triggerUncaughtException(
        ^
    
    AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    
    3 !== 1
    
        at file:///Users/leiwu/code/oceanwave/lib/specdev-cli/tests/test-engine-operation-scope.js:36:10 {
      generatedMessage: true,
      code: 'ERR_ASSERTION',
      actual: 3,
      expected: 1,
      operator: 'strictEqual',
      diff: 'simple'
    }
    
    Node.js v25.9.0
- **operation-scope: passed.** `node tests/test-engine-operation-scope.js --benchmark` (1464 ms, working-tree@4929aa89e9b0e609e5f0c4158859ad2f2d2c0d9c)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 0
  - Output:

    stdout: Invalid-step command core, median milliseconds: { unscoped: 0.5815608399999996, scoped: 0.4449466799999993 }
    stdout: Engine operation scope checks passed
- **engine-integration: passed.** `node tests/test-engine-integration.js` (33824 ms, working-tree@4929aa89e9b0e609e5f0c4158859ad2f2d2c0d9c)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 0
  - Output:

    stdout: Engine integration tests passed.
- **engine-graphpackages: passed.** `node tests/test-engine-graphpackages.js` (125 ms, working-tree@4929aa89e9b0e609e5f0c4158859ad2f2d2c0d9c)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 0
  - Output:

    stdout: Engine graph package tests passed.
- **engine-packaging: passed.** `node tests/test-engine-packaging.js` (6381 ms, working-tree@4929aa89e9b0e609e5f0c4158859ad2f2d2c0d9c)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 0
  - Output:

    stdout: Engine packaging tests passed.

## Current acceptance evidence

- **operation-scope: passed.** `node tests/test-engine-operation-scope.js --benchmark` (1464 ms, working-tree@4929aa89e9b0e609e5f0c4158859ad2f2d2c0d9c)
- **engine-integration: passed.** `node tests/test-engine-integration.js` (33824 ms, working-tree@4929aa89e9b0e609e5f0c4158859ad2f2d2c0d9c)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 0
  - Output:

    stdout: Engine integration tests passed.
- **engine-graphpackages: passed.** `node tests/test-engine-graphpackages.js` (125 ms, working-tree@4929aa89e9b0e609e5f0c4158859ad2f2d2c0d9c)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 0
  - Output:

    stdout: Engine graph package tests passed.
- **engine-packaging: passed.** `node tests/test-engine-packaging.js` (6381 ms, working-tree@4929aa89e9b0e609e5f0c4158859ad2f2d2c0d9c)
  - Working directory: `/Users/leiwu/code/oceanwave/lib/specdev-cli`
  - Exit status: 0
  - Output:

    stdout: Engine packaging tests passed.

## Structured verification

    {
      "version": 1,
      "path_facts": {
        "requested": [
          "package-lock.json",
          "package.json"
        ],
        "committed": [
          ".specdev/adhoc/2026-11/AH-20261105T013030853Z-603f_enable-bounded-ripplegraph-operation-scopes-in-g.md",
          "package-lock.json",
          "package.json",
          "src/commands/engine.js",
          "src/utils/callable-sync.js",
          "src/utils/engine-sync.js",
          "tests/test-engine-operation-scope.js"
        ],
        "rejected": [],
        "remaining": []
      },
      "attempt_history": [
        {
          "version": 1,
          "id": "V-001",
          "label": "operation-scope",
          "annotation": null,
          "command": "node tests/test-engine-operation-scope.js --benchmark",
          "argv": [
            "node",
            "tests/test-engine-operation-scope.js",
            "--benchmark"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-11-05T01:32:47.511Z",
          "completed_at": "2026-11-05T01:32:47.689Z",
          "duration_ms": 177,
          "exit_status": 1,
          "status": "failed",
          "tested_revision": "working-tree@4929aa89e9b0e609e5f0c4158859ad2f2d2c0d9c",
          "output": {
            "text": "stderr: node:internal/modules/run_main:107\n    triggerUncaughtException(\n    ^\n\nAssertionError [ERR_ASSERTION]: Expected values to be strictly equal:\n\n3 !== 1\n\n    at file:///Users/leiwu/code/oceanwave/lib/specdev-cli/tests/test-engine-operation-scope.js:36:10 {\n  generatedMessage: true,\n  code: 'ERR_ASSERTION',\n  actual: 3,\n  expected: 1,\n  operator: 'strictEqual',\n  diff: 'simple'\n}\n\nNode.js v25.9.0",
            "truncated": false,
            "captured_bytes": 397
          }
        },
        {
          "version": 1,
          "id": "V-002",
          "label": "operation-scope",
          "annotation": null,
          "command": "node tests/test-engine-operation-scope.js --benchmark",
          "argv": [
            "node",
            "tests/test-engine-operation-scope.js",
            "--benchmark"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-11-05T01:33:08.471Z",
          "completed_at": "2026-11-05T01:33:09.936Z",
          "duration_ms": 1464,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@4929aa89e9b0e609e5f0c4158859ad2f2d2c0d9c",
          "output": {
            "text": "stdout: Invalid-step command core, median milliseconds: { unscoped: 0.5815608399999996, scoped: 0.4449466799999993 }\nstdout: Engine operation scope checks passed",
            "truncated": false,
            "captured_bytes": 146
          }
        },
        {
          "version": 1,
          "id": "V-003",
          "label": "engine-integration",
          "annotation": null,
          "command": "node tests/test-engine-integration.js",
          "argv": [
            "node",
            "tests/test-engine-integration.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-11-05T01:33:17.561Z",
          "completed_at": "2026-11-05T01:33:51.386Z",
          "duration_ms": 33824,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@4929aa89e9b0e609e5f0c4158859ad2f2d2c0d9c",
          "output": {
            "text": "stdout: Engine integration tests passed.",
            "truncated": false,
            "captured_bytes": 33
          }
        },
        {
          "version": 1,
          "id": "V-004",
          "label": "engine-graphpackages",
          "annotation": null,
          "command": "node tests/test-engine-graphpackages.js",
          "argv": [
            "node",
            "tests/test-engine-graphpackages.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-11-05T01:33:55.265Z",
          "completed_at": "2026-11-05T01:33:55.391Z",
          "duration_ms": 125,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@4929aa89e9b0e609e5f0c4158859ad2f2d2c0d9c",
          "output": {
            "text": "stdout: Engine graph package tests passed.",
            "truncated": false,
            "captured_bytes": 35
          }
        },
        {
          "version": 1,
          "id": "V-005",
          "label": "engine-packaging",
          "annotation": null,
          "command": "node tests/test-engine-packaging.js",
          "argv": [
            "node",
            "tests/test-engine-packaging.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-11-05T01:33:59.462Z",
          "completed_at": "2026-11-05T01:34:05.844Z",
          "duration_ms": 6381,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@4929aa89e9b0e609e5f0c4158859ad2f2d2c0d9c",
          "output": {
            "text": "stdout: Engine packaging tests passed.",
            "truncated": false,
            "captured_bytes": 31
          }
        }
      ],
      "acceptance_evidence": [
        {
          "version": 1,
          "id": "V-002",
          "label": "operation-scope",
          "annotation": null,
          "command": "node tests/test-engine-operation-scope.js --benchmark",
          "argv": [
            "node",
            "tests/test-engine-operation-scope.js",
            "--benchmark"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-11-05T01:33:08.471Z",
          "completed_at": "2026-11-05T01:33:09.936Z",
          "duration_ms": 1464,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@4929aa89e9b0e609e5f0c4158859ad2f2d2c0d9c",
          "output": {
            "text": "stdout: Invalid-step command core, median milliseconds: { unscoped: 0.5815608399999996, scoped: 0.4449466799999993 }\nstdout: Engine operation scope checks passed",
            "truncated": false,
            "captured_bytes": 146
          }
        },
        {
          "version": 1,
          "id": "V-003",
          "label": "engine-integration",
          "annotation": null,
          "command": "node tests/test-engine-integration.js",
          "argv": [
            "node",
            "tests/test-engine-integration.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-11-05T01:33:17.561Z",
          "completed_at": "2026-11-05T01:33:51.386Z",
          "duration_ms": 33824,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@4929aa89e9b0e609e5f0c4158859ad2f2d2c0d9c",
          "output": {
            "text": "stdout: Engine integration tests passed.",
            "truncated": false,
            "captured_bytes": 33
          }
        },
        {
          "version": 1,
          "id": "V-004",
          "label": "engine-graphpackages",
          "annotation": null,
          "command": "node tests/test-engine-graphpackages.js",
          "argv": [
            "node",
            "tests/test-engine-graphpackages.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-11-05T01:33:55.265Z",
          "completed_at": "2026-11-05T01:33:55.391Z",
          "duration_ms": 125,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@4929aa89e9b0e609e5f0c4158859ad2f2d2c0d9c",
          "output": {
            "text": "stdout: Engine graph package tests passed.",
            "truncated": false,
            "captured_bytes": 35
          }
        },
        {
          "version": 1,
          "id": "V-005",
          "label": "engine-packaging",
          "annotation": null,
          "command": "node tests/test-engine-packaging.js",
          "argv": [
            "node",
            "tests/test-engine-packaging.js"
          ],
          "working_directory": "/Users/leiwu/code/oceanwave/lib/specdev-cli",
          "started_at": "2026-11-05T01:33:59.462Z",
          "completed_at": "2026-11-05T01:34:05.844Z",
          "duration_ms": 6381,
          "exit_status": 0,
          "status": "passed",
          "tested_revision": "working-tree@4929aa89e9b0e609e5f0c4158859ad2f2d2c0d9c",
          "output": {
            "text": "stdout: Engine packaging tests passed.",
            "truncated": false,
            "captured_bytes": 31
          }
        }
      ]
    }
