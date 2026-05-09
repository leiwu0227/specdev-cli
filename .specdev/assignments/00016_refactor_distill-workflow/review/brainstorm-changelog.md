## Round 1

- Addressed [F1.1] by making the source-of-truth boundary explicit: implementation should update `templates/.specdev/`, tests, and docs, not installed runtime `.specdev/` workflow files unless the user explicitly requests `specdev update`.
- Replaced the success criterion about updating local runtime copies with criteria for template installation through the normal `specdev init` / `specdev update` path.
- Clarified that the durable notes are created under project `.specdev/knowledge/workflow_feedback/`, but the reusable note template should live under `templates/.specdev/`.
