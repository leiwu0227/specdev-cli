## Round 1

- [F1.1] Added "Discussion CLI contract & error cases" table to design.md with explicit error messages for: missing `--discussion` flag, unknown ID, malformed ID, and missing brainstorm artifacts.
- [F1.2] Added "`.current` file semantics & error cases" table to design.md covering: missing file, stale pointer (auto-clears), corrupt content (auto-deletes), unknown ID on focus, and file format spec (plain text, single line).
- [F1.3] Disagree with splitting into two assignments — discussions and `.current` are tightly coupled (discussions exist because we're removing heuristic detection). Added "Implementation order" section with 4 staged steps within the single assignment to reduce regression risk.
- [F1.4] Added explicit key decision: hard break, no deprecation. This is an internal tool with no external consumers. Clean removal is preferred.

## Round 2

- [F2.1] Added write strategy row to `.current` semantics table: simple `fs.writeFileSync`, last writer wins. This is a single-user CLI tool — concurrent writes are not a realistic scenario.
