# Outcome

## Delivered behavior

Reviewer networking remains default-off and provider-adapter controlled. Codex
reviewers may opt into live search through exec-scoped `--config
web_search="live"` while the invocation retains `--sandbox read-only`; Claude and
Cursor network-enabled reviewer requests fail during preflight before a
provider process or misleading running Attempt is created. Worker networking
remains unchanged.

Resolved profiles and spawned Attempts now carry normalized `filesystem` and
`network` fields derived from the adapter. Older reviewer, format-correction,
and worker Attempts without `filesystem` remain readable through conservative
role-derived inference. Mission approval freezes provider, model, effort,
timeout, filesystem, and network policy, and convergence review consumes that
frozen reviewer profile while executor-environment drift detection remains live.

The managed agent template and README document opt-in behavior and clarify that
`network: false` grants no adapter network capability without claiming control
over undocumented provider internals.

## Deviations

None.

## Unresolved risks

The full `npm test` command still stops at two pre-existing hard-coded lifecycle
expectations: `test-mission-compatibility` constructs an Assignment package and
catalog at 2.3.0 while copying the current 2.4.0 graph, and
`test-engine-integration` expects an installed 2.3.0 path although the packaged
graph is 2.4.0. Every other suite entry was run and passed. Provider CLI options
may evolve; the adapter boundary and invocation regressions remain the local
fail-closed evidence.

| Acceptance | Evidence                                                                                                                                                                                                       | Result |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC-1       | Focused profile/preflight tests prove default-off behavior, Codex reviewer acceptance, unsupported-provider rejection before Attempt creation, and unchanged Codex worker networking.                          | Passed |
| AC-2       | Provider invocation tests prove the exec-scoped `web_search="live"` override follows `codex exec`, retains `--sandbox read-only`, emits no workspace-write network override, and rejects unsupported policies. | Passed |
| AC-3       | Focused Attempt and Mission tests prove normalized persistence, conservative legacy reads, complete approval-frozen profiles, and networked frozen reviewer resolution.                                        | Passed |
