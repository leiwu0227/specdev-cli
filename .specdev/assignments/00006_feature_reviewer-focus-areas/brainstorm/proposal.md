# Proposal: Reviewer Focus Areas

Increase reviewloop max_rounds from 3 to 5 for all reviewers, and add round-specific focus instructions via a shared config. Each round targets a different review concern — architecture first, then code efficiency, then domain correctness, then general catch-all. Instructions are passed to reviewer subprocesses via a `SPECDEV_FOCUS` environment variable.
