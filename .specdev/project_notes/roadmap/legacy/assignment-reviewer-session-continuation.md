# Assignment Reviewer Session Continuation

Status: implemented

## Decision

Every standalone or Mission-owned Assignment implementation-review lineage
starts with a fresh independent reviewer session. When primary review returns a
repair obligation and the same Assignment presents a repaired candidate,
SpecDev attempts to resume that exact reviewer session for the next primary
repair-verification round. The first round remains a full review; continuation
reduces repeated orientation but does not waive inspection of the repaired
candidate, acceptance evidence, or regression risk.

Reviewer continuation is scoped to one Assignment and one independent reviewer
role. It never crosses Assignment boundaries, resumes an implementation-author
session, or shares a conversation between independent reviewer roles. Resolver
and arbiter work starts fresh. A material contract, architecture, scope, policy,
or unrelated-candidate change invalidates the reviewed baseline and starts a
fresh full reviewer session.

The adapter captures the provider's exact session or thread identifier from
machine-readable first-round output. It never selects a provider's most recent
session implicitly. The opaque session lease is ignored, replaceable
operational state bound to the Assignment identity, review lineage and role,
provider profile, model and effort, working directory, contract hash, reviewer
filesystem and network policy, and reviewed candidate identity. Each resumed
provider invocation remains a distinct Attempt and review round. The lease is
retired when the Assignment becomes terminal.

Later-round input identifies the prior blocking findings, the exact
reviewed-baseline-to-repaired-candidate delta, changed evidence, and the files
that require rereading. Durable provider-neutral contracts, candidate receipts,
verdicts, findings, evidence, workflow checkpoints, and Git identities remain
the authority and recovery path. If exact-session resume is unsupported,
missing, expired, mismatched, or fails, SpecDev reconstructs a fresh review from
those durable artifacts rather than blocking workflow recovery.

Provider-specific persistence, identifier extraction, and resume commands stay
behind bounded adapters. This decision does not add a resident reviewer process,
broker, daemon, or live provider connection. Making session continuation the
only recovery mechanism, using an ambiguous latest-session shortcut, carrying a
reviewer session into another Assignment, merging author and reviewer context,
reusing a primary reviewer as an arbiter, or weakening a resumed round's frozen
permissions requires explicit user notification and approval as an architecture
change.

## Verification

Aligned at Git revision `aea602288567df0db2964a67107cc1b301584d26`.
Assignment `00069_speeding-up-specdev-without-removing-the-safety` delivered and
independently reviewed fresh persistent Codex and Claude primary sessions, exact
session-identifier capture and resume, Assignment/profile/authority/candidate
lease binding, distinct Attempt records, reviewed-candidate delta context,
material-change invalidation, fresh resolver and arbiter execution, terminal
lease retirement, and automatic durable-artifact fallback. Verified sources
include `src/commands/reviewloop.js`, `src/utils/provider-adapters.js`,
`src/utils/reviewer-session.js`, `src/utils/spawned-agent.js`,
`src/utils/assignment-vnext.js`, shipped workflow guidance, and the focused
reviewloop, candidate, and recovery fixtures recorded by that Assignment.
