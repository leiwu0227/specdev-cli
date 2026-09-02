# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Implement the approved extensible Discussion artifact-set design. Keep `brainstorm/proposal.md` and `brainstorm/design.md` as canonical entry points while allowing useful supporting files and nested directories beneath a Discussion's `brainstorm/`, with deterministic provenance across the full Discussion lifecycle.

## Scope and non-goals

- In scope: safe recursive artifact discovery and validation; a durable deterministic manifest and aggregate identity; Discussion guidance, review, completion, immutability, knowledge discovery, and Assignment/Mission promotion; installed template and embedded-skill alignment; focused regression coverage.
- Non-goals: changing Discussion's product-read-only authority or lifecycle; permitting artifacts outside its own `brainstorm/`; removing either canonical Markdown artifact; automatically interpreting every binary format; redesigning destination Assignment or Mission contracts.

## Expected behavior

- A Discussion author may add supporting regular files in arbitrary nested directories without declaring their paths in advance.
- Every consumer sees one safely enumerated artifact set with normalized relative paths, stable ordering, per-file content fingerprints, and a deterministic aggregate identity.
- Symlinks, non-regular filesystem entries, path escapes, and documented operational-only entries fail closed instead of entering the manifest.
- Review receives the complete artifact catalog while continuing to treat `design.md` as the concise conclusion. Completion persists the exact manifest, and later mutation, addition, removal, or rename is detected before promotion.
- Eligible textual supporting artifacts participate in knowledge discovery. Assignment and Mission promotion retain the completed Discussion identity and manifest as provenance.

## Important decisions

- `proposal.md` and `design.md` remain required; supporting artifacts extend rather than replace the canonical pair.
- Regular files, not directories, are manifest identities. Nested directories organize artifacts but empty directories carry no provenance.
- The structured recursive manifest is the source of truth for the completed artifact set. An aggregate digest remains available as a compact identity.
- Promotion references and revalidates Discussion provenance; it does not copy supporting files into a destination contract automatically.

## Constraints and invariants

- Preserve Discussion isolation, product-read-only authority, and completed-artifact immutability.
- Keep source templates, generated/embedded skill guidance, and installed update surfaces consistent; do not patch installed runtime copies as product source.
- Do not authorize provider transcripts, credentials, caches, dependency trees, build output, or unrelated operational files as Discussion artifacts.
- Preserve promotion and immutability behavior for existing completed Discussions containing only the canonical pair.
- Follow the compact command-level testing strategy described in `knowledge/architecture/reduced-test-suite.md`; add coverage only for user-visible behavior not already protected structurally.

## Delegated and reserved authority

- Delegated: choose the manifest schema/version, traversal and hashing utility boundaries, exact documented operational-entry policy, efficient handling of binary content, compatibility representation, and focused test organization.
- Reserved for the user: changing canonical artifact requirements, broadening Discussion write authority, changing lifecycle or approval semantics, copying artifacts during promotion, or dropping legacy compatibility.

## Risks and assumptions

- Recursive traversal can introduce security, determinism, performance, and cross-platform path risks; one shared implementation must prevent consumers from drifting.
- Arbitrary-format support means cataloging and fingerprinting an artifact does not guarantee every reviewer or knowledge consumer can interpret its contents.
- Existing canonical-only completion identities are assumed recoverable without rewriting completed Discussion artifacts.

## Verification authority

- Any focused test command requires explicit user approval under repository instructions.
- Full suite also requires separate explicit user approval.

## Acceptance criteria

- AC-1: A Discussion with required canonical files plus nested supporting regular files can advance, review, and complete with a deterministic recursive manifest; stable reruns reproduce it, while unsafe filesystem entries fail closed with actionable errors.
- AC-2: The completed manifest governs immutability and is revalidated by Assignment and Mission promotion; additions, removals, renames, or content changes are detected, and eligible supporting text is discoverable without displacing `design.md` as the primary conclusion.
- AC-3: User-facing CLI output, workflow packages, template skills, generated/embedded mirrors, and focused regression coverage consistently describe and enforce extensible artifacts, while existing canonical-only completed Discussions remain usable.
