# Proposal: Workflow Status JSON

Add `specdev status [--json]` so coding agents (and CI / tooling) have a
single canonical command for "where is this assignment right now?". The
human form should be readable in a terminal; the JSON form should expose
the structured fields agents need: active assignment, current state, gates,
artifact presence, blockers, progress, review diagnostics, and the next
suggested action.

Promoted from D00001 (research learnings from NousResearch Hermes), where
the "always-on status surface" idea was one of five recommended follow-ups.
See `discussion_progress.md` for the full split.
