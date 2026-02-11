# Project Big Picture

## What is SpecDev?

SpecDev CLI (`@specdev/cli`) is a Node.js command-line tool that bootstraps and manages a spec-driven workflow guidance system for AI coding agents. It initializes a `.specdev/` directory in any project, which becomes the control hub for structured, test-driven, AI-assisted development.

The CLI itself is a scaffolder — it sets up templates, guides, and skills. The agents interpret and follow these guides autonomously; there is no runtime orchestration in the CLI.

## Goal

Enable disciplined, reproducible workflows for AI coding agents through:
- Structured assignment lifecycles (proposal → plan → scaffold → implement → validate)
- Enforced TDD discipline with rationalization tables
- Complexity-scaled scaffolding (none / lite / full)
- Multi-stage code review (spec compliance, then code quality)
- Continuous knowledge capture and workflow improvement

## Key Principles

- **Templates-only approach**: The CLI scaffolds files; agents figure out orchestration from the guides
- **Underscore convention**: `_`-prefixed paths are system-managed; non-prefixed paths are project-owned
- **Selective updates**: `specdev update` overwrites system files, preserves project files
- **Three-tier temporal model**: Working (task scratch) → Short-term (assignment context) → Long-term (knowledge vault)
- **Minimal dependencies**: Single runtime dep (`fs-extra`), prompts use Node built-in `readline`
- **Offline-first**: Rule-based suggestions, no API keys required (LLM-powered mode deferred)

## Living Documentation

- **README.md** — User-facing documentation with workflow model explanation
- **QUICKSTART.md** — 3-step getting started guide
- **SETUP.md** — Installation and configuration
- **CHANGELOG.md** — Detailed version history (v0.0.1 through v0.0.4)
- **upgrade.md** (this folder) — Design document for knowledge system and multi-agent support
