# Autocontinue After Reviewloop Approval Design

## Overview

SpecDev’s desired user experience is interactive early and autonomous later. During brainstorm, the user should shape scope, tradeoffs, and success criteria. After the user chooses automated brainstorm review, a passing external review should be enough authorization for the coding agent to carry the assignment forward without asking the user to type command after command.

The proposed interface is:

```bash
specdev reviewloop brainstorm --reviewer=codex --autocontinue
```

This keeps the trigger attached to the user’s actual intent: review the brainstorm with a chosen reviewer, and if it passes, keep going. It avoids overloading `specdev continue --auto`, which can be confusing because the important user decision is reviewer-backed approval, not generic continuation.

The feature should not remove gates. It should make a clear distinction between approval conditions and human interaction points. `reviewloop` still owns review mechanics and phase approval. `--autocontinue` only controls what the main agent does after review approval.

## Goals

- Add an explicit low-interaction path after brainstorm reviewloop approval.
- Preserve existing hard gates: brainstorm and implementation still require either review-backed approval or explicit manual approval.
- Reuse the reviewer selected for brainstorm when later running implementation reviewloop.
- Minimize user command typing after brainstorm while keeping predictable pauses for real blockers.
- Keep single-phase reviewloop behavior unchanged unless `--autocontinue` is present.
- Make the behavior clear in agent-facing skills and CLI output so agents proceed instead of handing command strings back to the user.

## Non-Goals

- Do not make all `reviewloop` invocations automatically continue by default.
- Do not replace `specdev continue`, `specdev approve`, `specdev checkpoint`, or single-phase `reviewloop`.
- Do not skip implementation review in autonomous mode.
- Do not weaken max-round escalation, checkpoint validation, or review feedback handling.
- Do not make discussion reviewloop autocontinue into assignments; discussions remain standalone.

## Design

## Recommended Flow

For brainstorm:

1. User and agent complete brainstorm artifacts.
2. User or agent runs:

   ```bash
   specdev reviewloop brainstorm --reviewer=codex --autocontinue
   ```

3. If brainstorm review returns `needs-changes`, the agent follows the existing reviewloop repair flow:
   - run `specdev check-review brainstorm`
   - address findings
   - write the brainstorm changelog
   - rerun reviewloop
   - stop only at max rounds or unresolved ambiguity
4. If brainstorm review is approved, `reviewloop` auto-approves brainstorm as it does today.
5. The agent immediately follows breakdown skill instructions.
6. Breakdown writes `breakdown/plan.md` and starts implementation as required by the breakdown skill.
7. Implementation completes all plan tasks and runs final tests.
8. Instead of asking the user what to do, autonomous mode runs implementation checkpoint and reviewloop with the same reviewer.
9. If implementation review is approved, `reviewloop` auto-approves implementation.
10. The agent immediately runs knowledge capture and `specdev distill done`.

For implementation:

```bash
specdev reviewloop implementation --reviewer=codex --autocontinue
```

This should mean: if implementation review passes, proceed through knowledge capture and finalize. This is useful when a session is already sitting at implementation checkpoint ready.

## Command Semantics

`specdev reviewloop <phase> --reviewer=<name>` remains the single-phase command:

- run the reviewer
- process feedback
- auto-approve the phase on pass
- print next state/action
- do not imply whole-assignment orchestration

`specdev reviewloop <phase> --reviewer=<name> --autocontinue` means:

- run the same phase review behavior
- only continue after the review result approves the phase
- keep using `<name>` as the default reviewer for later reviewloop phases
- pause when a genuine user decision is needed

The key rule:

> `--autocontinue` only activates after review approval. It must never skip or weaken reviewloop.

## Pause Policy

Autocontinue should pause on:

- reviewer max rounds reached
- reviewer preflight failure, missing config, missing binary, timeout, or malformed feedback
- tests fail and the agent cannot resolve them
- review findings imply a significant scope/design digression
- design revision mismatch requires re-breakdown and the correct action is ambiguous
- destructive migration or file operation requires user approval
- implementation would materially exceed approved brainstorm scope
- user explicitly asks to stop or review manually

Autocontinue should not pause for:

- transition from brainstorm approval to breakdown
- transition from breakdown to implementation
- batch progress summaries during implementation
- transition from implementation approval to knowledge capture
- ordinary `check-review -> fix -> rerun reviewloop` cycles within round limits

## Implementation Shape

The smallest implementation path is mostly orchestration and instruction updates:

- Add `--autocontinue` flag handling to `src/commands/reviewloop.js`.
- After approved brainstorm review, emit an explicit autocontinue instruction instead of a user handoff.
- Add an agent-facing workflow contract that says the main agent must continue to breakdown/implementation when `--autocontinue` was used. In this repo, implement that in source-of-truth files, not installed runtime files:
  - `templates/.specdev/skills/core/reviewloop/SKILL.md` for the core reviewloop skill installed by `specdev init` and restored by `specdev update`.
  - `src/commands/init.js` for generated agent wrappers such as `.codex/skills/specdev-reviewloop/SKILL.md` and `.claude/skills/specdev-reviewloop/SKILL.md`.
  - `templates/.specdev/skills/core/implementing/SKILL.md` for implementation-phase agent behavior after final tests/checkpoint.
  - `src/commands/implement.js` and `src/commands/checkpoint.js` for CLI output that offers final review options.
  - Tests covering those generated/templated instructions so new installs and updates keep the autocontinue contract.
- Do not treat `.specdev/skills/*`, `.codex/skills/*`, or `.claude/skills/*` in this working tree as product source for the behavior change. They may be updated only as installed/generated artifacts when the user explicitly runs `specdev update` or when tests create fixture outputs.
- Consider persisting lightweight automation metadata in the assignment, for example `status.json`:

```json
{
  "brainstorm_approved": true,
  "implementation_approved": false,
  "automation": {
    "mode": "autocontinue",
    "reviewer": "codex",
    "started_from": "brainstorm",
    "implementation_review_required": true
  }
}
```

Persisting the reviewer makes resume behavior safer if the agent session restarts before implementation review.

## Alternatives Considered

### `specdev continue --auto --reviewer=codex`

This gives a general “advance until blocked” command and fits the existing state-detection command. It is powerful for resuming from arbitrary states, but it is less clear at the key user interaction point. The user is choosing a reviewer-backed approval path, so anchoring on `reviewloop` is more direct.

### New `specdev autopilot --reviewer=codex` Command

A new command would make orchestration explicit and avoid overloading existing commands. The drawback is more CLI surface area and another command users must learn. It also weakens the nice mental model that review approval opens the gate and autocontinue controls what happens after.

### Make `reviewloop` Always Continue

This minimizes flags but changes existing behavior too much. Some users want a single review run without committing to full assignment execution. Autocontinue should be opt-in.

## Success Criteria

- `specdev reviewloop brainstorm --reviewer=<name>` keeps current single-phase behavior.
- `specdev reviewloop brainstorm --reviewer=<name> --autocontinue` documents and triggers the autonomous path after brainstorm approval.
- On brainstorm review failure, the agent addresses findings and reruns reviewloop within max rounds instead of asking the user to type the next command.
- On brainstorm review approval, the agent does not ask the user to run `specdev approve brainstorm`, `specdev continue`, or `specdev implement`.
- Autonomous mode runs implementation reviewloop before implementation approval/finalization.
- On implementation approval, the agent proceeds to knowledge capture without asking the user to run `specdev approve implementation` or `specdev continue`.
- Existing reviewloop tests continue to pass, and new tests cover the non-autocontinue and autocontinue command paths.

## Open Questions

- Should `--autocontinue` be accepted for `implementation` in v1, or only for `brainstorm`?
- Should automation metadata live in `status.json`, a separate `automation.json`, or only in agent session context?
- Should the CLI itself run phase commands, or should it emit machine-readable instructions and rely on the agent skill contract to execute them?
- Should multiple reviewers be allowed with autocontinue, and if so should the same reviewer chain be reused for implementation?
