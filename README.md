# SpecDev CLI

A markdown-based workflow system for structured software development with coding agents.

## Quick Start

```bash
# Install globally
npm install -g github:leiwu0227/specdev-cli

# Initialize in your project
specdev init

# Update system files (preserves your project files)
specdev update
```

## Commands

| Command | Description |
|---------|-------------|
| `specdev init` | Initialize `.specdev` folder with complete workflow system |
| `specdev update` | Update system files (preserves project files) |
| `specdev help` | Show help and usage information |

**Options:**
- `--force`, `-f` - Overwrite existing files (init only)
- `--dry-run` - Preview changes without modifying files
- `--target=<path>` - Specify target directory

## What Gets Created

```
.specdev/
├── _main.md                    # System: SpecDev overview
├── _router.md                  # System: Central routing guide
├── _guides/                    # System: Task & workflow guides
├── _templates/                 # System: Scaffolding templates & examples
├── project_notes/              # Project: Your documentation
├── project_scaffolding/        # Project: Source code mirror
│   └── _README.md             # System: Scaffolding guide
└── assignments/                # Project: Your active work
```

**System files** (updated by `specdev update`):
- Files prefixed with `_`
- All guides in `_guides/` and `_templates/`

**Project files** (preserved during updates):
- `project_notes/` - Your project documentation
- `assignments/` - Your work in progress

## How It Works

All work happens through **assignments** in `.specdev/assignments/#####_type_name/`:

| Type | Flow |
|------|------|
| **Feature** | Proposal → Plan → Scaffold → Implement → Validate |
| **Refactor** | Proposal → Plan → Scaffold → Implement → Validate |
| **Bugfix** | Proposal → Plan → Scaffold → Implement → Validate |
| **Familiarization** | Proposal → Research → Present |

**Quality Gates** ensure quality at each step:
1. **Gate 1** - Scaffolding approval
2. **Gate 2** - Per-task validation
3. **Gate 3** - Testing
4. **Gate 4** - Integration
5. **Finalize** - Documentation

See `.specdev/_templates/assignment_examples/` for complete examples.

## Getting Started

1. Read `.specdev/_router.md` to understand the workflow
2. Read `.specdev/_main.md` for SpecDev overview
3. Update `.specdev/project_notes/big_picture.md` with your project info
4. Review `.specdev/_templates/assignment_examples/` for examples
5. Start your first assignment in `.specdev/assignments/00001_type_name/`

## Development

```bash
# Clone and setup
git clone https://github.com/leiwu0227/specdev-cli.git
cd specdev-cli
npm install

# Test locally
npm link
npm test

# Release
npm run release        # Patch (0.0.2 → 0.0.3)
npm run release:minor  # Minor (0.0.2 → 0.1.0)
```

## License

MIT
