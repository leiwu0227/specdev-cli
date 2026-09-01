# Work Types (Lanes)

Status: proposed

## Decision

SpecDev recognizes these user-facing work types, also called lanes:

| Lane | Core purpose | Mutation authority | RippleGraph role | Concurrency class |
| --- | --- | --- | --- | --- |
| **Direct** | Questions, status, read-only inspection, and user-requested non-code documentation work | Bounded non-code documentation writes; an explicitly requested ordinary exact-path Git commit is allowed, but Direct never changes functional product behavior | None | No scheduler |
| **Adhoc** | One bounded governed repository change when an Assignment contract and review cycle would be ceremony | Functional product writes only within the selected scope; it may also govern important documentation that needs a receipt and delivery boundary | None | One active per worktree; one-shot writer with unambiguous ownership, not a scheduler |
| **Discussion** | Exploratory design and synthesis | Product code is read-only; it owns only its bounded Brainstorm artifacts | Isolated callable | May coexist with focused work and other isolated callables |
| **Assignment** | One contract-bounded product change | Standalone work uses an exact user-approved contract; a Mission child uses an exact parent-bounded child contract | Stateful focused workflow | Uses the single focused Assignment/Mission scheduler |
| **Mission** | A user-selected foreground controller coordinating an approved objective through Assignment work | Product writes occur only through parent-bounded Assignment authority | Stateful focused workflow and foreground controller | Owns the focused scheduler; defaults to one full-scope child; when the approved contract selects a justified planned shape, the parent-bounded design may run bounded parallel waves only for mutually independent children |
| **Test Audit** | Analysis that may prepare an exact test-pruning Assignment | Product code and tests are read-only; it owns only its audit artifacts | Isolated callable | May coexist with focused work and other isolated callables |

Functional product impact, not file extension or line count, defines the minimum governed lane. Source code, scripts, behavior-changing configuration, schemas, dependencies, generated runtime templates, and equivalent implementation changes require at least Adhoc. Use Assignment or Mission when the scope, uncertainty, approval needs, or review needs exceed a bounded Adhoc change.

Non-code work is eligible for Direct. Documentation starts with a Direct presumption when it records or clarifies existing reality and has low consequence if imperfect. Normative authority, external commitments, security or operational harm, compatibility promises, migration or release consequences, and a need for durable review or evidence are concrete reasons to select Adhoc or Assignment instead. When importance is ambiguous, the agent explains the concern and asks the user rather than silently creating workflow state. Explicit user selection may raise an otherwise Direct document into a governed lane.

A Direct documentation commit is ordinary Git work, not a SpecDev delivery workflow. It occurs only when the user explicitly requests a commit, stages only the requested documentation paths, preserves unrelated changes, follows repository commit instructions, and creates no SpecDev receipt or delivery trailer. Without an explicit commit request, Direct does not commit automatically. A documentation-only comment change remains eligible for Direct even when its file also contains source code, provided no functional behavior changes.

Files under `.specdev/` follow semantic ownership rather than selecting Adhoc by location. Discussion, Assignment, Mission, Test Audit, project-note publication, knowledge curation, installation, and runtime commands own their respective subtrees and transitions. Managed runtime and engine state are never opportunistically edited through Direct or Adhoc. An open Discussion may draft an architecture note inside its Brainstorm. After the agent points the user to the unchanged draft and destination and receives explicit approval, the agent applies it directly in an architecture-only ordinary Git commit; this neither starts Adhoc nor changes the Discussion phase.

Knowledge curation remains a lane-independent governed action. Protected architecture publication is instead a lane-independent Direct documentation action with one explicit approval of an unchanged readable draft and destination, followed by an architecture-only ordinary Git commit. It has no separate transaction, receipt, or workflow phase.

Adding, removing, or merging a lane, or changing its core purpose, mutation authority, RippleGraph role, or concurrency class, is a material redefinition. Making knowledge curation lane-dependent, or turning protected architecture publication back into a separate command, transaction, receipt, or workflow, is also an architecture change. Either requires explicit user notification and architecture approval.

## Conformance target

Assignment `00074_remove-the-protected-architecture-publication-ma` must align canonical templates, generated adapters and skills, public guidance, command behavior, and focused regression evidence with this decision. Until authorized conformance evidence is accepted, this note remains `proposed`.
