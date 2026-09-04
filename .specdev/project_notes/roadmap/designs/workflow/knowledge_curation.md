# Knowledge Curation

Parent design: `./workflow_model.md`

Knowledge curation publishes reusable project guidance through a separate human
authority boundary. Any lane may discover a useful fact, but discovery, code
evidence, or completion of the originating work does not authorize publication.

Curation begins with a mutation-free scan of authoritative Markdown, current Git
revision, dirty paths, existing knowledge owners, stale FAQs, and explicitly bounded
repository evidence. Dirty sources are excluded rather than silently captured. The
scan returns a content-addressed proposal template and instructs the agent to write
the exact proposal separately in ignored operational state.

A proposal identifies exact destinations, additions or replacements, durable source
references, conflicts, exclusions, and any project-wide context change. Validation
binds the proposal to unchanged source hashes, Git facts, and destination ownership.
The user approves the exact proposal digest; a `big_picture.md` change requires a
separate exact approval.

Publication journals the approved transaction, writes each Markdown owner
atomically, records a durable receipt, and rebuilds the disposable search index.
Repeating the same approved action is idempotent. Interrupted publication recovers
from its journal without treating partially written or unapproved content as
accepted knowledge.

Knowledge has one owning note per fact. Curation replaces or supersedes an owner
rather than accumulating parallel truth. Repository code is bounded evidence, not a
knowledge database. Roadmap designs, workflow contracts, and historical artifacts
retain their own authority and cannot be rewritten through curation.

Index failure does not undo publication because Markdown and the receipt are
authoritative. Cancellation removes only operational proposal state and never
reverts already published durable content.

The current 1,200-line utility cap is a transitional compatibility ceiling. New
responsibilities should move into focused modules, allowing this ceiling to fall.

## Source Targets

- `src/utils/knowledge-curation.js` — maximum 1200 lines — scan, binding, approval, publication, and recovery.
- `src/commands/knowledge.js` — maximum 420 lines — knowledge command routing and user-facing curation states.
