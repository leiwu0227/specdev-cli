---
name: specdev-adhoc
description: Run a user-explicitly-selected Adhoc change without a RippleGraph workflow
---

Use Adhoc only when the user selects a concrete bounded repository change and
does not want that detour to become another Assignment. This does not reject or
terminate an unrelated active Assignment. Start with `specdev adhoc start
"<scope>"`.

Make the smallest complete change within the selected scope. Understand the affected
flow and callers. Reuse existing code and patterns. Prefer suitable standard-library,
native, or installed capabilities. New abstractions, dependencies, configuration, and
fallbacks need a concrete current reason. Preserve readability, architectural
boundaries, and required validation, security, accessibility, and error handling.
Resolve routine choices within authority. Ask when material unknowns
affect behavior or scope, authority is missing, or an actual conflict prevents delivery.
Hypothetical concerns alone should not block work. Verify proportionally with
authorization, reuse valid evidence, and finish when the change and existing delivery
obligations are complete. Record actual limitations and revisit triggers only when
useful. These principles add no Brainstorm phase, contract approval, worker delegation,
or automatic review gate.

1. Before starting, read the Direct and Adhoc section of
   [the workflow reference](.specdev/_guides/workflow.md#direct-and-adhoc).
   It owns dirty-path adoption, coexistence, revalidation, and delivery rules.
   Follow the main guide for request routing and shared authority.
2. If behavior or conventions are unfamiliar, use the Knowledge section of
   [the workflow reference](.specdev/_guides/workflow.md#knowledge).
   Read only relevant results and verify them against current code.
3. Run `specdev adhoc start "<scope>"`. Use `--title="..."` for a short
   commit subject. Resolve reported ownership conflicts before making changes.
4. Make the bounded change directly. Use the Verification section of
   [the workflow reference](.specdev/_guides/workflow.md#verification).
   Record authorized commands with `specdev adhoc verify --label="..." -- <command>`.
5. Finish with `specdev adhoc finish --outcome="..."` when the latest evidence
   for every label passes. For manual checks, use `--verification="..."`.
   Finish creates the receipt and delivery commit. Inspect its remaining-path report.
6. If focused work coexists, recheck its contract assumptions and follow the
   reference's revalidation rules before that work advances. To cancel the detour,
   use `specdev adhoc cancel`; source changes remain untouched.

Announce meaningful phases, plan changes, failed verification, and blockers
with "Specdev: <action>"; repeated read-only probes need no separate announcement.
