# Coding Agent Role

Parent design: `../core_concepts.md`

## Purpose

SpecDev uses coding agents as bounded executors and collaborators. Agents may
do substantial work, make implementation choices, and repair their own mistakes
inside approved authority, but they are never the source of product authority or
durable workflow truth.

The coding-agent role model explains how SpecDev can delegate real autonomy
without surrendering human control. It separates durable authority from provider
sessions, model behavior, and individual invocations.

## Bounded Autonomy

An agent receives a boundary before it acts: what it may inspect, decide,
change, verify, and deliver. Inside that boundary, the agent does not need the
human to direct every tactical step. Outside that boundary, it must surface the
decision instead of silently expanding scope.

"No surprises" does not mean the agent will never find unexpected information.
It means unexpected findings, missing evidence, changed assumptions, unresolved
review, or materially different outcomes become visible before acceptance.

## Roles

The **foreground agent** collaborates directly with the user. It classifies
work, helps shape approved artifacts, reports boundaries, and may execute when
the selected lane delegates that role.

A **worker** implements a bounded objective under a contract or selected change
scope. Worker authority is limited to the delegated mutation and evidence
obligations.

A **reviewer** independently evaluates an exact candidate against its authority
and evidence. A required reviewer is product-read-only and reports findings; it
does not repair the candidate it judges.

A **controller** coordinates a parent workflow, delegates child authority,
integrates results, and decides workflow actions within the approved parent
boundary. Control does not grant independent product direction.

A **resolver** is a fresh corrective executor used when ordinary repair has not
produced convergence. It performs one bounded resolution under existing
authority, but cannot reinterpret the contract, expand scope, or judge its own
result.

An **arbiter** is a fresh independent reviewer used when a resolved outcome
still requires final disposition. It evaluates the exact candidate, authority,
findings, and evidence without repairing the work or granting new product
authority.

One session may perform different roles at different times, but each role's
authority remains explicit. Required author and reviewer authority cannot
collapse merely because one provider supports both.

## Attempts

An Attempt is one bounded invocation of an agent in one role. Attempts are
operational executions, not Assignment, Mission, Discussion, or lane identities.

Every Attempt records enough provider-neutral facts to understand its role,
authority, execution policy, status, and result. Raw transcripts and process
details may remain operational state, while durable workflow artifacts preserve
the accepted outcome.

A failed, interrupted, or unavailable Attempt may be replaced without replacing
the approved objective. Recovery relies on durable contracts, state, evidence,
and candidate identity rather than hidden conversational memory.

## Provider Neutrality

Core workflow semantics are provider-neutral. Providers differ in commands,
transport, event formats, session capabilities, and sandbox controls, but those
differences remain behind bounded adapters and profiles.

A provider integration maps neutral role and capability requirements to native
execution. It may offer optional capabilities, but it cannot weaken a workflow
gate, become mandatory for interpreting durable state, or grant itself
privileged authority.

Provider-private output is translated into a strict role result before it may
influence workflow state. Informal or native review output remains advisory
unless it passes the governed review boundary.

## Capability Boundaries

Profiles select execution qualities such as provider, model, effort, filesystem
access, network policy, and session behavior. The effective profile is frozen
where identity or review integrity requires stable execution conditions.

Capabilities follow least authority. A worker receives only what implementation
requires. A reviewer remains repository-read-only even when optional network
access is explicitly enabled.

Session continuity may reduce repeated orientation, but it is replaceable
operational state. It cannot cross unrelated workflow identities, merge
independent roles, or become the sole record of decisions, findings, or
recovery.

## Design Choices

- Coding agents are delegated executors, not product owners.
- Boundaries describe permitted decisions before work proceeds.
- Role authority is explicit even when one session performs multiple roles.
- Required reviewers remain independent and product-read-only.
- Attempts are replaceable and distinct from workflow identity.
- Provider capabilities never redefine core workflow semantics.
- Durable artifacts outrank transcripts and private session state.
