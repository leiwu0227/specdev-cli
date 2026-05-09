# Reviewloop Reviewer Launch Contracts

Reviewer configs run external agent CLIs from `specdev reviewloop`. Each reviewer must exit only after it has appended a parseable `## Round N` section with `**Verdict:** approved` or `**Verdict:** needs-changes` to the feedback file printed by `specdev review`.

## Claude

- Uses Claude Code print mode (`claude --print`) so it runs non-interactively and exits.
- Defaults to `claude-opus-4-6[1m]` with `--effort high` for deeper review.
- Uses `--no-session-persistence` to avoid accidentally resuming prior review context.
- Uses permission bypass flags because reviewloop is an automated reviewer path.
- Has a shorter timeout (`timeout_seconds: 300`) because common failures are hangs or stdout-only summaries.
- The prompt must explicitly say to write the feedback artifact, not just summarize to stdout.

## Codex

- Uses `codex exec` for one-shot execution.
- Uses `--ephemeral` so review state is isolated.
- Uses approval/sandbox bypass because reviewloop is expected to run unattended.
- Codex generally exits cleanly; the main risk is sandbox/auth failure, which will be captured in the reviewer log.

## Cursor

- Uses `cursor-agent -f -p` for one-shot execution.
- Cursor has had intermittent CLI hang reports upstream, so keep reviewloop timeout support enabled for custom Cursor configs.

## Debugging

For every reviewer round, reviewloop writes:

`review/{phase}-reviewer-{name}-round-N.log`

Use this log when the reviewer exits non-zero, times out, writes the wrong round, or fails to write a verdict.
