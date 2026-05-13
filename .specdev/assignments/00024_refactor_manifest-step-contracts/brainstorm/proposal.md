# Manifest Step Contracts — Proposal

## What

Move three pieces of each workflow step's contract from JS code and skill prose into `workflow.yaml`:

1. **Interaction schema** — for steps that need human input, the prompt + choices + reviewer follow-up are declared in the manifest. The CLI and the agent both render from the manifest, byte-identically.
2. **Artifact contract** — every step declares `produces:` and/or `requires:` so `computeNextAction` and `checkpoint` derive missing-artifact blockers from manifest data, not hard-coded per-phase lists.
3. **Continuation contract** — every gate and every approval-emitting command declares `on_satisfied:` with a typed next action and sticky-state keys. After a user picks `reviewloop_autocontinue` + a reviewer at brainstorm, the agent drives all the way through to reviewloop implementation without further prompts.

The same helper renders text and JSON output for all three, so the two surfaces cannot drift.

## Why

Three observable bug classes have the same architectural cause — workflow-step contracts live in JS code and skill prose simultaneously, and the two sources of truth drift apart:

- **Missing / paraphrased choice prompts** at end-of-brainstorm and end-of-implementation. D00003 patched this in 2026-05-11; it regressed during the 00021 workflow-overlay refactor because the contract was still encoded in prose.
- **Random stopping after gates**, typically after `specdev approve brainstorm`. The post-approval continuation rule lives only in skill prose; agents read it inconsistently and stop instead of advancing.
- **Implicit artifact dependencies**, where `checkpoint.js` hard-codes which files each phase requires. Adding or renaming an artifact requires touching JS, the manifest, and skill prose in lockstep.

The architectural lesson borrowed from LangGraph is that interrupts and state contracts are first-class graph data, not node code. SpecDev already has the bones (`workflow.yaml` validation, `computeNextAction`, structured `interaction.choices`). This refactor finishes the push: manifest is the single source of truth, runtime is a thin renderer, skills shrink to a small set of generic rendering rules. Each of the three bug classes becomes structurally impossible without breaking a drift test.
