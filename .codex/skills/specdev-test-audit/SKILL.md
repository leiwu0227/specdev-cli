---
name: specdev-test-audit
description: Audit redundant tests read-only and prepare an exact Assignment
---

Run `specdev test-audit "<scope>"`. Treat all product code and tests as
read-only. Fill only the returned Test Audit's `audit.md` and
`assignment-contract.md`; every candidate needs rationale, retained
protection, cost impact, and confidence.

Resume with `specdev test-audit TA00001` and freeze with `--complete` only
when the exact contract is ready. Promotion through `specdev assignment
--from-test-audit=TA00001` is the first step that may later grant write
authority after normal user approval.

Announce meaningful phases, plan changes, failed verification, and blockers
with "Specdev: <action>"; repeated read-only probes need no separate announcement.
