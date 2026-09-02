# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Allow a configured reviewer to use the network only when its provider adapter can
enforce network access together with repository-read-only filesystem access. This
closes Roadmap forecast gap 2 and follows
`.specdev/project_notes/roadmap/designs/foundations/coding_agent_role.md`: reviewer
network authority remains explicit, least-authority, provider-neutral, and durable.

## Scope and non-goals

- In scope: reviewer profile validation; provider-adapter capability and invocation
  policy; fail-closed preflight; durable effective filesystem/network policy in
  Assignment, Discussion, and Mission reviewer Attempts; frozen Mission review
  policy; focused templates, documentation, and regression coverage.
- Non-goals: reviewer session continuation; broader reviewer write authority;
  changing worker network behavior; granting services, credentials, or secret
  access; promising that an external endpoint is reachable; adding optimistic
  support for a provider whose CLI cannot express the required isolation.

## Expected behavior

- Reviewer networking remains off when `network` is omitted or false.
- `reviewer.network: true` is accepted only for an adapter that explicitly supports
  the combined policy `filesystem: read-only` and `network: enabled`. Its generated
  invocation enables the network without weakening repository isolation.
- An unsupported provider/policy combination fails before a provider process is
  launched. It is never downgraded silently to network-off or widened to writable.
- Every spawned reviewer Attempt records the effective filesystem and network
  policy used for that launch. A Mission freezes the effective worker/reviewer
  access policies in its approved execution policy and uses that frozen reviewer
  policy throughout the run, rather than silently accepting later profile drift.

## Important decisions

- Provider adapters, not generic profile parsing or call sites, are the authority
  for supported access-policy combinations and the exact CLI arguments that enforce
  them.
- The durable value is the normalized effective policy, not merely the user's raw
  configuration request. Existing records that lack the new filesystem field remain
  readable with a conservative role-derived interpretation.
- Capability checks are deterministic and local. Verification asserts profile,
  invocation, rejection, and persistence behavior without making a real network
  request.

## Constraints and invariants

- Reviewer filesystem authority remains repository-read-only whether networking is
  disabled or enabled; existing post-run write detection remains defense in depth.
- Networking is default-off and explicit. Unsupported isolation fails closed before
  launch and does not create a misleading running Attempt.
- Worker profile validation and invocation semantics remain compatible.
- Mission approval identity continues to bind its execution policy; configuration
  changes after approval do not mutate the frozen policy in place.
- Provider-specific details remain behind provider adapters, and reviewer verdicts
  cannot weaken approval, evidence, or divergence gates.

## Delegated and reserved authority

- Delegated: edit source, managed templates, documentation, and focused tests needed
  to implement the behavior above; choose a backward-compatible normalized record
  shape and an explicit adapter capability representation.
- Reserved for the user: approval of this contract; authorization to run any test
  command; adding credentials or external services; weakening read-only isolation;
  supporting a provider whose enforceability cannot be demonstrated; expanding into
  reviewer session continuation or unrelated Roadmap gaps.

## Risks and assumptions

- Provider CLI flags can change. Adapter-owned capability checks and invocation
  regressions are the durable boundary; this Assignment does not infer support from
  provider name alone.
- A CLI can enforce the requested local policy while an external network or endpoint
  is unavailable. Such reachability is an execution-environment concern, not a reason
  to widen permissions.
- Mission compatibility paths may load older policies and Attempts, so schema
  evolution must remain fail-safe and readable without retroactively claiming that
  networking was enabled.

## Verification authority

- No test command is authorized by this contract alone. Ask the user explicitly
  before running focused tests for profile validation, provider invocation,
  pre-launch rejection, Attempt persistence, and Mission policy freezing.
- Full suite: requires separate explicit user approval.

## Acceptance criteria

- AC-1: Reviewer profiles default networking to false, and adapter capability
  validation accepts `network: true` only when the provider can enforce the combined
  network-enabled/repository-read-only policy; unsupported combinations fail with a
  specific error before provider launch while worker behavior remains compatible.
- AC-2: For every supported networked reviewer, the provider invocation enables
  networking while retaining the provider's read-only filesystem mode; focused
  regressions also prove that neither unsupported fallbacks nor writable reviewer
  invocations are emitted.
- AC-3: Spawned reviewer Attempts persist their normalized effective filesystem and
  network policy, Mission execution policy freezes the effective worker/reviewer
  policies at approval, Mission review launch consumes that frozen reviewer policy,
  and older durable records remain conservatively readable.
