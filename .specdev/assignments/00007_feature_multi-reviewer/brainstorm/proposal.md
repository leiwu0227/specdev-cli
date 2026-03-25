# Proposal: Multi-Reviewer Support

Add the ability to run multiple reviewers in succession via comma-separated `--reviewer` flag (e.g., `--reviewer=codex,claude`). Each reviewer runs its full review cycle independently (up to max_rounds) before handing off to the next. Phase is approved only after all reviewers pass.
