# Forecast

## 1. Add the Selective Assignment Context Catalog

Assignment workers receive guide catalogs and knowledge-search instructions, but there is no bounded catalog covering project context and Roadmap designs or consistent role-and-phase selection. Add provider-neutral authority, task, supporting, and permitted role-history context groups. Load binding authority first, expose relevant durable paths without preloading their contents, expand on objective relevance or unresolved ambiguity, preserve reviewer independence, and constrain Mission children to their delegated parent context.

Based on: `workflow/lanes/assignment/assignment_selective_context_catalog.md`, `foundations/coding_agent_role.md`

## 2. Support Optional Networked Read-Only Reviewers

Agent profiles currently reject reviewer networking, and provider adapters enable networking only for Codex workers. Add a default-off reviewer network policy behind provider adapters while preserving repository-read-only access. Validate provider capabilities before launch, fail closed when the requested isolation cannot be enforced, and freeze the effective filesystem and network policy in Attempt and Mission execution records.

Based on: `foundations/coding_agent_role.md`

## 3. Continue Eligible Primary Reviewer Sessions

Reviewer invocations currently force ephemeral execution and cannot resume the reviewer that issued repair findings. Add exact provider-session capture and Assignment-local continuation leases bound to the Assignment, reviewer role, profile, permissions, contract, working directory, and reviewed candidate. Eligible repair-verification rounds should receive prior findings, candidate changes, and changed evidence while remaining distinct Attempts. Material changes, missing capabilities, or failed continuation must fall back to a fresh review; resolvers and arbiters always remain fresh.

Based on: `workflow/lanes/assignment/assignment_reviewer_session_continuation.md`, `foundations/coding_agent_role.md`, `foundations/specdev_state_model.md`

## 4. Add Explicit Mission Abandonment

The Mission CLI has no semantic abandonment operation even though the design requires an inspectable terminal alternative to completion. Add an explicit, reasoned, idempotent abandonment command that fails closed around live controllers, ambiguous product changes, and unsafe child worktrees. Preserve branches and incomplete work, record the terminal outcome and retained Git identities, compact only safely owned runtime state, and prevent abandoned Missions from running, landing, or being reinterpreted as successful.

Based on: `workflow/lanes/mission_lane.md`, `workflow/workflow_model.md`, `foundations/specdev_state_model.md`
