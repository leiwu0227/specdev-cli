# Proposal: Structure SpecDev Workflow Feedback Accumulation

SpecDev currently captures workflow observations in two places: assignment-local `capture/workflow-diff.md` files and durable notes under `.specdev/knowledge/workflow_feedback/`. The durable notes are useful, but the process for deciding when to create or update them is loose. Agents are told to write workflow observations "as appropriate," without a required note format, accumulation rule, status model, or promotion path from repeated feedback into future SpecDev assignments.

Refactor the distill/knowledge-capture guidance so workflow-related issues and improvements accumulate through structured Markdown notes in `knowledge/workflow_feedback/`. Keep `capture/workflow-diff.md` as the raw per-assignment reflection, but add a formal workflow feedback note template and instructions for searching existing feedback, updating repeated issues, classifying severity/status, and marking strong candidates for follow-up assignments.
