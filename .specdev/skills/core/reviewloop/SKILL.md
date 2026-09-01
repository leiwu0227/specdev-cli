---
name: reviewloop
description: Run interactive reviews or bounded automatic review convergence
type: core
phase: brainstorm, implementation, discussion, mission
---

# Reviewloop

Reviewer capability comes from `.specdev/agents.yaml`, with optional ignored
machine overrides in `.specdev/cache/agents.local.yaml`. Prompts and selected
guides define the temporary review task; there is no reviewer persona picker.

## Brainstorm

Run `specdev reviewloop brainstorm`. The command freezes the contract baseline,
runs the configured reviewer once, and reports the verdict, textual changes,
material-divergence classification, and exact contract hash. Findings return
control to the user; a later explicit invocation may review again without a
round lockout.

Never approve automatically. Show the verdict, exact contract path and hash,
and the command's concise contract-preview bullets to the user. Run `specdev
approve brainstorm` only after explicit agreement.

## Mission Brainstorm

Run `specdev reviewloop mission --mission=M00001`. This optional review has the
same visible baseline, divergence, and exact-hash rules as Assignment Brainstorm
review. It never approves the Mission; approval remains `specdev mission run
M00001 --approve` after the same contract preview and explicit user agreement.

## Implementation

`specdev implement` normally starts implementation review automatically. Direct
resume is `specdev reviewloop implementation`. Review uses two primary rounds,
a conditional third round only while the candidate and findings are changing,
one resolver, and one final arbiter. Inline repair and resolver obligations
return to the foreground implementation owner; spawned execution uses bounded
continuation workers. Approved results and host-validated nonblocking
disagreements may advance; objective failures terminate explicitly.

## Discussion

Run `specdev reviewloop discussion --discussion=D00001`. Review is optional and
does not approve or complete the Discussion. Each invocation runs once and
returns control without a round lockout.

## Rules

- Do not pass `--autocontinue` or choose a reviewer per execution.
- Use `specdev reviewloop` for an authoritative verdict. Native coding-CLI
  review sessions are advisory and cannot advance SpecDev state.
- Reviewers do not repair code.
- Reuse receipts and prefer narrow checks; never run a full suite without exact
  authority.
- Raw provider output belongs in ignored cache, not durable review history.
