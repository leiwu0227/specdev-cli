# Codex Reviewer: Recurring False Positives

The codex reviewer may repeat the same findings across rounds even after they've been addressed or disputed in changelogs. Observed in assignment 00003 where two findings persisted across all 3 rounds despite detailed changelog responses each time.

**Patterns observed:**
1. **Design dispute escalation:** When the implementation intentionally diverges from a literal reading of the design (e.g., two-path assignment creation), codex treats the changelog explanation as insufficient and re-raises the same CRITICAL finding. There's no mechanism for the reviewer to acknowledge "disagreed by design."
2. **Stale global binary:** Codex uses the globally-installed `specdev` binary rather than the local dev version. If the global version is outdated, `npm test` fails inside the reviewer subprocess even though tests pass locally. Run `npm link` before starting reviewloop to ensure the local version is used globally.

**Mitigation:** When codex reaches max rounds on findings you've already disputed, use `specdev approve <phase>` to manually override. Verify tests pass locally first.
