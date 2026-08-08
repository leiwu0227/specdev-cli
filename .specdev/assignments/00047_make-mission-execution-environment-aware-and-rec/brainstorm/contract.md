# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Make Mission execution environment-aware and recoverable by preflighting verification capabilities before approval, distinguishing product failures from evidence-infrastructure failures, routing one bounded evidence recovery, superseding criterion-scoped follow-ups, checkpointing integrated work, guiding successor handoff, and presenting one consolidated execution policy

## Scope and non-goals

- In scope: Mission approval preflight and policy preview; executor capability declarations and evidence routing; convergence dispositions and bounded evidence recovery; criterion-scoped follow-up supersession; recoverable integration checkpoints; and guided successor-Assignment handoff from an evidence-only terminal Mission.
- Non-goals: automatically provisioning runtimes, services, secrets, network access, or native platforms; silently weakening verification or review requirements; building a general-purpose remote-execution system; reopening or rewriting a terminal Mission; permitting an evidence rerun to change the candidate revision or verification command; or changing standalone Assignment semantics except for creating a successor through the guided handoff.

## Expected behavior

Before Mission approval, SpecDev derives and displays one consolidated execution policy covering review profiles, exact verification executables and commands, required runtime capabilities, services and network/socket access, platform coverage, approved executor classes, and any explicit fallback, bypass, or escalation decisions. Automatic execution uses that policy to avoid scheduling impossible evidence work.

Mission convergence classifies unsuccessful evidence separately from product failure. When the candidate has no identified product defect and the approved command was blocked by an executor or environment limitation, the Mission may make one bounded recovery attempt on another already-authorized capable executor, preserving the original receipt and linking any superseding receipt. Follow-up findings remain attributable to an acceptance criterion and can be explicitly closed or superseded by later evidence.

Integrated Mission-owned changes are checkpointed at successful child or wave boundaries, and convergence does not proceed over substantial uncheckpointed product changes. If an evidence-only problem has already terminalized a Mission, a guided handoff preserves that immutable history while drafting the smallest fresh successor Assignment from its unresolved criteria and evidence provenance.

## Important decisions

- Separate capability facts from user authorizations. A capability declaration may describe a managed worker, an authorized host, or a platform-specific executor, but it grants no new authority and records secret names or requirements only, never secret values.
- Bind the approved execution policy to the Mission contract revision. Evidence recovery must use the same candidate revision and exact verification command; only the approved executor may change.
- Use typed convergence dispositions that distinguish product change needed, evidence needed, executor unavailable, user decision required, contract unsatisfiable, and objective failure. Executor-only limitations do not become semantic or objective failure; genuine contract or product failure remains terminal when repair is exhausted.
- Permit at most one automatic evidence-recovery route for a given blocked verification obligation. Preserve every attempt, and link a later receipt as superseding evidence rather than replacing history.
- Scope follow-up findings to an acceptance criterion and finding type, with explicit closure or supersession provenance. A resolved child finding must not remain as an unqualified Mission-level signal.
- Create a recoverable checkpoint after successful integration boundaries. Refuse convergence when material Mission-owned product changes remain untracked or outside the recorded candidate checkpoint, and report a concrete recovery action.
- A guided handoff creates a fresh Assignment and never rehabilitates the terminal Mission. It snapshots the candidate revision and dirty paths, carries forward only unresolved criteria and relevant receipts, identifies supersedable evidence, and explains why new approval is required.

## Constraints and invariants

- Deterministic preflight is read-only: it may inspect declared or locally observable capabilities but must not provision resources, contact protected services, expose secrets, or consume user authority.
- Alternate execution, bypasses, host access, unavailable-platform treatment, and residual-risk acceptance require explicit prior authorization and remain visible in the approval policy and receipts.
- Recovery is bounded and fail-closed. It cannot expand executor authority, alter the contract, substitute a weaker check, change the candidate revision, or loop indefinitely.
- Product defects must not be hidden as infrastructure problems, and infrastructure-only failures must not be reported as product or semantic failures without evidence of a contract breach.
- Terminal Mission history and receipts are immutable. Successor work receives a new identity, contract, approval boundary, and current evidence while retaining provenance links.
- Existing Mission artifacts require a defined compatibility path; absence of new capability metadata must not be interpreted as implicit host or service authorization.

## Delegated and reserved authority

- Delegated: choose internal schemas, typed-disposition names, command spelling, output formatting, compatibility mechanics for existing Mission artifacts, checkpoint representation, and implementation structure, provided the observable behavior and invariants above hold.
- Reserved for the user: authorize host or alternate executors; provide secrets or service access; accept platform bypasses and residual risk; change the contract or verification command; approve broader provisioning or remote-execution scope; and authorize tests as required by repository instructions.

## Risks and assumptions

- Capability facts can drift after approval, so execution must record the actual executor and observed outcome rather than treating preflight as permanent proof.
- Product/environment misclassification could either mask a defect or strand a valid candidate; typed dispositions, immutable failed receipts, and bounded recovery are the audit safeguards.
- Checkpoint creation can interact with user-owned work and repository history. Only Mission-owned integrated changes may be checkpointed automatically, and unrelated changes must remain untouched.
- The source thought note is the authoritative problem statement. Exact persistence formats and CLI ergonomics may follow existing Mission conventions unless doing so conflicts with this contract.

## Verification authority

- Focused tests for changed modules: allowed after repository instructions are satisfied
- Full suite: requires explicit user approval unless already authorized here

## Acceptance criteria

- AC-1: Before approval, a Mission presents one consolidated, contract-bound execution policy that identifies review profiles, exact verification executables and commands, required capabilities/services/platforms, approved executor classes, and explicit fallback, bypass, or escalation decisions; missing or unavailable requirements produce an actionable decision instead of an impossible automatic child.
- AC-2: Convergence records a typed disposition that distinguishes product failure from evidence-infrastructure failure. An eligible executor-only blockage can route exactly one recovery attempt to an already-authorized capable executor using the same candidate revision and command, retaining the failed receipt and linking the passing or final receipt; a genuine product or contract failure still reaches the appropriate immutable terminal outcome.
- AC-3: Executor capability declarations are reusable across Mission planning and execution without granting authority or storing secret values, and routing records which approved executor actually ran each obligation so managed-worker restrictions do not repeatedly rediscover the same environment gap.
- AC-4: Follow-up findings are criterion-scoped and explicitly closable or supersedable, so resolved findings do not remain sticky at Mission level; successful integration boundaries create recoverable candidate checkpoints, and convergence refuses material uncheckpointed Mission-owned product changes with a concrete recovery instruction.
- AC-5: For a terminal Mission whose remaining problem is evidence-only, a guided successor handoff keeps the Mission immutable and drafts a fresh Assignment that snapshots candidate revision and dirty paths, preserves relevant receipt provenance, carries forward only unresolved criteria, marks supersedable evidence, and explains the new approval boundary.
