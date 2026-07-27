# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Make blocked-worker recovery deterministic and cost-safe. When
`implementation/worker-result.md` already exists, `specdev implement` must
either reuse valid completed delivery artifacts or report why they are not
reusable; it must not silently convert an artifact-format or validation problem
into another provider invocation.

## Scope and non-goals

- In scope: recovery classification and diagnostics in `specdev implement`,
  explicit `--retry-worker` behavior, and focused regression coverage for
  provider-attempt counts and workflow advancement.
- Non-goals: changing delivery-artifact schemas, reviewer convergence, provider
  timeout/launch retry policy, Mission gap policy, or the implementation and
  review prompts.

## Expected behavior

- With no preserved worker result, implementation launches the normal initial
  worker.
- A valid `status: completed` result and valid plan/progress/outcome artifacts
  advance through Design and Implementation as recovered artifacts without
  launching a worker.
- A `status: blocked`, malformed result envelope, or completed result whose
  delivery artifacts fail validation stops with an exact actionable diagnostic.
  It preserves the work and launches no provider by default.
- `--retry-worker` is the explicit authorization to replace a non-reusable
  preserved result with a fresh automatic worker.

## Important decisions

- Recovery returns distinct states for absent, blocked, malformed, invalid, and
  completed artifacts; it does not collapse validation errors into “no
  recovery.”
- Existing artifacts are evidence and potential working state, not permission
  to spend another worker Attempt.
- Diagnostics identify the invalid artifact or rule and offer both repair-and-
  resume and explicit-retry actions.

## Constraints and invariants

- Reuse must still pass the existing strict result-envelope and delivery-
  artifact validators before advancing RippleGraph.
- A failed recovery check does not mutate graph position or create an Attempt
  record.
- Existing Git-boundary, approval, review, delivery, and recovery behavior
  after successful Implementation remains unchanged.
- The fix must not trust a manually changed `status: completed` value without
  validating every required artifact.

## Delegated and reserved authority

- Delegated: choose the internal recovery result shape, concise error wording,
  and focused fixture organization.
- Reserved for the user: changing when automatic provider retries are allowed,
  weakening artifact validation, or adding unattended retry budgets.

## Risks and assumptions

The main risk is advancing from incomplete or inconsistent manually repaired
artifacts. The inverse risk is another expensive replacement worker caused by a
minor formatting error. Both are avoided by strict validation followed by an
actionable, non-spawning blocked result.

## Verification authority

- Focused tests for changed modules: allowed after repository instructions are satisfied
- Full suite: requires explicit user approval unless already authorized here

## Acceptance criteria

- AC-1: A previously blocked worker result changed to `status: completed` with
  valid delivery artifacts advances using `recovered-artifacts` and creates no
  new provider Attempt.
- AC-2: Blocked, malformed, and artifact-invalid preserved results return
  distinct actionable diagnostics, preserve files and graph position, and
  create no new provider Attempt.
- AC-3: `--retry-worker` launches a replacement worker for a non-reusable
  preserved result, while a genuinely absent result retains normal first-worker
  behavior.
