# Thin Runtime Guidance Design

## Overview

This refactor makes the workflow runtime overlay the primary navigation layer for agents. After assignment creation or resume, agents should be directed to `specdev next --json` for the canonical next action instead of re-reading scattered prose to infer phase, guide, gate, and review choices. The existing skills and guides stay in place, but their role becomes narrower: they explain how to perform the returned step, not how to rediscover the workflow state machine.

The implementation also thins the most expensive parts of the agent contract. Breakdown now produces concise task contracts instead of pre-writing full test and implementation code. Implementation verification scales by task mode. Knowledge capture becomes optional phase-end guidance instead of a mandatory terminal distillation phase.

## Non-Goals

- Do not change the `.specdev/assignments/<id>/brainstorm|breakdown|implementation|capture` structure.
- Do not add custom phases, DAG execution, arbitrary plugin JavaScript, or a new planner format.
- Do not weaken existing checkpoint, approval, or reviewloop gates.
- Do not delete useful human documentation just to make files shorter.
- Do not migrate installed `.specdev/` runtime state unless explicitly running or documenting `specdev update`.

## Design

Use a three-layer guidance model.

First, `_main.md` should become a compact orientation document. It should tell agents to read project context, identify the active assignment, then call `specdev next --json` for current workflow navigation. It should retain hard rules such as phase order, no completion claims without evidence, and "Specdev:" announcements, but stop duplicating detailed phase procedures already encoded in the runtime or step skills.

Second, `_guides/workflow.md` should become a human-readable reference for the runtime contract rather than a parallel state machine. It should explain the four phases, gates, artifacts, and runtime command, then point to `workflow.yaml` and `specdev next --json` for canonical action selection. The guide can still document recovery and manual override paths, but it should not compete with the runtime output.

Third, generated command skills should use `specdev next --json` as the handoff after setup or resume. `specdev-assignment` already points in this direction, but `specdev-continue`, `specdev-rewind`, and reviewloop/autocontinue prose should be checked for duplicated transition instructions. Where possible, replace procedural chains with "run the command, then follow returned next action/contract." Core phase skills should stay focused on producing artifacts for their phase.

Fourth, breakdown and implementation should use a lighter task model. Tasks declare `Mode`, `Files`, `Work`, `Verify`, `Test Budget`, and `Test Pruning`. `lightweight` tasks do not run per-task executable tests and defer executable verification to final assignment verification. `standard` tasks use focused tests for behavior changes. `full` tasks keep strict TDD and reviewer handoff for risky work.

Fifth, knowledge capture should be optional and phase-end. The runtime should complete the assignment after implementation approval, while exposing non-blocking phase-end hooks that can suggest durable knowledge capture. Before writing knowledge, agents must search existing notes and prune or replace stale/duplicate content instead of accumulating new notes by default. `distill` remains only as a legacy helper for old capture diffs.

Testing should stay narrow. Update drift tests and checkpoint tests to pin the intended guidance surfaces: `_main.md` mentions `specdev next --json`, generated assignment/continue skills use the runtime handoff, workflow docs still list required artifacts and gate fields, and `specdev next --json` reports completion after implementation approval while surfacing advisory knowledge hooks.

## Success Criteria

- Agents have a repeatable entrypoint: after assignment creation, resume, approval, or reviewloop autocontinue, guidance points to `specdev next --json` or an explicit runtime contract.
- `_main.md` and `_guides/workflow.md` are shorter or at least less duplicative, with phase mechanics delegated to `workflow.yaml`, runtime output, and step skills.
- Generated command skills no longer ask agents to manually infer folder/phase transitions where the CLI can compute them.
- Existing gate behavior remains unchanged: `specdev checkpoint`, `specdev approve`, and `specdev reviewloop --autocontinue` still work.
- Breakdown no longer requires full test/implementation code blocks for every task.
- Lightweight tasks defer executable tests to final verification, and test changes prefer prune-and-replace.
- Implementation approval completes the assignment, with knowledge capture available as optional phase-end guidance.
- Focused tests cover the high-value guidance drift points without expanding the suite significantly.
