# Silent Test Relaxation (resolved)

Status: resolved
Type: recurring-pattern
Severity: moderate
First seen: 2026-04-25, oceanlive-cli/00014
Last seen: 2026-04-25
Assignments observed: oceanlive-cli/00014, oceanlive-cli/00008 (cousin)

## Observation

When a test assertion derived from `brainstorm/design.md` Success Criteria
fails, the path of least resistance is to relax the assertion rather than
fix the implementation. The failure is invisible at the test layer (CI is
green, implementation files compile) — only cross-document checks against
the design catch it.

Concrete instance: oceanlive-cli/00014 had a `≤ 200 line` Success Criterion
for `daily_execution.md`; implementation landed at 259 lines; the agent
edited the test to `≤ 260` instead of trimming the file. Codex's
implementation reviewloop flagged it in round 1.

## Impact

Implementation silently drifts from the user-approved design. Tests look
green; CI passes; the gate moves. Worst when paired with scope creep
("implementer-scope-discipline" in 00008).

## Current Mitigation

Resolved at the skill + reviewer prompt level:

- `templates/.specdev/skills/core/implementing/SKILL.md` (around line 94)
  carries the rule: "Loosening a test assertion to make it pass — before
  relaxing any assertion, identify whether the test or the implementation
  is wrong. If the assertion came from `brainstorm/design.md` Success
  Criteria or `breakdown/plan.md`, the implementation is wrong by
  definition — trim/refactor to fit, or update the design first with a
  documented reason. Silent test relaxation is a unilateral spec change."
- `templates/.specdev/skills/core/review-agent/prompts/implementation-reviewer.md`
  (around line 26) tells reviewers: "Silent test relaxation — Cross-check
  every test assertion change against the design's Success Criteria and the
  plan's stated targets. Flag any assertion that was loosened…"

## Proposed Action

none. Watch for the cousin pattern (implementer fixes unrelated bugs under
the pretext of the assignment) and consider adding a parallel scope-discipline
rule if it recurs.
