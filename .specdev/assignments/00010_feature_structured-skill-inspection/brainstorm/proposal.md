# Proposal: Structured Skill Inspection

Add structured skill inspection commands so agents can discover and load SpecDev skills progressively instead of reading whole directories by convention. This follows the Hermes lesson that a small skill index should be available first, with full skill files and referenced support files loaded only when needed.

The feature should extend the existing `specdev skills` surface with machine-readable listing output and a read-only view command for specific skills. It should preserve current human-readable behavior and stay scoped to local `.specdev/skills/` content.
