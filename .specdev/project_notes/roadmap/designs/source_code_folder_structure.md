# Source Code Folder Structure

The repository separates executable entry, command orchestration, reusable
mechanisms, installed-runtime sources, packaged integrations, verification, and
project documentation. The layout expresses ownership and dependency direction,
not a permanent inventory of every file.

```text
bin/
  specdev.js                 thin executable entry
src/
  commands/                  public CLI operations and orchestration
  utils/                     reusable domain and infrastructure mechanisms
templates/.specdev/
  workflows/                 versioned RippleGraph packages
  skills/core/               managed agent guidance
  _guides/ and _templates/   installed documentation and seeds
  project_notes/roadmap/     empty standard Roadmap scaffold only
hooks/                       packaged platform integration
tests/                       command-level regression coverage
docs/                        product design and user-facing support material
```

`bin/specdev.js` parses process entry and delegates to the CLI utilities. It owns no
workflow semantics.

`src/commands/` owns public operations. A command validates user-facing input,
establishes authority, coordinates mechanisms, and shapes text or JSON output.
Large commands may orchestrate a complete transaction, but reusable state, Git,
provider, and validation behavior belongs in focused modules.

`src/utils/` owns those reusable mechanisms. Modules are grouped by domain name:
Assignment, Mission, engine, knowledge, delivery, provider execution, maintenance,
and workspace ownership. Commands may import utilities; utilities do not depend on
the executable entry and should not use command output as an internal API.

`templates/.specdev/` is the canonical packaged source for managed files installed
by `specdev init` and refreshed by `specdev update`. Declarative workflow packages,
managed guides, built-in skills, configuration seeds, and scaffold notes live here.
Templates describe installed behavior but do not duplicate the Node.js command
engine. Project-authored Roadmap designs and other durable records live in the
consumer repository and are preserved by update.

`hooks/` contains bounded coding-agent integration that queries supported CLI
surfaces. Generated platform skills are produced from the canonical command-skill
text in product source; installed `.claude/`, `.codex/`, and `.specdev/` copies are
runtime results rather than independent product sources.

`tests/` verifies user-blocking command behavior using isolated repositories.
`docs/`, package metadata, and release automation support development without
becoming runtime authority. The npm package boundary is explicitly limited to
`bin/`, `src/`, `templates/`, and `hooks/`.

Files may be split or regrouped inside these boundaries. Introducing a new authority
layer, reversing executable-to-command-to-utility dependency direction, or moving
behavior into installed state is an architectural change.
