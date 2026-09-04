# Skill Management

Parent design: `./managed_installation.md`

SpecDev skills are Markdown instruction packages with optional support files. Core
skills are managed runtime; tool skills may be installed, synchronized, removed, or
customized under explicit ownership rules.

Skill discovery parses bounded YAML frontmatter and scans known roots without
executing skill content. Human listing and JSON inventory expose name, type, phase,
triggers, category, and paths. Viewing a skill or support file resolves paths beneath
the selected package and rejects traversal.

Tool-skill packages already live under `.specdev/skills/tools/`. Installation selects
one or more available packages, generates provider wrappers, and records them in the
active-tool registry; it does not copy the underlying package. Removal deletes the
selected wrappers and registry entry while preserving the tool-skill source.
Synchronization removes stale registry entries, regenerates missing wrappers, and
reports available inactive tools. Managed runtime update, not skill synchronization,
refreshes official package content while preserving custom tools.

Provider wrappers are generated projections that route native skill invocation to
the canonical installed content. They do not fork instructions or acquire workflow
authority. Core command skills are generated during init/update from product-owned
canonical text and are not managed through the custom tool-skill lifecycle.

Skills guide agents but cannot advance RippleGraph state, approve contracts, mutate
outside their selected lane, or override repository instructions. Scripts included
with a skill are deterministic helpers subject to the same authority and verification
rules as direct commands.

## Source Targets

- `src/commands/skills.js` — maximum 220 lines — inventory, viewing, and subcommand routing.
- `src/commands/skills-install.js` — maximum 190 lines — bounded tool-skill installation.
- `src/commands/skills-remove.js` — maximum 110 lines — exact skill and wrapper removal.
- `src/commands/skills-sync.js` — maximum 140 lines — official/custom synchronization.
- `src/utils/active-tools.js` — maximum 60 lines — installed tool registry and agent targets.
- `src/utils/skills.js` — maximum 170 lines — frontmatter parsing and skill discovery.
- `src/utils/wrappers.js` — maximum 110 lines — provider wrapper generation and cleanup.
