# Design: Optional public-function note guidance

Add one concise Roadmap style suggestion that applies only when the user asks
for a separate public-function design note. No standard filename, scaffold,
automatic inventory, fixed sections, or validation rule is introduced.

The suggestion favors typed, implementation-aligned function signatures,
CapCase class names, `snake_case` instance and returned-value identifiers, and
an explicit description of the return value and return type. Custom types,
side effects, and failures may be clarified when helpful.

Signatures are permitted as design clarification without function bodies. They
remain target design rather than implementation authority; differences from
current code belong in `forecast.md`.
