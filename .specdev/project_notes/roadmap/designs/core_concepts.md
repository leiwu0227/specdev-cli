# Core Concepts

## Purpose

SpecDev is a local-first, repository-resident framework for software work with coding agents. It turns human intent into explicit decisions, governed work, recoverable state, evidence, and reviewable delivery.

Important decisions live in durable project artifacts so later work can rely on approved intent instead of reconstructing it from conversations or code. This preserves continuity and makes silent drift easier to detect.

The user remains the source of product authority. SpecDev may automate work within an approved boundary, but it is not an autonomous product owner, a provider-specific agent framework, or an opaque hosted control plane.

## Design Principles

SpecDev draws from spec-driven development, human-in-the-loop systems, state machines, Git-backed engineering history, and local-first Unix-style tooling.

Its core principles are:

- Intent and authority should be explicit, readable, and portable.
- The lightest lane that provides sufficient governance should be used.
- Automation must remain inside a user-approved boundary.
- Durable state must not depend on one agent session or provider.
- Workflow state, product revisions, and human decisions have distinct owners.
- Generated indexes, caches, and raw provider output are operational aids, never the sole durable truth.

## Framework Responsibilities

SpecDev separates four responsibilities:

- **Decisions:** users approve contracts, roadmap designs, and shared project records.
- **Orchestration:** RippleGraph keeps governed workflows explicit and recoverable.
- **Execution:** workers implement and reviewers assess within assigned authority.
- **History:** Git records exact revisions and deliveries; workflow receipts record evidence only when required by their owning lane.

Living knowledge holds current, revisable facts. Roadmap notes hold user-agreed design direction and implementation forecasts without granting implementation authority.

## Work Lanes

SpecDev uses distinct lanes according to the work’s authority and risk:

- **Direct** handles questions, read-only work, and bounded non-behavioral documentation.
- **Roadmap** collaborates on agreed designs and implementation forecasts without workflow state, receipts, or product-code authority.
- **Adhoc** performs one bounded governed change with a receipt and final commit.
- **Discussion** explores a design without modifying product code.
- **Assignment** delivers one approved contract through planning, implementation, evidence, and review.
- **Mission** coordinates a broader approved objective through Assignment work.
- **Test Audit** examines test redundancy read-only and can prepare an Assignment.

Functional impact determines the required governance; file extension and line count do not.

## RippleGraph

SpecDev uses RippleGraph as its workflow backbone. Graph nodes describe work or decision steps, while edges define allowed transitions.

RippleGraph owns workflow flow, validates outputs, enforces gates, and returns the next action. The coding agent still performs the work. Assignments and Missions use durable runs, while Discussions and Test Audits use isolated callable graphs. Direct, Roadmap, and Adhoc are graph-free.

RippleGraph owns flow, not intent or revision history. Approved human artifacts describe what should happen, and Git records what changed.
