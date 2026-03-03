# Legacy Assignment Migration Guide (V3 -> V4)

Use this guide when a project was started with an older SpecDev layout and has
assignment files at the assignment root (for example `plan.md`,
`implementation.md`).

## When to run migration

Run migration after `specdev update` if existing assignments still use root-level
phase files.

## Command

```bash
specdev migrate
```

Optional:

```bash
specdev migrate --dry-run
specdev migrate --assignment=<assignment-id>
```

## File moves performed

- `proposal.md` -> `brainstorm/proposal.md`
- `design.md` -> `brainstorm/design.md`
- `plan.md` -> `breakdown/plan.md`
- `implementation.md` -> `implementation/implementation.md`
- `validation_checklist.md` -> `review/validation_checklist.md`

The migration also ensures:

- `context/` exists
- `implementation/progress.json` exists when `implementation/` exists

## Safety behavior

- Existing destination files are never overwritten.
- If destination exists, that move is skipped and reported.
- Use `--dry-run` first to preview changes.

## After migration

Continue the normal workflow:

- `specdev start` (fill in project context)
- `specdev assignment "<description>"` (reserve ID for new work)
- `specdev continue` (resume where you left off)
- `specdev checkpoint <phase>` (validate artifacts before approval)
- `specdev approve <phase>` (gate approval to proceed)
- `specdev review <phase>` (optional manual review in separate session)
