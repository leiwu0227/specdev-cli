# Proposal: Agent-Friendly Workflow

Make the specdev CLI more consumable by coding agents (Claude, Codex, Cursor) by improving command discoverability, knowledge visibility, and machine-readable output across all commands.

## Problem

Agents using specdev in consumer repos face three friction points:
1. They don't know what commands/tools are available or when to use them
2. They don't know what knowledge has accumulated in `.specdev/knowledge/` and `project_notes/`
3. Many command outputs are human-formatted prose — agents must parse text instead of consuming structured JSON

## Solution

Four tiers of improvements:
1. New `specdev context --json` command — single-shot dump of everything an agent needs on cold start
2. New `specdev knowledge list --json` command — inventory of all knowledge files
3. Universal `--json` flag across all 12 commands that currently lack it
4. Session hook improvements — inject phase-relevant commands and knowledge availability using `context --json`
