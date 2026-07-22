---
name: reviewloop
description: Run the configured reviewer with one repair and one verification rerun
type: core
phase: brainstorm, implementation, discussion, mission
---

# Reviewloop

Reviewer capability comes from `.specdev/agents.yaml`, with optional ignored
machine overrides in `.specdev/cache/agents.local.yaml`. Prompts and selected
guides define the temporary review task; there is no reviewer persona picker.

## Brainstorm

Run `specdev reviewloop brainstorm`. The command freezes the contract baseline,
runs the configured reviewer, and reports the final verdict, textual changes,
material-divergence classification, and exact contract hash. If findings remain,
the current coding CLI edits the contract and reruns the same command once.

Never approve automatically. Show the verdict to the user and run `specdev
approve brainstorm` only after explicit agreement.

## Mission Brainstorm

Run `specdev reviewloop mission --mission=M00001`. This optional review has the
same visible baseline, divergence, and exact-hash rules as Assignment Brainstorm
review. It never approves the Mission; approval remains `specdev mission run
M00001 --approve` after explicit user agreement.

## Implementation

`specdev implement` normally starts implementation review automatically. Direct
resume is `specdev reviewloop implementation`. A blocking first verdict starts
one worker continuation, then the same reviewer verifies once. A second failure
blocks for the user.

## Discussion

Run `specdev reviewloop discussion --discussion=D00001`. Review is optional and
does not approve or complete the Discussion.

## Rules

- Do not pass `--autocontinue` or choose a reviewer per execution.
- Use `specdev reviewloop` for an authoritative verdict. Native coding-CLI
  review sessions are advisory and cannot advance SpecDev state.
- Reviewers do not repair code.
- Reuse receipts and prefer narrow checks; never run a full suite without exact
  authority.
- Raw provider output belongs in ignored cache, not durable review history.
