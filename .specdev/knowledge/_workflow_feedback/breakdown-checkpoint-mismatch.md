# Breakdown Checkpoint Mismatch

Assignment 00010 showed that the breakdown skill refers to plan review/checkpoint behavior, but the CLI only supports `brainstorm`, `implementation`, and `discussion` checkpoint phases.

Mitigation: after writing `breakdown/plan.md`, run `specdev implement` directly. A future workflow cleanup should either add a real breakdown checkpoint or update the breakdown skill text so agents do not try `specdev checkpoint breakdown`.
