# Proposal: Bounded Working Memory

Add a small generated working-memory artifact for agents: `.specdev/project_notes/working_memory.md`. The goal is to capture durable, high-signal project and workflow facts in a bounded markdown file that can be read cheaply at session start, complementing the larger assignment captures and knowledge branches.

This should follow the Hermes lesson of a tiny always-useful memory layer without adopting Hermes' full runtime memory system or SQLite storage. The first version should be deterministic, git-reviewable, and derived from existing SpecDev artifacts.
