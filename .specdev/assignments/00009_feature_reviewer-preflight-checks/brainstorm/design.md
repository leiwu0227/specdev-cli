# Reviewer Preflight Checks

## Overview

`specdev reviewloop` currently validates reviewer configuration only as part of running each reviewer. This catches missing config files, invalid JSON, missing command fields, stale feedback, max rounds, reviewer timeouts, and reviewer process failures, but the feedback arrives late and is mixed with execution. This assignment adds a dedicated preflight surface so users and agents can inspect reviewer readiness before paying the cost of launching an external CLI.

The first version should stay small: validate static reviewer config, command binary availability, timeout normalization, and review output directory writability. It should support both human-readable and JSON output. Normal reviewloop execution should also run preflight for the selected reviewer chain and stop before spawning if there are blocking config errors.

## Goals

- Add `specdev reviewloop <phase> --preflight --reviewer=<name[,name]>`.
- Report reviewer config existence, JSON validity, command presence, primary binary availability, timeout value, and review directory writability.
- Return machine-readable JSON with `--json`.
- Run blocking preflight checks automatically before reviewer execution.
- Preserve existing reviewloop behavior and feedback semantics after preflight passes.

## Non-Goals

- Do not attempt to fully parse arbitrary shell commands.
- Do not require all reviewer binaries to be installed when listing available reviewers.
- Do not change reviewer feedback formats, round counters, or approval semantics.
- Do not add provider-specific checks for Codex, Cursor, or Claude beyond binary/config readiness.

## Design

Create a focused preflight utility, likely in `src/utils/reviewer-preflight.js`, that accepts `specdevPath`, `assignmentPath`, `phase`, `reviewerNames`, and output naming context. It should return a structured result:

```js
{
  status: 'pass' | 'fail',
  reviewers: [
    {
      name: 'codex',
      config: 'pass',
      command: 'pass',
      binary: { name: 'codex', found: true },
      timeout_seconds: 900,
      review_dir: 'pass',
      issues: []
    }
  ]
}
```

Blocking failures are missing config, invalid JSON, missing command, invalid timeout if explicitly non-positive/non-numeric, and unwritable review directory. Missing binary should be a warning rather than a hard failure for shell builtins/test commands unless the primary command token is non-empty and `which` cannot find it; tests should pin the chosen behavior. The existing `src/utils/reviewers.js` can either be reused or replaced by this richer preflight utility.

`reviewloopCommand` should route `--preflight` to the preflight output and exit without spawning reviewers. For normal `--reviewer` execution, it should run preflight and stop only on blocking failures.

## Success Criteria

- `specdev reviewloop brainstorm --preflight --reviewer=codex --json` emits valid JSON and does not spawn the reviewer.
- Missing reviewer config and missing command are reported as blocking failures.
- Valid reviewer config with a simple test command passes preflight.
- Normal reviewloop execution still passes existing tests.
- Full `npm test` passes.
