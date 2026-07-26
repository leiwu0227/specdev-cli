---
name: specdev-reviewloop
description: Run interactive review or bounded automatic convergence
---

Reviewer provider, model, effort, and timeout come from
`.specdev/agents.yaml` plus optional ignored local overrides. Do not ask the
user to choose a reviewer per execution and do not pass `--autocontinue`.

- Brainstorm: `specdev reviewloop brainstorm`; never auto-approve.
- Mission Brainstorm: `specdev reviewloop mission --mission=M00001`; never
  auto-approve.
- Implementation: normally invoked by `specdev implement`; finite primary,
  conditional, resolver, and arbiter stages are automatic.
- Discussion: `specdev reviewloop discussion --discussion=D00001`.

For Assignment or Mission Brainstorm approval, show the exact contract path and
hash plus the command's concise contract-preview bullets before asking the user
to agree.

Only `specdev reviewloop` produces a transition-authorizing strict result
envelope. Native coding-CLI review sessions are advisory and cannot advance
SpecDev state.

Announce every subtask with "Specdev: <action>".
