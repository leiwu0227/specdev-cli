# Discussion Lane

Parent design: `./workflow_lanes.md`

Discussion is a concurrent code-read-only RippleGraph callable for exploring a design
question before implementation authority exists. It creates a durable, resumable
place for reasoning without occupying the focused Assignment or Mission scheduler.

Creation requires initialized project context, atomically reserves a Discussion ID,
records the starting Git revision, creates a `brainstorm/` directory, claims the
identity against concurrent authors, and starts the versioned callable graph.

`brainstorm/proposal.md` and `brainstorm/design.md` are stable required entry points.
Supporting regular files and nested folders may capture diagrams, alternatives, or
evidence appropriate to the topic. Symlinks, credentials, provider transcripts,
caches, dependency trees, build output, and unrelated operational files are excluded.
`design.md` remains the concise conclusion.

The callable moves from brainstorming to optional review and then waits for user
satisfaction. Completion records the ending revision and a deterministic recursive
manifest of relative path, size, and SHA-256 for every accepted artifact. Stable
ordering makes later additions, removals, renames, and content changes observable.
Completed artifacts are content-addressed rather than physically immutable: changing
them invalidates later promotion until the completed bytes are restored or a new
Discussion is created.

Discussion may coexist with product mutation because it owns only its artifacts and
engine checkpoint. Concurrent code changes may stale its observations, so promotion
revalidates both the artifact manifest and relevant repository assumptions.

Promotion to Assignment or Mission creates a fresh identity and authority contract.
The Discussion remains provenance; its user satisfaction does not become product
approval. Adhoc and focused delivery cannot absorb its independently owned paths.

## Source Targets

- `src/commands/discussion.js` — maximum 380 lines — callable creation, resume, review, and completion.
- `src/utils/discussion-artifacts.js` — maximum 210 lines — safe recursive artifact catalog and manifest.
- `src/utils/discussion.js` — maximum 70 lines — ID reservation and selector resolution.
- `src/utils/callable-sync.js` — maximum 80 lines — synchronized isolated-call access.
