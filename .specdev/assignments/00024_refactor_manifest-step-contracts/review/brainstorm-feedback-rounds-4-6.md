## Round 1

**Verdict:** needs-changes

### Findings
1. [F1.1] The design does not define a manifest-backed contract for discussion checkpoint interactions, even though `specdev checkpoint discussion --discussion=<id>` is an existing checkpoint surface with its own prompt and two-choice schema. Current code handles this through the same duplicated path the refactor intends to eliminate: `src/commands/checkpoint.js` branches on `phase === 'discussion'`, validates discussion brainstorm artifacts, prints hard-coded text options at lines 150-153, and emits JSON choices through `buildReviewChoices(..., { discussion })` at lines 124-140; `buildReviewChoices` has a separate discussion branch in `src/utils/workflow-runtime.js` lines 236-252. The proposed manifest only models assignment phases under `phases:` and explicitly leaves discussions special-cased, while the migration/success criteria say skill prose and JS should stop carrying hard-coded choice labels and that checkpoint output should render from the manifest. That leaves no source of truth for the discussion checkpoint choices: either the implementation keeps the current hard-coded discussion branch, preserving contract drift, or the discussion review prompt regresses. Please add an explicit data source and renderer path for discussion interactions, such as a `workflows.discussion`/`interactions.discussion_checkpoint` manifest section or a clearly-scoped exception with drift tests that preserve the discussion prompt and commands.

### Addressed from changelog
- (none -- first round)

## Round 2

**Verdict:** needs-changes

### Findings
1. [F2.1] The design still leaves `specdev review` outside the manifest artifact contract, so manual and automated reviewers can be pointed at stale artifacts even after `checkpoint`, `approve`, `next`, `continue`, and `status` are migrated. Current code builds the brainstorm/discussion review artifact list from static JS constants in `src/commands/review.js:71-79` (`artifactPaths.brainstorm.proposal` and `.design`) and prints that list at `src/commands/review.js:172-186`; implementation review similarly hard-codes `brainstorm/design.md` and `breakdown/plan.md` at `src/commands/review.js:188-206`. If `workflow.yaml` adds, removes, or renames required/produced artifacts, reviewers would still be instructed to inspect the old files, which directly weakens the review gate this refactor is trying to make manifest-backed. Please include `src/commands/review.js` in the consumers-second migration: derive phase review artifacts from the active manifest's `requires:` / `produces:` entries, keep discussion's brainstorm artifact mapping explicit through the new `interactions.discussion_checkpoint`/discussion path, and extend the mutated-manifest integration test to assert `specdev review brainstorm --round <n>` and implementation review output track manifest artifact changes.

### Addressed from changelog
- [F1.1] Accepted in `brainstorm-changelog.md`; the design now adds a top-level `interactions.discussion_checkpoint` manifest entry and routes discussion checkpoint choice rendering through the shared renderer while keeping discussion-specific artifact validation scoped.

## Round 3

**Verdict:** needs-changes

### Findings
1. [F3.1] The continuation/choice prose migration still misses the generated command skills, so new or updated installs can keep carrying hard-coded reviewloop behavior even after the core skills and runtime output move to manifest-backed contracts. Current command-skill source is embedded in `src/commands/init.js:194-240` and installed into `.codex/skills/specdev-reviewloop/SKILL.md` and `.claude/skills/specdev-reviewloop/SKILL.md`; those files explicitly tell agents to ask review-only vs review-then-autocontinue, follow `specdev next --json`, and carry the reviewer forward (`src/commands/init.js:203-224`, `.codex/skills/specdev-reviewloop/SKILL.md:10-31`). The design mentions minimizing `.specdev/skills/core/brainstorming`, `implementing`, `reviewloop`, and `continue`, but its migration and success criteria do not require updating the generated `specdev-reviewloop` / `specdev-continue` command skills or `src/commands/init.js`, and the proposed drift test only names core `SKILL.md` files. Under that plan, `specdev init` or `specdev update` can reinstall stale prose that bypasses the new `continuation` block, preserving the "stops after approval" / reviewer-carry drift class in the exact host-facing skills agents read. Please add the generated command skills to the migration scope: update the `src/commands/init.js` templates and installed `.codex`/`.claude` skill copies to the same generic "render runtime `interaction` / `continuation` blocks exactly" rule, and extend the drift test to reject hard-coded review choice labels, reviewer-carry instructions, and post-gate continuation commands in both core skill templates and generated command-skill templates.

### Addressed from changelog
- [F2.1] Accepted in `brainstorm-changelog.md`; the design now adds `src/commands/review.js` to the consumers-second migration and extends the manifest-as-truth integration test to assert `specdev review <phase> --round <n>` artifact output tracks manifest changes.
