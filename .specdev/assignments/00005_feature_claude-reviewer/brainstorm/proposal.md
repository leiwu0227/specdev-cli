# Proposal: Claude Reviewer

Add a Claude Code reviewer configuration so that `specdev reviewloop` can launch Claude Code in a separate session to perform reviews, just like the existing codex and cursor reviewers.

This is a config-only change — the reviewer system is pluggable via JSON files, so no code changes are needed. The `claude.json` config will be distributed to all new projects via `specdev init`.
