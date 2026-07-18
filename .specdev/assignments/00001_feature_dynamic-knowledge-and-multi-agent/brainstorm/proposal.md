# Proposal: Dynamic Knowledge System & Multi-Agent Support

## Assignment Name
Dynamic Knowledge System & Multi-Agent Support (feature)

## Overview
Enhance the SpecDev workflow system with two major capabilities: a dynamic knowledge system that evolves as users work, and structural support for multi-agent orchestration workflows. Both implemented as templates only — the CLI remains a scaffolder.

## Goals
- Add a knowledge vault with local (project-specific) and global (workflow improvement) knowledge tiers
- Implement three-tier temporal knowledge model: working, short-term, long-term
- Add `specdev ponder workflow` and `specdev ponder project` interactive commands
- Update assignment structure to support context tracking, task decomposition, and inter-agent communication
- Ensure `specdev update` handles migration from old to new structure
- Dogfood: use SpecDev on itself

## Use Cases
1. Agent captures project patterns (codestyle, architecture, domain) across assignments
2. Agent captures workflow feedback for maintainer to collect and improve guides
3. User interactively reflects on completed work via `ponder` commands
4. Multiple agents coordinate through file-based communication within assignments
5. Existing users upgrade seamlessly via `specdev update`

## Non-Goals
- LLM-powered ponder suggestions (deferred — rule-based for v1)
- `specdev contribute` command for sending feedback to upstream (future)
- Modifying the CLI into a runtime/orchestrator (stays templates-only)
- Changing the core assignment lifecycle (proposal → plan → scaffold → implement → validate)
