# Reduce Test Suite Design

## Overview

Reduce the test suite from a broad collection of narrow files to a smaller, faster smoke/regression suite focused on SpecDev's highest-risk user workflows. The goal is not to preserve every edge-case assertion. It is to keep enough coverage to catch broken installs, assignment state, phase gates, reviewloop behavior, update behavior, and knowledge/capture basics while removing redundant, low-value, or implementation-detail tests.

The selected reduction level is "massive reduction": keep roughly 8-12 top-level test files and delete or merge the rest. This should make `npm test` materially faster and easier for automated reviewers to run, while preserving confidence around workflows that would block real users.

## Non-Goals

- Do not keep one test file per source module.
- Do not preserve every edge-case assertion from deleted tests.
- Do not rewrite the CLI or production architecture as part of this refactor.
- Do not add a new test framework.
- Do not delete tests that are the only coverage for install/update safety, phase gate correctness, or reviewloop approval/failure mechanics.
- Do not touch unrelated dirty `.specdev`, `.claude`, or `.codex` runtime/update files unless a test cleanup requires source-of-truth changes.

## Design

The target suite should keep a small number of command-oriented files:

- Keep `tests/test-init.js` for install/template/adapter smoke coverage.
- Keep `tests/test-assignment.js` or a reduced successor for assignment creation and `.current` behavior.
- Keep `tests/test-checkpoints.js` for brainstorm/implementation gate structure and discussion checkpoint behavior.
- Keep `tests/test-approve-phase.js` for hard gate approval semantics.
- Keep a heavily reduced `tests/test-reviewloop-command.js` for reviewer listing, preflight blocking, approved/needs-changes verdicts, autocontinue contract output, discussion exclusion, and one timeout/log smoke case.
- Keep one reviewloop utility test file only if needed for reviewer-runner timeout behavior; otherwise merge a small runner smoke check into the command test.
- Keep `tests/test-update.js` for update preserving/restoring managed template behavior.
- Keep one knowledge/capture test file, combining essentials from `test-knowledge.js`, `test-distill.js`, and `test-memory.js` if practical.
- Keep one lightweight workflow-agent smoke test, combining essentials from `test-agent-runner.js`, `test-agents-inspect.js`, and `test-research.js`. This should cover agent spec validation, one successful runner invocation, retry or malformed-output preservation, `specdev research` artifact creation, and `specdev agents inspect --json`. Drop implementation-detail checks such as full timeout mechanics, subsumption string scans, and duplicate edge cases unless they are needed for a user-facing failure mode.
- Keep one lightweight contract/drift smoke test if it guards generated command-skill drift that command tests do not cover.

Likely deletion or merge candidates:

- `test-json-simple.js` and `test-json-medium.js` can be deleted unless they cover unique JSON parsing behavior not covered by command tests.
- Tiny utility tests like `test-current.js`, `test-focus.js`, `test-discussion.js`, and `test-discuss.js` can be merged into assignment/current smoke coverage.
- Narrow reviewloop helper tests (`test-review-focus.js`, `test-reviewloop-focus.js`, `test-reviewloop-stream-json.js`, `test-reviewloop-runner.js`) can be deleted or reduced to one runner/log smoke path if command tests already exercise the behavior.
- Agent-specific tests should be merged into the retained workflow-agent smoke test. `test-agent-runner-subsumption.js` and narrow runner edge cases can be deleted because the retained smoke path covers the shipped `research` / `agents inspect` surfaces without preserving every internal runner assertion.
- `test-context.js`, `test-host-detection.js`, `test-scan.js`, `test-utils.js`, and `test-scripts.js` can be deleted if their behavior is either simple, implementation-detail oriented, or covered by end-to-end command tests.

Implementation should update `package.json` scripts to remove deleted test entries and make `npm test` run only the retained suite plus cleanup. If files are merged, prefer simple command-level assertions over detailed internal assertions.

## Success Criteria

- `npm test` runs a much smaller set of test files, targeting roughly 8-12 files.
- Deleted tests are removed from `package.json` scripts and cleanup paths.
- Retained tests cover:
  - init/update source-of-truth behavior
  - assignment/current state
  - brainstorm and implementation checkpoints
  - approve gates
  - reviewloop pass/fail and autocontinue contract
  - workflow-agent smoke coverage for `research`, `agents inspect`, and agent runner validation
  - knowledge/distill basics
- `npm test` completes successfully in this environment without reviewloop-command hangs.
- `package.json` `releaseDate` remains set to the current date before commit.
