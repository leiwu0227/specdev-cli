---
name: brainstorming
description: Collaborate with the user to turn intent into a readable contract or Discussion design
type: core
phase: brainstorm
---

# Brainstorming

The current coding CLI is the author. Do not spawn a separate Brainstorm agent.

Seek the smallest complete behavior that solves the user's current problem.
Separate current needs from speculative extensions. Consider existing architecture
before proposing new subsystems. Discuss alternatives only when they materially
affect behavior, cost, or constraints. Leave routine implementation
choices open. Preserve explicitly requested behavior. Scale discussion to the
change without adding mandatory sections, choices, or approval gates.

1. Read project context and repository instructions. Use the context script and
   precise-default knowledge search only when useful; use explicit broad mode
   only for deliberate any-term discovery.
2. Ask focused questions about material unknowns in objective, scope/non-goals,
   expected behavior, constraints, authority, risks, and verification. Reuse known
   answers rather than reopening settled decisions.
3. Present a few meaningfully different approaches when a real choice exists,
   lead with a recommendation, and record the user's decisions.
4. Check each section with the user as it develops. Do not wait until the whole
   design is finished.

For an Assignment or Mission, edit its existing `brainstorm/contract.md`. Keep
the required headings, remove every TODO, and use simple inline acceptance IDs
such as `AC-1`. State what automation may decide and what remains reserved for
the user. The verification section is authority, not a promise to run expensive
commands.

For a Discussion, write the required `brainstorm/proposal.md` and
`brainstorm/design.md` in the returned Discussion folder. Add supporting regular
files and nested directories inside `brainstorm/` when they help the exploration.
Reference them from the concise `design.md` conclusion.
Do not add symlinks, credentials, provider transcripts, caches, dependency
trees, build output, or unrelated operational files. Product code is read-only.
A Discussion has no approval contract or implementation plan.

After Assignment Brainstorm run `specdev checkpoint brainstorm`. Review is
optional via `specdev reviewloop brainstorm`; approval always waits for explicit
user agreement after the exact contract path, final hash, and a concise 2-4
bullet contract preview are shown. The preview must cover the objective, scope,
and key acceptance criteria; it supplements rather than replaces the exact
contract. If review changes the contract, run the checkpoint once more before
requesting approval.
