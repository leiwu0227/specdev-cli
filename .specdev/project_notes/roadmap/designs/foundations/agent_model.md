# Agent Model

Parent design: `../core_concepts.md`

## Purpose

SpecDev uses coding agents as bounded executors and collaborators, never as the source of product authority or durable workflow truth.

The agent model separates semantic roles from providers and individual invocations. This allows different coding systems to participate without changing approval, workflow, evidence, review, or recovery rules.

## Roles

The **foreground agent** collaborates directly with the user. It classifies work, helps shape approved artifacts, reports boundaries, and may execute work when the selected lane delegates that role.

A **worker** implements a bounded objective under a contract or selected change scope. Worker authority is limited to the delegated mutation and evidence obligations.

A **reviewer** independently evaluates an exact candidate against its authority and evidence. A required reviewer is product-read-only and reports findings; it does not repair the candidate it judges.

A **controller** coordinates a parent workflow, delegates child authority, integrates results, and decides workflow actions within the approved parent boundary. Control does not grant independent product direction.

A **resolver** is a fresh corrective executor used when ordinary repair has not produced convergence. It performs one bounded resolution under existing authority, but cannot reinterpret the contract, expand scope, or judge its own result.

An **arbiter** is a fresh independent reviewer used when a resolved outcome still requires final disposition. It evaluates the exact candidate, authority, findings, and evidence without repairing the work or granting new product authority.

One agent session may perform different roles at different times, but the authority and separation of each role remain explicit. Required author and reviewer authority cannot collapse merely because one provider supports both.

## Attempts

An Attempt is one bounded invocation of an agent in one role. Attempts are operational executions, not Assignment, Mission, Discussion, or lane identities.

Every Attempt records enough provider-neutral facts to understand its role, authority, execution policy, status, and result. Raw transcripts and process details may remain operational state, while durable workflow artifacts preserve the accepted outcome.

A failed, interrupted, or unavailable Attempt may be replaced without replacing the approved objective. Recovery relies on durable contracts, state, evidence, and candidate identity rather than hidden conversational memory.

## Provider Neutrality

Core workflow semantics are provider-neutral. Providers differ in commands, transport, event formats, session capabilities, and sandbox controls, but those differences remain behind bounded adapters and profiles.

A provider integration maps neutral role and capability requirements to native execution. It may offer optional capabilities, but it cannot weaken a workflow gate, become mandatory for interpreting durable state, or grant itself privileged authority.

Provider-private output is translated into a strict role result before it may influence workflow state. Informal or native review output remains advisory unless it passes the governed review boundary.

## Profiles and Capability Boundaries

Profiles select execution qualities such as provider, model, effort, time limit, filesystem access, and network policy. The effective profile is frozen where identity or review integrity requires stable execution conditions.

Capabilities follow least authority. A worker receives only what implementation requires. A reviewer remains repository-read-only even when optional network access is explicitly enabled.

Reviewer network access is default-off and may be enabled only through a supported, bounded policy. If a provider cannot enforce the required filesystem or network isolation, execution fails closed rather than using an unsandboxed fallback.

## Session Continuity

Provider session continuity may reduce repeated orientation within one bounded role lineage. It is replaceable operational state and never the sole record of decisions, findings, or recovery.

Session reuse cannot cross unrelated workflow identities or merge independent roles. Missing, invalid, or unsupported continuity falls back to a fresh Attempt reconstructed from durable artifacts.

## Design Choices

- Roles define authority; providers supply execution capabilities.
- Attempts are replaceable and distinct from workflow identity.
- Required reviewers remain independent and product-read-only.
- Resolver and arbiter roles start fresh and preserve executor-reviewer separation.
- Provider adapters fail closed when requested isolation cannot be enforced.
- Durable artifacts outrank transcripts and private session state.
- Optional provider capabilities never redefine core workflow semantics.
