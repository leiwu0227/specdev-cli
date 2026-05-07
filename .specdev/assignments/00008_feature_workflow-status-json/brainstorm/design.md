# Investigation: Hermes Agent Learnings for SpecDev CLI

## Overview

Hermes Agent is a full agent runtime, while SpecDev CLI is a workflow layer for coding agents. The useful lessons are therefore not its whole runtime, but its mechanisms for progressive skill loading, bounded memory, context-file discovery, registry-based extensibility, visible execution, and hub-style skill lifecycle management.

## Goals

- Identify Hermes mechanisms that can improve SpecDev without turning SpecDev into a general agent runtime.
- Prefer ideas that support SpecDev's existing strengths: assignments, phase gates, skills, review loops, and knowledge capture.
- Keep recommendations concrete enough to become future SpecDev assignments.

## Non-Goals

- Do not copy Hermes' full agent loop, messaging gateway, model provider stack, remote terminal backend, or subscription tool gateway.
- Do not replace SpecDev's phase model with a free-form chat agent.
- Do not propose implementation changes in this research-only discussion.

## Design

- Progressive skill disclosure is the strongest fit. Hermes exposes a small skill index first, then loads full `SKILL.md`, then specific reference files only when needed. SpecDev already has skill folders, but command output still points agents at whole skills manually. A `specdev skill view <name> [path]` or richer `specdev skills --json` could make skill loading more structured and token-efficient.
- Hermes treats skills as procedural memory: agent-created or agent-updated skills live in a user-owned directory, while bundled skills are synced with a manifest that avoids overwriting user edits. SpecDev has managed core/tool skills, but could adopt clearer provenance metadata for user tool skills and third-party workflow packs.
- Hermes keeps two bounded always-on memory files plus searchable session history. SpecDev's knowledge capture is assignment-oriented, which is better for project correctness, but it lacks a tiny "always injected" distilled facts layer. A bounded `.specdev/project_notes/working_memory.md` generated from captures could reduce repeated rediscovery.
- Hermes scans project context files and progressively discovers nested `AGENTS.md`/`CLAUDE.md` as paths become relevant. SpecDev currently relies on `.specdev/_main.md` plus project notes. A command like `specdev context scan <path>` could detect nested instructions and warn when a subtask enters a directory with additional rules.
- Hermes has a registry/check function pattern for optional tools and toolsets. SpecDev reviewer configs are JSON command adapters, which is simpler and appropriate, but could benefit from a reviewer/tool capability check before a phase starts: "codex exists, local specdev is linked, timeout configured, expected output file writable."
- Hermes emphasizes observable and interruptible execution. SpecDev reviewloop already streams reviewer output and writes logs, but the rest of the workflow could expose more machine-readable state with a `specdev status --json` command. I tried `specdev status`; it is not currently implemented.
- Hermes' docs are unusually strong at mapping entry points, data flow, and recommended reading order. SpecDev's README covers workflow well, but a developer architecture page for `src/commands/*` and `src/utils/*` would lower maintenance cost as command count grows.

## Success Criteria

- The research identifies at least three directly applicable ideas from Hermes.
- Recommendations are scoped to SpecDev CLI rather than generic agent infrastructure.
- Findings are written to the discussion folder and pass `specdev checkpoint discussion --discussion=D00001`.

## Recommended Follow-Ups

- Add `specdev status` / `specdev status --json` as a real command. It should summarize current assignment or discussion, phase, gate status, missing artifacts, and next command.
- Add structured skill inspection: `specdev skills --json`, `specdev skill view <name>`, and possibly `specdev skill view <name> <relative-path>`.
- Add reviewer preflight checks for reviewloop reviewers before spawning external CLIs.
- Consider a bounded, generated "working memory" artifact that distills durable workflow/project facts from completed captures.
- Document CLI internals with an architecture page: commands, utils, state files, assignment/discussion layout, and reviewloop data flow.

## Sources Inspected

- GitHub repository page and README for repository shape and feature claims.
- Local shallow clone of `NousResearch/hermes-agent`, especially `website/docs/developer-guide/architecture.md`, `website/docs/user-guide/features/skills.md`, `website/docs/user-guide/features/memory.md`, `website/docs/user-guide/features/context-files.md`, and `skills/software-development/subagent-driven-development/SKILL.md`.
- Local SpecDev files: `README.md`, `src/commands/reviewloop.js`, `src/commands/discussion.js`, and project context script output.
