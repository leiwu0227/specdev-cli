# Discussion Lane

Parent design: `./workflow_lanes.md`

## Purpose

Discussion explores an unresolved design, architecture, or product question without acquiring authority to modify the product.

It gives exploratory work a durable identity and recoverable artifacts so reasoning can continue across sessions, receive review, and inform later decisions. Discussion is appropriate when the question itself needs structured investigation rather than immediate delivery.

## Authority

Discussion may inspect the repository and evolving product state. Product code remains read-only throughout the lane.

Its write authority is limited to its own `brainstorm/` directory. Artifacts there may describe alternatives, recommendations, risks, experiments, and a proposed design, but they do not become implementation authority or approved Roadmap design merely because they exist.

The user explicitly selects Discussion. An agent must not silently create one while answering an ordinary question or inspecting code.

## Workflow Shape

Discussion is an isolated RippleGraph callable. It has its own identity, recoverable state, and terminal boundary, but it never becomes the repository's focused scheduler.

The callable structure distinguishes active exploration from a completed conclusion. Interrupted work resumes under the same Discussion identity and durable artifacts rather than relying on private conversation memory.

Discussion remains intentionally smaller than an Assignment. It has no product mutation phase, delivery commit, implementation evidence gate, or authority to coordinate workers.

## Collaboration and Artifacts

Every Discussion retains two canonical artifacts: `brainstorm/proposal.md` frames the question and `brainstorm/design.md` records the developed conclusion. `design.md` remains the concise entry point for readers and references supporting artifacts where they materially inform the conclusion.

The Discussion may also create supporting regular files of any useful format and nested directories anywhere beneath its own `brainstorm/`. Examples include research notes, alternative designs, diagrams and their sources, structured data, and small analysis outputs. Supporting artifacts need not be known when the Discussion starts.

This flexibility does not turn `brainstorm/` into general workspace storage. Artifacts must contribute to the exploration. Provider transcripts, credentials, caches, dependency trees, build output, and unrelated operational files do not belong there. Symlinks and paths that escape the Discussion directory are forbidden.

The foreground agent collaborates with the user on the reasoning. Optional independent review may inspect and challenge the complete artifact set, but review does not approve implementation or replace user judgment.

Completion occurs when the user is satisfied that the exploration has reached a durable conclusion. Completion records a deterministic recursive manifest of the canonical and supporting artifacts, including their relative paths and content fingerprints. The manifest covers regular files only, uses stable path ordering, and makes additions, removals, renames, and content changes observable. Completed artifacts represent that concluded Discussion and are immutable.

## Concurrency and Freshness

Discussion may coexist with focused Assignment or Mission work, other isolated callables, and graph-free lanes because its product boundary is read-only and its state is independently owned.

Concurrent product changes can make observations stale. Discussion therefore treats repository evidence as revision-bound context and revalidates assumptions when the current code has materially changed.

Its artifacts remain outside Adhoc and focused-workflow ownership. Another lane cannot absorb them merely because they are present in the worktree.

## Promotion and Later Work

A completed Discussion may inform Roadmap collaboration, an Assignment, or a Mission. That movement creates fresh authority and a fresh identity in the destination lane.

Promotion preserves the Discussion identity and recursive artifact manifest as provenance. The destination revalidates the manifest and relevant product assumptions before relying on any artifact, then establishes its own contract or approval boundary. Exploration approval never silently becomes implementation approval.

## Design Choices

- Exploration is durable without becoming product mutation.
- `proposal.md` and `design.md` provide stable entry points without limiting supporting work.
- Nested, format-independent artifacts let the evidence fit the question.
- A safe recursive manifest makes the expanded artifact set deterministic and reviewable.
- Discussion identity is isolated from the focused scheduler.
- Product read-only authority enables safe concurrency.
- User satisfaction, not implementation completion, defines the terminal outcome.
- Later design adoption or implementation begins under fresh authority.
- Durable conclusions are curated artifacts, not provider transcripts.
