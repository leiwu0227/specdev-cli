# Investigation: SpecDev Workflow Review

## Overview

This review evaluates SpecDev through two primary goals: faster agent execution and higher workflow reliability. Codebase simplicity matters, but mainly as a way to support those goals. The current workflow is conceptually deterministic: assignments move through brainstorm, breakdown, implementation, and capture, with artifacts and gates at known points. The friction is that much of this deterministic behavior is still encoded as agent-facing prose across `_main.md`, `_guides/workflow.md`, core skills, command skills, templates, and status output.

The recommended direction is an aggressive but simple workflow runtime overlay. Keep the existing `.specdev/` folder structure and assignment layout intact, but add a small declarative workflow manifest plus a command such as `specdev next --json` that computes the canonical next action. The model should use four primitives only: phases, steps, hooks, and gates. Phases remain the current four phases. Steps are ordered, not graph-based. Hooks let projects or plugins insert work at fixed slots, such as `phase:end`, without redefining the core workflow. Gates remain explicit approval or review transitions.

This preserves deterministic behavior because the runtime can compute the next action from assignment state, workflow manifest, registered hooks, and artifact presence. Pluggability comes from constrained hook declarations, not arbitrary plugin code mutating workflow state. The implementation should be an overlay: existing skills, commands, artifacts, and assignment folders continue to work, while new runtime-aware commands gradually reduce how much procedural state the agent must carry.

User interaction points should also become runtime-defined. Today, checkpoint and review guidance often prints several choices in prose, and agents may rephrase or reorder them. The overlay should emit repeatable choice contracts for approval, review, autocontinue, and optional hook decisions. Each choice should have a stable id, label, description, resulting command, and whether it continues automatically. Human-facing output can still be readable, but JSON output should expose the same choices in a structured shape so agents can present them consistently and avoid free-form decision prompts.

The runtime should preserve the gate checks that have worked well so far. Existing `specdev checkpoint <phase>`, `specdev approve <phase>`, `status.json` gate fields, and reviewloop auto-approval should remain valid. Gates become explicit manifest steps rather than implied prose instructions. Hooks may run before or after gates only when registered in known slots, and they must not bypass core approvals.

The main reliability constraints are:

- `specdev next --json` should emit one canonical next action and the evidence required to complete it.
- Hooks should have explicit outcomes: `completed`, `skipped`, `failed`, or `not_applicable`.
- Blocking hooks require validators; advisory hooks should be visible but should not block progress.
- Hook ordering must be stable. Duplicate slot/order conflicts should fail validation instead of being resolved heuristically.
- The installed workflow should declare a contract version so `specdev update` can warn or migrate cleanly.
- Projects without the manifest should keep working through a synthesized default four-phase workflow.
- Status output should include a human-readable trace explaining why the next action was chosen.
- Choice ids should be treated as stable API. Labels can improve; ids should not casually change.

The intentional v1 boundary is simplicity: no custom phases, no DAG execution, no arbitrary plugin JavaScript, and no migration of the existing `.specdev/` layout. The first implementation should prove the overlay with a manifest, runtime next-action computation, structured choices, and one optional hook such as an end-of-implementation repo knowledge prompt.

## Ranked Findings

1. **Agent orchestration is the primary speed and reliability cost.** The workflow asks agents to remember deterministic transitions that the CLI could compute. Assignment creation is the clearest example: `specdev assignment` can create and focus a folder when `--type` and `--slug` are provided, but the generated command skill still sends agents through manual folder creation. The better default is command-created assignment setup, with JSON output that points to the first workflow step.

2. **Runtime contracts are split across prose and commands.** Phase flow is described in `_main.md`, `_guides/workflow.md`, command skills, core skills, and command output, while structured facts live partly in `workflow-contract.js`. This creates drift risk and forces agents to load more text. A small runtime manifest should become the phase/step/hook/gate source of truth, with skills acting as step guides.

3. **Markdown plan parsing is brittle where execution needs structure.** Breakdown requires exact H3 task headings and exact `**Skills:**` formatting because implementation scripts grep markdown. That has already produced workflow feedback around bracketed skills and heading depth. Human-readable markdown can remain, but execution-critical task metadata should have a structured companion or be emitted by a CLI planner command.

4. **User decision points need stable choice output.** Checkpoints currently print choices in prose. This is helpful for humans, but agents may rephrase, reorder, or ask free-form questions. Checkpoints, gates, reviewloop handoffs, and hook decisions should emit stable choice ids, labels, descriptions, and commands in JSON, with human text generated from the same data.

5. **Hooks are the right extension primitive, not custom phases.** Project-specific additions such as "ask to update repo knowledge at the end" should register into known slots. This preserves the four-phase model and keeps status/review/gate semantics understandable. Blocking hooks must declare validators; advisory hooks should be visible but not stop progress.

6. **Capture is useful but can be too heavy for small assignments.** The capture phase currently asks every completed assignment to perform several documentation and distillation steps. The runtime should allow optional advisory hooks for extra knowledge prompts, while preserving mandatory capture only where it produces durable value.

## Recommended Follow-Up Work

The first implementation assignment should be a narrow workflow-runtime proof of concept, not a full rewrite:

- Add `.specdev/workflow.yaml` or equivalent installed manifest while preserving the current folder layout.
- Add a runtime utility that synthesizes the current four-phase workflow when no manifest exists.
- Add `specdev next --json` to return one canonical action, required evidence, blockers, trace, and structured choices.
- Preserve existing `checkpoint`, `approve`, `status`, and `reviewloop` behavior.
- Add one non-blocking hook slot, such as `phase:end` for implementation, and prove it with a repo knowledge prompt.

The second assignment should reduce current friction without waiting for the full runtime:

- Update generated `specdev-assignment` guidance to prefer `specdev assignment "<desc>" --type=<type> --slug=<slug>` for agents.
- Add structured choice JSON to checkpoint output.
- Fix or remove bracket-sensitive skill parsing in implementation scripts.
- Add drift tests that compare manifest choices, command output, and generated skill guidance.

The larger vNext direction can follow after the proof of concept:

- Move execution-critical plan metadata out of grep-parsed markdown.
- Split large phase skills into smaller step guides referenced by runtime actions.
- Add hook validation, ordering checks, and status trace output.
- Treat choice ids, hook slots, phase ids, and gate fields as stable public workflow API.
