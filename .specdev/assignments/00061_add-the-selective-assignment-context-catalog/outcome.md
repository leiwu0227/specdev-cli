# Outcome

## Delivered behavior

SpecDev now builds a replaceable provider-neutral Assignment context catalog at every foreground or spawned handoff. Catalogs contain bounded repository-relative path identities ordered as authority, task, supporting context, and permitted role history; required authority/task inputs fail closed, while optional project context, guides, fresh knowledge, and Roadmap designs degrade safely.

Standalone implementation/recovery payloads, spawned workers, primary reviewers, repairs, resolvers, arbiters, and Mission child contract authors/reviewers now receive explicit role projections. Spawned Attempt records retain the selected identities without copying contents. First reviewers exclude author history, later primary rounds may receive durable prior findings, and resolver/arbiter findings remain fresh-role task evidence.

Mission queues retain a parent-selected `context_paths` envelope alongside backward-compatible `knowledge_paths`; child selection is a relevance-filtered intersection, validates the parent contract and queue membership, and preserves the envelope through replanning. Generated Assignment guidance describes the same authority and expansion boundaries.

## Deviations

None.

## Unresolved risks

The pre-existing `test:mission-compatibility` fixture still hard-codes Assignment lifecycle `2.3.0` while the clean-HEAD template declares `2.4.0`, so it exits during fixture installation before reaching this change. The new focused catalog test directly covers Mission envelope preservation and child subset enforcement; `test:mission-environment` and `test:vnext-foundations` pass. Repository-wide lint also has four pre-existing unformatted files outside this Assignment; every changed file passes the focused Prettier check.

| Acceptance | Evidence | Result |
| --- | --- | --- |
| AC-1 | `test:assignment-context` covers normalized ordering, bounded selection, repository-relative identities, current-state regeneration, optional degradation, and required-source failure. | Passed |
| AC-2 | `test:assignment-context`, `test:implement-recovery`, and `test:reviewloop-modes` cover foreground/spawned parity, Attempt identities, reviewer lineage, candidate review, repairs, resolvers, and arbiters. | Passed |
| AC-3 | `test:assignment-context`, `test:mission-environment`, and `test:vnext-foundations` cover parent-envelope intersection, delegation validation, replanning preservation, and guide/knowledge/recovery compatibility. | Passed |
