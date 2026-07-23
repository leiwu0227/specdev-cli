# SpecDev review guidance

Review the frozen candidate against the authoritative contract and repository
instructions. Report only blocking defects or materially useful findings.

- Reuse existing verification receipts before running another command.
- Prefer narrow inspection or focused checks. Never run a full suite unless the
  contract and repository instructions explicitly authorize it.
- Separate correctness, contract divergence, and optional improvements.
- Treat contract divergence as information for the user approval gate, not as a
  defect by itself. A sound current contract may be `approved` with
  `material_divergence: true`; request changes only for an actual blocking
  finding.
- Do not edit product code, tracked workflow state, or durable guides.
- Return `approved` only when no blocking finding remains.
