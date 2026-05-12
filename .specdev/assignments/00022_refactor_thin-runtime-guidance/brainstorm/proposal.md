# Proposal: Thin Runtime Guidance

Now that SpecDev has an installed workflow manifest and `specdev next --json`, the next refactor should reduce duplicated procedural guidance across command skills, guides, and agent-facing workflow prose. The goal is to make agents use the runtime contract as the first decision surface, while keeping phase skills as focused step guides.

This should be a conservative cleanup of the installed workflow model, not a broad product rewrite. The existing `.specdev` assignment folder structure, checkpoint gates, and reviewloop behavior should remain intact. The refactor should remove or rewrite duplicated "figure out what to do next" instructions so the workflow feels thinner and more deterministic in practice.

During implementation the scope expanded to include two related simplifications discussed with the user: a lighter breakdown/implementation task contract with risk-scaled verification, and replacement of mandatory final distillation with optional phase-end knowledge capture that prunes or replaces stale notes before adding new ones.
