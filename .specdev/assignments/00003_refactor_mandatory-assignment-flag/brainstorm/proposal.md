# Proposal: Discussions + .current pointer

SpecDev currently conflates brainstorming and assignment execution, and uses heuristic auto-detection to guess the active assignment. When multiple assignments exist, agents get confused about which one they're working on. This refactor introduces two changes: (1) Discussions — a new pre-assignment concept under `.specdev/discussions/` for parallel brainstorming with explicit `--discussion` flags, and (2) a `.current` pointer file that tracks the active assignment, eliminating heuristic guessing entirely.

The result is unambiguous context for agents: discussions are always explicit by flag, assignments are always explicit by `.current`, and there's no auto-detection to get wrong.
