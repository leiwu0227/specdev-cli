# Discussion Lane

Parent design: `./workflow_lanes.md`

## Purpose

Discussion explores an unresolved design, architecture, or product question without acquiring authority to modify the product.

It gives exploratory work a durable identity and recoverable artifacts so reasoning can continue across sessions, receive review, and inform later decisions. Discussion is appropriate when the question itself needs structured investigation rather than immediate delivery.

## Authority

Discussion may inspect the repository and evolving product state. Product code remains read-only throughout the lane.

Its write authority is limited to its own exploration artifacts. Those artifacts may describe alternatives, recommendations, risks, and a proposed design, but they do not become implementation authority or approved Roadmap design merely because they exist.

The user explicitly selects Discussion. An agent must not silently create one while answering an ordinary question or inspecting code.

## Workflow Shape

Discussion is an isolated RippleGraph callable. It has its own identity, recoverable state, and terminal boundary, but it never becomes the repository’s focused scheduler.

The callable structure distinguishes active exploration from a completed conclusion. Interrupted work resumes under the same Discussion identity and durable artifacts rather than relying on private conversation memory.

Discussion remains intentionally smaller than an Assignment. It has no product mutation phase, delivery commit, implementation evidence gate, or authority to coordinate workers.

## Collaboration and Artifacts

Discussion produces a proposal that frames the question and a design artifact that records the developed conclusion. The artifacts should preserve material alternatives and unresolved risks without becoming a transcript of every conversational turn.

The foreground agent collaborates with the user on the reasoning. Optional independent review may challenge the proposal or design, but review does not approve implementation or replace user judgment.

Completion occurs when the user is satisfied that the exploration has reached a durable conclusion. Completed artifacts represent that concluded Discussion and should not be silently rewritten afterward.

## Concurrency and Freshness

Discussion may coexist with focused Assignment or Mission work, other isolated callables, and graph-free lanes because its product boundary is read-only and its state is independently owned.

Concurrent product changes can make observations stale. Discussion therefore treats repository evidence as revision-bound context and revalidates assumptions when the current code has materially changed.

Its artifacts remain outside Adhoc and focused-workflow ownership. Another lane cannot absorb them merely because they are present in the worktree.

## Promotion and Later Work

A completed Discussion may inform Roadmap collaboration, an Assignment, or a Mission. That movement creates fresh authority and a fresh identity in the destination lane.

Promotion may preserve the Discussion artifacts as provenance, but it must revalidate their assumptions and establish a new contract or approval boundary. Exploration approval never silently becomes implementation approval.

## Design Choices

- Exploration is durable without becoming product mutation.
- Discussion identity is isolated from the focused scheduler.
- Product read-only authority enables safe concurrency.
- User satisfaction, not implementation completion, defines the terminal outcome.
- Later design adoption or implementation begins under fresh authority.
- Durable conclusions are concise artifacts, not provider transcripts.
