# Core Concepts

## Purpose

SpecDev is a repository development framework for coding agents. Its main purpose is to keep software development traceable, structured, and bounded even when an agent performs most of the work freely.

SpecDev bounds what an agent may decide, inspect, change, verify, and deliver. Inside an approved boundary, it executes without the human directing every detail. Outside it, the agent surfaces the decision instead of expanding its authority.

Durable artifacts provide project memory beyond sessions, providers, and context windows. Later work selectively recovers approved intent, design, workflow position, evidence, and outcomes instead of reconstructing conversation.

The human retains ultimate product control. “No surprises” does not make discovery predictable; it makes unexpected findings, divergence, missing evidence, changed scope, and unresolved review visible before delivery.

## Problem Example

Suppose a user develops one software project over several years. The codebase, design history, dependencies, and accumulated decisions eventually grow far beyond any coding agent’s context window. Each new session sees only a fragment.

Without a durable harness, agents reconstruct intent, overlook decisions, duplicate work, or conflict with unseen parts of the system. Conversations disappear, evidence becomes detached from candidates, and the user repeatedly explains the project. The software may compile, but its authority, verification, and recoverability become unclear.

SpecDev does not claim to eliminate mistakes or hallucination. It prevents unanchored agent work from silently becoming accepted project history.

## Design

### Repository-Resident Project Layer

SpecDev establishes a `.specdev/` layer at the repository root. It holds managed guidance and durable project context: design direction, living knowledge, contracts, workflow artifacts, evidence, findings, and outcomes.

Git remains authoritative for source code and revision history. Agent sessions, caches, and transcripts remain replaceable operational context. A fresh agent selectively loads durable sources relevant to its task rather than reading the entire project or trusting previous conversation.

This division lets a project be much larger than one context window while keeping its important decisions recoverable and inspectable.

### Workflow Lanes

Every request is classified into a lane whose authority matches the work:

- **Direct** answers, inspects, or writes bounded non-behavioral documentation.
- **Roadmap** collaborates on agreed designs and future code gaps.
- **Adhoc** delivers one bounded governed repository change.
- **Discussion** explores a design question without product mutation.
- **Assignment** delivers one change under an exact approved contract.
- **Mission** coordinates a broader approved objective through Assignments.
- **Test Audit** analyzes test redundancy without changing tests.

Material product mutation requires a lane with mutation authority. Selection follows semantic impact, uncertainty, evidence, and coordination needs—not file type, line count, or how easy the change appears.

The lanes form practical groups, but authority—not size alone—sets their boundaries. Roadmap records agreed design thinking, while Discussion allows user to form thinking pieces without touching the codebase. Adhoc, Assignment, and Mission deliver product changes with different governance and coordination. Direct handles immediate, read-only, and non-behavioral work. Test Audit diagnoses test redundancy and prepares possible future changes without modifying tests.

### Bounded Agent Autonomy

Inside an approved boundary, an agent may inspect, plan, choose implementation details, use tools, and repair its work without asking the human to direct every step. That freedom is delegation, not ownership.

The agent cannot silently expand scope, redefine an approved outcome, waive evidence, merge author and required-reviewer authority, or deliver a materially different candidate. Unexpected findings outside the boundary return to the human. This is how SpecDev aims for no surprises while preserving useful agent autonomy.

### RippleGraph Orchestration

RippleGraph is the orchestration kernel for SpecDev’s stateful workflows and isolated callables. Versioned graphs define meaningful states, allowed transitions, gates, and recoverable position so an agent cannot advance workflow meaning merely by claiming a step is complete.

RippleGraph owns workflow flow, not human intent, implementation judgment, evidence truth, or Git history. Lightweight Direct, Roadmap, and Adhoc work remains graph-free because their bounded interaction or transaction does not justify a recoverable graph lifecycle.

### Durable Responsibility Boundaries

Human-readable `.specdev` artifacts own approved intent and durable conclusions. RippleGraph state owns orchestration position. Git owns exact product revisions and delivery identity. Agent sessions and generated indexes help execution but never become the sole durable truth.

When these sources disagree, SpecDev exposes the inconsistency and returns to the owning authority instead of choosing the most convenient representation.

Detailed models live in `foundations/specdev_state_model.md`, `foundations/coding_agent_role.md`, `workflow/workflow_model.md`, and `workflow/lanes/workflow_lanes.md`.

## Design Choices and Tradeoffs

- Human control is preserved through explicit reserved decisions and visible divergence boundaries.
- Agents receive broad execution freedom only inside approved authority.
- Durable selective context supports projects larger than any single context window.
- Governance stays lightweight for simple work and becomes structured when risk or recoverability justifies it.
- Traceability adds deliberate ceremony, but that cost is concentrated where silent drift would be more expensive.
