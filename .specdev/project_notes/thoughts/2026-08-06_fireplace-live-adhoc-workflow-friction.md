# Fireplace live Adhoc workflow friction and improvement opportunities

## Context

This note records friction observed while using SpecDev live in the Fireplace
repository on 2026-08-05 and 2026-08-06. The representative sequence was four
small, user-selected UI changes delivered through consecutive Adhoc runs:

1. hide server-management controls in browser mode;
2. keep artifact-preview actions reachable on narrow mobile screens;
3. add a per-server device-pairing QR action in native Settings; and
4. add an iOS-only notification preference with a complete APNs
   register/unregister lifecycle.

All four changes were good fits for Adhoc. They were bounded, did not need a
RippleGraph, and benefited from one receipt plus one final commit. The workflow
did not block delivery. The drag was concentrated around launcher resolution,
dirty-worktree interpretation, manually reconstructed verification evidence,
and post-finish inspection.

## What worked well

### Adhoc matched live UI iteration

The user was testing Fireplace interactively and reporting one concrete issue
at a time. Promoting each issue to an Assignment would have added authority and
review ceremony without improving the decision. Adhoc preserved the useful
parts of SpecDev—declared scope, bounded edits, verification evidence, durable
receipt, and an atomic delivery commit—without introducing a scheduler.

### Scope remained legible

Each `specdev adhoc start` printed the identity and scope before implementation.
This made it easy to distinguish the active change from two older untracked
Discussion folders that were present throughout the work.

### Automatic receipt and commit were valuable

`specdev adhoc finish` consistently created the receipt and the product commit
as one operation. This prevented the common failure mode where implementation
lands but its verification rationale remains only in the chat transcript.

### The lane encouraged proportional evidence

The changes used focused Vitest files, a web production build, touched-file
lint, and in one case a 390px Playwright layout probe. Nothing in Adhoc pushed
the worker toward an unrelated full suite. This matched the repository's
proportional-verification rule well.

## Observed sources of drag

### 1. Launcher resolution is correct in policy but repetitive in practice

The installed workflow says to prefer `.specdev/cache/bin/specdev` when it
exists and fall back to `specdev` on `PATH` otherwise. In this checkout,
`.specdev/cache/` existed but `.specdev/cache/bin/specdev` did not.

The first finish attempt used the expected cached path and failed before doing
any work:

```text
zsh:1: no such file or directory: .specdev/cache/bin/specdev
```

The worker then located `/opt/homebrew/bin/specdev` and used an explicit test on
every subsequent lifecycle command:

```sh
if [ -x .specdev/cache/bin/specdev ]; then
  .specdev/cache/bin/specdev ...
else
  specdev ...
fi
```

This is not a correctness bug—the documented fallback worked—but it creates
avoidable command noise and leaves the agent responsible for implementing the
same version-safety policy repeatedly. A cache directory that exists without a
launcher also makes a naive path inference more likely.

### 2. The written dirty-tree rule and observed Adhoc behavior are ambiguous

The Fireplace worktree repeatedly contained these untracked paths:

```text
?? .specdev/discussions/D00029_electron-gui-lag-with-many-open-sessions-identif/
?? .specdev/discussions/D00030_compose-history-based-completion-retain-up-to-50/
```

The Adhoc skill and `_main.md` say that Adhoc refuses a dirty start until the
user inspects, separately checkpoints, or explicitly adopts every existing
change. The worker inspected the paths and stated that they were pre-existing
workflow artifacts that would remain untouched. `specdev adhoc start` then
succeeded without `--adopt-dirty`.

That behavior may be intentional—for example, Adhoc may distinguish dirty
product paths from independent SpecDev records—but neither the command output
nor the rule explains the distinction. The foreground agent must guess whether
the successful start means:

- those paths are deliberately outside the Adhoc dirty boundary;
- untracked Discussion artifacts are always ignored;
- the CLI failed to detect them; or
- a prior inspection in chat is considered sufficient even though the CLI
  cannot observe that inspection.

This is the most important issue from this live run. The safety rule is strong,
but the command does not expose the classification that allowed the workflow
to proceed.

### 3. `adhoc finish` requires manually transcribing verification evidence

For every change, the worker ran tests and builds, read their results, and then
manually compressed them into a long `--verification="..."` argument. A typical
finish command repeated:

- the exact focused Vitest file list;
- passed file and test counts;
- build status;
- lint status;
- an additional browser-layout or host-boundary check; and
- `git diff --check` status.

This works, but the evidence is detached from the commands that produced it.
It is easy to mistype a count, omit a failed-then-corrected run, lose quoting in
the shell, or produce inconsistent receipt wording between otherwise similar
Adhocs.

The problem is not that Adhoc requires evidence. The problem is that its only
input is an unstructured summary reconstructed by the agent after the fact.

### 4. Finish output is too small to serve as the final handoff

Successful completion printed the identity, receipt path, starting commit, and
ending commit. The foreground worker still ran this sequence after every
finish:

```sh
git status --short
git show --stat --oneline --summary HEAD
```

Those checks answered essential handoff questions that the finish output did
not:

- Which source files entered the commit?
- Did an untracked or unrelated path remain?
- Was the expected new file included?
- What did the generated commit subject look like?
- Did SpecDev leave the product tree clean?

Because `adhoc finish` owns the commit, it is the best place to report this
information. Requiring a second Git inspection is safe but repetitive.

### 5. Scope-derived commit subjects are truncated mid-phrase

Several generated subjects ended visibly incomplete, for example:

```text
specdev(adhoc): Hide server-add and connect controls in browser mode while preservin
specdev(adhoc): Keep artifact preview header actions and close control reachable on
specdev(adhoc): Add per-server QR pairing buttons to native Server settings using th
```

The commit remains identifiable through its Adhoc ID and receipt, so this is
not a lifecycle failure. It does reduce Git-log readability and makes a polished
scope look accidental after deterministic character truncation.

### 6. Mandatory per-subtask announcements are useful but too granular

The `Specdev: <action>` rule helped the user see that the workflow was still
being followed. Across a short Adhoc, however, literal announcement before
every inspection, patch, focused test, build, lint, diff review, finish, and
final status check produced many nearly mechanical updates.

This confirms the earlier DataPortal observation: the useful unit is a
meaningful phase or change of plan, not every read-only shell command. Excessive
announcements make the genuinely important messages—scope changes, failed
verification, and fallback decisions—less prominent.

### 7. Repeated Adhocs are correct but could have a more compact operator loop

The four runs correctly produced four commits. Atomicity should be preserved.
Still, a live-testing session repeats the same outer sequence many times:

```text
inspect status → start → implement → verify → finish → inspect status
```

No new workflow lane is needed, and a long-lived rolling Adhoc would weaken the
one-scope/one-commit property. The opportunity is to make this existing loop
more self-reporting and less manually reconstructed.

## Recommended improvements

### Priority 1: make dirty-path classification explicit

`specdev adhoc start` should print and return a structured worktree decision,
for example:

```json
{
  "product_dirty": [],
  "workflow_dirty": [
    ".specdev/discussions/D00029_.../",
    ".specdev/discussions/D00030_.../"
  ],
  "ignored_by_policy": ["workflow_dirty"],
  "adopted": [],
  "decision": "start_allowed"
}
```

If independent Discussion artifacts are intentionally allowed, document that
exception in `_main.md` and the Adhoc skill. If they are not intended to be
allowed, the start above should fail consistently. Either outcome is better
than a safety rule whose exception is only inferable from success.

The human-readable output should be equally direct:

```text
Product worktree: clean
Independent workflow artifacts: 2 (preserved, outside Adhoc commit scope)
Adhoc start: allowed
```

### Priority 2: resolve the launcher once

Provide one stable installed launcher contract. Possible approaches include:

1. always materialize `.specdev/cache/bin/specdev` during installation/update;
2. install a tiny tracked or generated shim whose only job is safe resolution;
3. expose `specdev env --launcher` or `specdev doctor --json` and have skills
   use its result; or
4. generate a shell-safe command in workflow metadata.

The important property is that every skill and agent does not need to rewrite
the same `if [ -x ... ]` fallback. If the workspace wrapper is optional, the
official example should be a copyable resolver, not two prose branches.

### Priority 3: add structured verification capture for Adhoc

Keep `--verification` for concise human conclusions, but add a way to bind
command evidence without manual transcription. For example:

```sh
specdev adhoc verify --label="focused web tests" -- \
  pnpm --filter @fireplace/web exec vitest run ...

specdev adhoc verify --label="production build" -- \
  pnpm --filter @fireplace/web build
```

The command could record:

- argv and working directory;
- start/end time and exit code;
- a bounded final-output summary;
- whether the run passed, failed, or was skipped;
- the Git revision tested; and
- an optional human annotation.

`adhoc finish` could then consume the successful evidence records and require
only an outcome statement. This should remain optional so repositories that
require explicit test approval can approve each command before it runs.

### Priority 4: print a complete Adhoc delivery receipt at finish

After committing, `adhoc finish` should print or return:

- Adhoc ID and scope;
- receipt path;
- delivery commit and final subject;
- changed source paths, grouped separately from the receipt;
- verification labels and results;
- starting and ending commit;
- remaining dirty paths classified as product or workflow state; and
- a final `product worktree clean: yes/no` field.

This would eliminate the routine post-finish `git status` and `git show`
sequence while making the terminal output suitable for the user's immediate
handoff.

### Priority 5: truncate generated subjects at semantic boundaries

Derive the commit subject with a word-aware algorithm and reserve space for the
prefix. Prefer removing a trailing clause over cutting a word. Also consider:

```sh
specdev adhoc start "full scope" --title="Mobile preview actions stay reachable"
```

The full scope would remain in the receipt; the shorter title would be used for
the commit and filenames.

### Priority 6: define announcements at phase boundaries

Revise the default repository instruction toward:

> Announce every meaningful SpecDev subtask or phase transition. Repeated
> read-only probes within the announced subtask do not require separate
> announcements unless they reveal a blocker or change the plan.

For Adhoc, the normal announcement points would be:

1. classification and start;
2. implementation approach;
3. verification;
4. any failure or plan change; and
5. finish/commit.

This preserves trust and visibility while reducing transcript noise.

### Priority 7: optimize repeated use without weakening atomicity

Do not introduce a rolling multi-change Adhoc. Instead, make `finish` complete
enough that the next `start` can begin without manual Git archaeology. A
machine-readable final receipt plus explicit remaining-path classification is
likely sufficient to make live UI testing feel fast while retaining one
bounded change and one commit per run.

## Suggested acceptance scenarios

### Scenario A: independent Discussion artifacts are present

1. Create an untracked or active Discussion artifact.
2. Run `specdev adhoc start` for an unrelated product change.
3. Verify that the CLI either rejects it under a documented rule or explicitly
   classifies and preserves it under a documented exception.
4. Verify that finish cannot accidentally include the Discussion artifact.

### Scenario B: workspace launcher is absent

1. Keep `.specdev/cache/` but remove or omit `.specdev/cache/bin/specdev`.
2. Follow the generated skill instructions verbatim.
3. Verify that the first lifecycle command resolves the supported launcher
   without an ENOENT attempt or ad hoc shell branching.

### Scenario C: verification includes a failed first attempt

1. Record a focused test that fails.
2. Fix the product issue and record the passing rerun.
3. Finish the Adhoc.
4. Verify that the receipt distinguishes the superseded failed run from the
   acceptance evidence instead of presenting only a manually typed summary.

### Scenario D: finish leaves unrelated workflow state

1. Complete and finish an Adhoc while independent workflow artifacts remain.
2. Verify that finish reports the committed source paths and the preserved
   workflow paths separately.
3. Verify that `product worktree clean` is true even if raw `git status` is not
   empty.

### Scenario E: long scope produces a readable commit

1. Start an Adhoc with a scope longer than the commit subject limit.
2. Finish it without supplying an explicit title.
3. Verify that the generated subject ends at a word or clause boundary and
   remains understandable in `git log --oneline`.

## Bottom line

Adhoc itself was the right workflow and materially improved the quality of the
Fireplace live-testing changes. The remaining drag is not additional approval
ceremony; it is missing operational explanation around the lane. The highest
value improvements are to expose why a dirty start is allowed, resolve the
launcher once, capture verification structurally, and make finish output
complete enough that the user and agent do not need a second manual Git audit
after every small change.
