# Assignment contract

Kind: change

## Objective and context

Apply the published simplicity principles to SpecDev's shipped agent guidance so
agents deliver complete requested behavior with less speculative machinery and
fewer unnecessary interruptions.

Authority: the simplicity additions published in commit `4553f3a` to these notes
under `.specdev/project_notes/roadmap/designs/workflow/`:

- `lanes/assignment/assignment_lane.md`
- `lanes/assignment/assignment_execution_modes.md`
- `lanes/adhoc_lane.md`
- `review_system.md`

The bounded knowledge search for simplicity found no relevant existing guidance.

## Scope and non-goals

- In scope: canonical Brainstorm and Assignment guidance, inline and spawned
  implementation and repair handoffs including Mission children, generated Adhoc
  instructions, and existing review guidance. Cover normal installation/update
  delivery from product sources and focused regression evidence where useful.
- Non-goals: new phases, gates, modes, reviewers, artifacts, dependencies, Ponytail
  installation, debt ledgers, line-count scoring, unrelated cleanup, or changes to
  lifecycle, authority, review verdict semantics, and required evidence. Do not run
  `specdev update` against this repository or hand-edit its installed instructions.

## Expected behavior

Brainstorm distinguishes current needs from speculative scope, considers existing
architecture, and leaves routine implementation choices open. Discussion scales
with the change while preserving explicitly requested behavior.

Implementation understands the affected flow and callers, reuses existing code and
suitable platform capabilities, and justifies new machinery by concrete current
needs. It preserves readability, useful architecture, required safeguards, and the
whole approved scope. Routine authorized choices proceed autonomously; material
unknowns or actual authority conflicts warrant questions. Verification and reporting
remain proportionate. Actual limitations may name a revisit trigger in existing
artifacts or comments; completion does not create speculative follow-up work.

Adhoc applies those principles directly within its bounded task and existing
delivery obligations. Existing review recommends concrete simplifications only
with an explanation of preserved behavior and boundaries. Complexity blocks only
for an actual defect or binding requirement violation; style and size preferences
remain advisory.

## Important decisions

Integrate guidance into existing owning instructions and handoffs rather than adding
a standalone policy subsystem. Keep foreground, spawned, repair, and Mission-child
execution consistent. Adapt the agreed ideas in project language; do not copy the
external skill's persona, intensity modes, output restrictions, or one-line bias.

## Constraints and invariants

Repository instructions and existing approval, ownership, safety, and verification
boundaries remain binding. Honor the source-file ceilings in the four design notes.
Change product sources and templates; generated installations in isolated fixtures
may be used for verification. Preserve unrelated Discussion and runtime changes.

## Delegated and reserved authority

- Delegated: wording, placement within existing guidance, bounded handoff changes,
  focused regression coverage, and ordinary implementation choices within this scope.
- Reserved for the user: contract changes, relaxed safeguards or gates, new external
  dependencies, installed-workflow updates in this repository, and test execution
  beyond the explicitly approved verification below.

## Risks and assumptions

The main risks are guidance reaching only one execution path, reviewers treating
preferences as blockers, and agents confusing simplicity with incomplete delivery.
Verify guidance delivery and semantic consistency. This change cannot guarantee or
claim measured reductions in agent code size, latency, or cost.

## Verification authority

Read-only source inspection, whitespace checks, and contract checkpoint validation
are permitted. The following focused tests are proposed for explicit authorization
with contract approval; none may run before that approval:

- `node tests/test-assignment-context.js`
- `node tests/test-implement-recovery.js`
- `node tests/test-update-skill-roots.js`

Run only applicable commands from this list and reuse valid receipts. Any additional
test command or full suite requires separate explicit user approval. Existing
independent implementation review remains required and inherits these limits.

## Acceptance criteria

- AC-1: Shipped Brainstorm and Adhoc guidance expresses their phase-appropriate
  simplicity rules through the normal installation/update sources, preserving
  requested behavior and existing lane boundaries without adding ceremony.
- AC-2: Inline and spawned implementation and repair handoffs, including Mission
  children, consistently convey reuse, concrete justification for complexity,
  routine autonomy, complete delivery, and proportionate authorized verification.
- AC-3: Existing review guidance requires concrete behavior-preserving simplification
  findings, keeps style and size preferences advisory, and retains current authority,
  evidence, and verdict boundaries. Focused inspection and approved applicable
  regression checks establish delivery across the affected paths.
