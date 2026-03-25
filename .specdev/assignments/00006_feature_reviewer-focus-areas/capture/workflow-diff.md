# Workflow Diff — Reviewer Focus Areas
**Date:** 2026-03-25  |  **Assignment:** 00006_feature_reviewer-focus-areas

## What Worked
- Extracting `resolveRoundFocus` as a standalone utility made testing easy and kept reviewloop.js clean
- The env var approach (SPECDEV_FOCUS) kept the design simple — no coupling between reviewloop and review commands
- Plan review caught a real bug (specdevPath ordering) before implementation

## What Didn't
- Codex reviewer still completely broken due to bwrap sandbox — third consecutive assignment where it fails
- Cursor reviewer approved but failed to write to feedback file, requiring manual feedback file creation
