# Fresh Mission promotion can deadlock on lifecycle migration before Design

## Summary

Live testing in the Fireplace repository exposed a high-friction compatibility
failure while promoting a completed Discussion into a Mission. A newly created
Mission was pinned to `mission-lifecycle@1.3.0`, while the active SpecDev CLI
controller expected `mission-lifecycle@1.4.0`. The controller correctly refused
to run the incompatible graph and directed the operator to:

```text
specdev mission migrate M00005
```

After `specdev update` installed the 1.4.0 workflow package, the migration still
could not run because M00005 was at the Brainstorm node and therefore did not yet
have `design/assignments.yaml`. The migrator unconditionally read the queue
before checking the Mission phase and failed with:

```text
Mission queue is missing.
```

This produced a deadlock in the supported command surface:

- `mission run` required migration;
- `mission migrate` required a queue;
- the queue could only be created after Mission approval and Design;
- approval/Design could only be reached through `mission run`.

The eventual workaround was to pause the brand-new M00005, create M00006 from
the same completed Discussion after the update, and manually carry the agreed
contract into M00006. M00006 was correctly pinned to 1.4.0 and validated.

No product code was at risk, and the failed migration wrote no partial journal.
However, the workflow required several incidental user approvals, created a
superseded Mission identity, and turned a straightforward promotion into a
lengthy infrastructure diagnosis.

## Environment

- Product repository: `fireforge/lib/fireplace`
- SpecDev CLI: `0.0.4`
- Date: 2026-08-04
- Source Discussion: D00028
- First promoted Mission: M00005, pinned to `mission-lifecycle@1.3.0`
- Replacement Mission: M00006, pinned to `mission-lifecycle@1.4.0`
- M00005 phase at failure: `brainstorm`
- M00005 child queue: correctly absent

## Reproduction timeline

### 1. Complete the Discussion

D00028 captured an adaptive iPhone/iPad product design. The user resolved the
major decisions interactively, then explicitly requested promotion into a
Mission.

```text
specdev discussion D00028 --complete
```

This succeeded and advertised:

```text
specdev mission create --from-discussion=D00028
```

### 2. Create the promoted Mission

```text
specdev mission create --from-discussion=D00028
```

This created M00005 at Brainstorm. Its RippleGraph checkpoint recorded:

```json
{
  "graphSource": {
    "graphId": "mission-lifecycle",
    "graphVersion": "1.3.0",
    "packagePath": "workflows/mission-lifecycle@1.3.0"
  },
  "position": {
    "graph": "mission-lifecycle",
    "node": "brainstorm"
  }
}
```

The Mission contract was then filled normally.

### 3. Validate the contract

```text
specdev mission run M00005
```

The controller returned:

```text
Mission M00005: migration-required
Blocker: Mission M00005 is pinned to mission-lifecycle@1.3.0, which requires
migration before this controller can continue.
Run: specdev mission migrate M00005
```

This early compatibility refusal is desirable in principle: it prevented a
known 1.3.0/1.4.0 semantic mismatch from being discovered after child work.

### 4. Run `specdev update`

The workspace catalog initially exposed 1.3.0. The user ran:

```text
specdev update
```

The catalog then exposed `mission-lifecycle@1.4.0`, while correctly preserving
the active M00005 checkpoint at 1.3.0. Retrying `mission run` still required the
explicit migration, as expected for a pinned workflow.

### 5. Approve and run the migration

Because the available migration guidance was for general `.specdev` layout
migration, the foreground agent first wrote a no-move migration plan and asked
for approval. The user explicitly approved, then ran the supported operation:

```text
specdev mission migrate M00005
```

The command failed immediately:

```text
Mission queue is missing.
```

No `mission-migration.json` journal was created, so the failure was clean but
unrecoverable through the advertised command.

### 6. Recover by replacing the Mission

After another explicit user decision, the workflow used:

```text
specdev mission pause M00005
specdev mission create --from-discussion=D00028
```

M00006 was pinned to `mission-lifecycle@1.4.0`. The agreed contract had to be
copied into its fresh skeleton. M00006 then validated and its authoritative
Brainstorm review passed.

M00005 remains paused with a misleading next action to resume it, even though it
is intentionally superseded and still cannot migrate.

## Root cause in the current source

### Compatibility preflight advertises migration correctly but incompletely

`src/utils/mission-compatibility.js` identifies 1.3.0 as migratable and returns
`specdev mission migrate <id>`. This is correct only if the migrator can handle
the Mission's current phase and if the 1.4.0 target package is installed.

The preflight did not distinguish:

- target graph package absent before `specdev update`;
- target package installed and migration possible;
- target package installed but current phase unsupported by the migrator.

The first response therefore told the operator to migrate even though update was
the first prerequisite.

### The migrator reads Design state before checking the current phase

`src/utils/mission-migration.js` currently begins `planMigration()` with:

```js
const queuePath = join(missionPath, 'design', 'assignments.yaml')
const queue = await readYamlFile(queuePath, 'Mission queue')
validateQueueAndGaps(currentMission, queue)
```

Only afterward does it validate the Mission/checkpoint position and map the
graph. At Brainstorm, the queue must not exist yet. The migration from one
Brainstorm node to the other needs only Mission identity, checkpoint, contract,
and graph mapping; requiring Design output creates the circular dependency.

### Promotion creates the right fresh authority but little useful seed content

`src/commands/mission.js` uses the Discussion proposal's first Markdown heading
as the new objective. In this case the heading was:

```text
# Proposal: one adaptive Fireplace client for iPhone and iPad
```

The resulting objective became `Proposal: one adaptive Fireplace client for
iPhone and iPad`, and that prefix leaked into the Mission slug and truncated
branch name.

The promoted contract contained source links and an otherwise blank TODO
skeleton. This preserves the intended fresh authority boundary, but it requires
substantial manual retranscription even after a detailed, completed Discussion.

### Multi-child review policy is guidance rather than an enforced transition

The Mission contract used `Initial child plan: planned`. The installed workflow
guidance says multi-child Mission contracts receive Brainstorm review, but
`specdev mission run M00006` moved directly to `awaiting_approval` and advertised
`--approve`. The foreground agent had to remember to invoke:

```text
specdev reviewloop mission --mission=M00006
```

The review passed, but the CLI's next action could have allowed approval without
the review implied by the workflow rules.

## User-visible drag

### Incidental approval gates eclipsed the product decision

The useful user decisions were simple: Mission versus Assignment, iPad drawer
behavior, split-pane behavior, tabs, and device-local preferences. After those
were resolved, infrastructure introduced additional turns for:

1. explaining why migration was requested;
2. trying `specdev update`;
3. writing and approving a generic layout-migration plan;
4. running the migration;
5. explaining the queue deadlock; and
6. approving pause-and-recreate recovery.

These gates did not protect product authority. They were recovery ceremony
caused by tooling version skew.

### The migration taxonomy was confusing

The CLI requested a Mission lifecycle migration, while the available
`specdev-layout-migration` skill governs filesystem moves and requires a layout
plan. This encouraged a no-op filesystem migration plan for an operation that
only needed command-owned checkpoint mapping.

There should be a clear distinction among:

- workspace/runtime update (`specdev update`);
- Mission graph migration (`specdev mission migrate`); and
- legacy filesystem layout migration (`specdev migrate`).

Each needs different safety rules and user messaging.

### Superseded Mission state is not expressible

The safe workaround could pause M00005 but could not mark it `superseded` by
M00006 or abandon it through a Mission-specific semantic command. Its durable
next action remains "Resume", which is factually wrong for the chosen recovery.

### Updated SpecDev-owned files appeared as project dirt

After `specdev update`, Mission validation summarized updated `.claude/skills`
and `.codex/skills` paths as existing project changes to preserve, while other
workflow paths were classified as infrastructure. SpecDev-installed skill
updates should be classified consistently so the approval boundary does not
make them look like unrelated product edits.

## What worked well

- The compatibility preflight stopped the old graph before any worker or child
  Assignment launched.
- Workflow pinning made the mismatch explicit and reproducible.
- `specdev update` preserved the active Mission rather than silently rewriting
  its authority.
- The failed migration wrote no partial journal.
- Discussion completion hashes prevented promotion from changed artifacts.
- Recreating from the completed Discussion produced a fresh, correct 1.4.0
  identity.
- The M00006 contract checkpoint exposed an exact SHA-256 and concise preview.
- The authoritative Claude Opus Brainstorm review completed in about 66 seconds,
  approved the contract, and reported no divergence.

The problem is therefore not the exact-hash, review, or pinning model. It is the
missing supported transition for a perfectly valid pre-Design Mission.

## Recommended improvements

### Priority 0: migrate pre-Design Missions without a queue

Make migration phase-aware. For `create-mission`, `brainstorm`, and
`approve-mission` positions:

- do not require `design/assignments.yaml`;
- do not require gaps or child identities;
- map only the Mission record, checkpoint graph source/position, and any
  checkpointed contract output/gate decision;
- record an explicit absent/pre-design queue state in the journal; and
- preserve exact contract hashes and review artifacts if present.

Queue validation should begin only at phases whose durable protocol requires a
queue.

### Priority 1: make the compatibility response prerequisite-aware

Before advertising `mission migrate`, verify that:

1. the target graph package is installed;
2. the current Mission phase is supported by that migration; and
3. all phase-specific durable prerequisites are present.

Suggested responses:

```text
update-required: install mission-lifecycle@1.4.0 with `specdev update`
migration-required: run `specdev mission migrate M00005`
migration-unsupported-at-phase: recreate or use a specific recovery command
```

Do not direct the user to a command that deterministically cannot run.

### Priority 2: test create/update/migrate as one compatibility scenario

Add an integration test that starts with a workspace catalog on 1.3.0, creates a
Mission at Brainstorm, updates installed workflow packages to 1.4.0, and migrates
the still-pre-Design Mission. This is the exact missing path.

The test should assert that migration:

- succeeds without a queue;
- preserves the contract content/hash and Discussion source hash;
- retains Brainstorm or approval position exactly;
- pins the checkpoint to 1.4.0;
- creates a complete crash-resumable journal;
- does not reserve child IDs or launch providers; and
- lets `mission run` continue normally.

### Priority 3: provide a semantic supersede/recreate recovery

Even with a fixed migrator, unsupported future transitions need a first-class
fallback. Consider:

```text
specdev mission supersede M00005 --from-discussion=D00028
```

or:

```text
specdev mission recreate M00005
```

The operation should create the fresh identity, link old and new records, carry
forward only unapproved Brainstorm content or completed source authority, and
mark the old Mission `superseded` with the correct next action. It must never
copy approval across a changed contract hash.

### Priority 4: seed promotion more intelligently

For `mission create --from-discussion`:

- strip conventional prefixes such as `Proposal:` from the heading used as the
  objective;
- derive a clean bounded slug and branch name;
- optionally seed objective, scope, decisions, risks, and acceptance candidates
  from known Discussion sections while leaving approval fresh; and
- show exactly what was inherited versus what still requires authoring.

Fresh identity should mean fresh approval, not necessarily manual retyping.

### Priority 5: enforce or clearly label Mission Brainstorm review policy

If `Initial child plan: planned` requires review, `mission run` should either run
it automatically or return `review-required` before `awaiting_approval`. If
review is truly optional, update the workflow rule so the agent is not expected
to infer a stronger gate than the CLI enforces.

### Priority 6: split migration skills and guidance

Add distinct guidance for:

- active Mission graph migration;
- SpecDev runtime update; and
- filesystem layout migration.

The Mission-migration path should not require a filesystem move plan when the
command is atomic, scoped to one Mission, and already records a journal.

### Priority 7: classify SpecDev-owned update changes consistently

Dirty-boundary summaries should recognize installed `.claude/skills`,
`.codex/skills`, workflow packages, and other updater-owned paths as SpecDev
infrastructure. The report should still disclose them, but not label them as
ordinary project edits requiring adoption analysis.

## Acceptance scenarios

1. Create a 1.3.0 Mission at Brainstorm, install 1.4.0, migrate before a queue
   exists, and continue to contract validation.
2. Repeat with a checkpointed contract at `approve-mission`; preserve the exact
   hash and do not grant approval.
3. Repeat with an approved Mission before Design output; preserve approval and
   base revision without creating a queue.
4. Migrate a designed/running Mission with a queue and gaps using the existing
   strict queue validation.
5. With the target package absent, `mission run` says `update-required`, not
   `migration-required`.
6. Interrupt a pre-Design migration at every write boundary and resume without
   duplicate transitions or authority changes.
7. A failed migration before journal creation leaves Mission and checkpoint
   byte-identical.
8. A supersede/recreate recovery links both Mission identities and gives the old
   Mission a truthful terminal/non-runnable disposition.
9. Promotion from `# Proposal: Foo` creates objective `Foo`, not `Proposal: Foo`.
10. A planned-child Mission cannot be approved contrary to its configured
    Brainstorm review policy.

## Broader workflow observation

SpecDev's strongest properties held throughout this incident: durable source
hashes, exact contract authority, independent review, pinned execution, and
early compatibility refusal. The drag came from an incomplete recovery path and
from guidance that did not distinguish three kinds of migration.

The ideal experience is:

```text
Discussion completed
  -> Mission created on installed current graph
  -> contract authored/reviewed
  -> exact-hash user approval
```

If an update occurs between creation and approval, the compatible alternative
should be:

```text
update-required
  -> update
  -> phase-aware Mission migration
  -> contract validation resumes
```

It should never require a queue that cannot legally exist yet, and it should not
force the operator to manufacture a second Mission identity merely to reach the
approval gate.

