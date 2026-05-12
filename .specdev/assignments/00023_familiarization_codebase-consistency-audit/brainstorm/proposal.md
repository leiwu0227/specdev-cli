# Proposal: Holistic Codebase Consistency Audit

Run a holistic, findings-only audit of the specdev-cli repo to identify legacy
artifacts, contradictions, inconsistencies, duplication, and drift across root
docs, source code, templates and workflow content, tests, and `.specdev/`
project state. Recent assignments reshaped large parts of the surface area
(00020 reduced the test suite, 00022 thinned runtime guidance), and older
content has not been swept end-to-end.

The audit produces a single `findings.md` (plus five per-area inventory files
under `context/`) organized by area with type and severity tags and a
recommended action per finding. No code or content changes are made; cleanup
is queued for follow-up assignments at the user's discretion. The threshold
is aggressive: flag anything not actively referenced, even if currently
harmless.
