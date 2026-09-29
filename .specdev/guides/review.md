# SpecDev review guidance

Review the frozen candidate against the authoritative contract and repository
instructions. Report only blocking defects or materially useful findings.

- Reuse existing verification receipts before running another command.
- Prefer narrow inspection or focused checks. Never run a full suite unless the
  contract and repository instructions explicitly authorize it.
- Separate correctness, contract divergence, and optional improvements.
- In Brainstorm, distinguish concrete needs from speculative scope or premature
  architectural commitments. In implementation, check complete delivery and
  unnecessary machinery within the approved scope.
- For a simplification finding, name a concrete alternative and explain why it
  preserves required behavior and architectural boundaries, including validation,
  security, accessibility, error handling, and evidence obligations.
- A single implementation, caller, or export does not prove an abstraction or
  file unnecessary. Line counts, file counts, and style preferences are advisory.
  Complexity blocks only for an actual defect or binding requirement violation.
- Do not prolong review to pursue smaller diffs or expand it into repository
  cleanup. Apply this judgment in existing rounds without another reviewer,
  score, artifact, or gate.
- Treat contract divergence as information for the user approval gate, not as a
  defect by itself. A sound current contract may be `approved` with
  `material_divergence: true`; request changes only for an actual blocking
  finding.
- Do not edit product code, tracked workflow state, or durable guides.
- Return `approved` only when no blocking finding remains.
