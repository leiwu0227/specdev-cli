# SpecDev CLI

Initialize the SpecDev workflow system in any project. SpecDev provides structured markdown-based guides for planning, scaffolding, implementing, and validating features.

This is a watered down version of speckit, stripping all the unnecessary complexities.

## Quick Start

```bash
# Install from GitHub
npm install -g github:leiwu0227/specdev-cli
specdev init
```

## Installation Options

### Option 1: Install from GitHub (Recommended)
```bash
npm install -g github:leiwu0227/specdev-cli
specdev init
```

### Option 2: Clone and Link Locally
```bash
git clone https://github.com/leiwu0227/specdev-cli.git
cd specdev-cli
npm install
npm link
specdev init
```

### Option 3: Use npx directly (No installation)
```bash
npx github:leiwu0227/specdev-cli init
```

### Option 4: From npm (when published)
```bash
# One-time use
npx @specdev/cli init

# Global install
npm install -g @specdev/cli
specdev init
```

## Commands

### `specdev init`
Initialize `.specdev` folder in the current directory.

**Options:**
- `--force`, `-f` - Overwrite existing `.specdev` folder
- `--dry-run` - Show what would be copied without actually copying
- `--target=<path>` - Specify target directory (default: current directory)

**Examples:**
```bash
# Initialize in current directory
specdev init

# Overwrite existing
specdev init --force

# Initialize in specific directory
specdev init --target=./my-project

# Preview what would be created
specdev init --dry-run
```

### `specdev help`
Show help message with all available commands.

### `specdev --version`, `specdev -v`
Show the installed version.

## What Gets Created

```
.specdev/
├── router.md                          # Central routing guide
├── generic_guides/                    # Workflow guides
│   ├── codestyle_guide.md            # Coding philosophy
│   ├── featuring_guide.md            # Feature development workflow
│   ├── planning_guide.md             # Planning phase guide
│   ├── scaffolding_guide.md          # Scaffolding guide
│   ├── implementing_guide.md         # Implementation guide
│   └── validation_guide.md           # Quality gates
├── project_notes/                     # Project documentation
│   ├── big_picture.md                # Project description
│   └── feature_progress.md           # Feature tracking
├── templates/                         # Templates
│   └── scaffolding_template.md       # Scaffolding format
└── features/                          # Feature folders
    └── 000_example_feature/          # Reference example
        ├── proposal.md
        ├── research.md
        ├── plan.md
        ├── implementation.md
        ├── validation_checklist.md
        └── scaffold/
            ├── utils_validator.md
            └── test_validator.md
```

## Workflow Overview

SpecDev provides a 6-step feature development workflow:

1. **Proposal** - Define feature goals and scope
2. **Planning** - Create detailed implementation plan
3. **Scaffolding** - Write pseudocode blueprints
4. **Gate 1** - User approves scaffolding
5. **Implementation** - Build features with task-by-task validation
6. **Gates 3-5** - Testing, integration, and documentation validation

See `.specdev/features/000_example_feature/` for a complete worked example.

## Getting Started

After running `specdev init`:

1. **Read the router**: Start with `.specdev/router.md` to understand the workflow
2. **Update project info**: Edit `.specdev/project_notes/big_picture.md`
3. **Review the example**: Check `.specdev/features/000_example_feature/`
4. **Start your first feature**: Create a `proposal.md` in a new feature folder

## Development

### Setup
```bash
git clone <repo-url>
cd specdev-cli
npm install
```

### Testing
```bash
# Run all tests
npm test

# Test init command
npm run test:init

# Verify output
npm run test:verify

# Lint code
npm run lint

# Format code
npm run format
```

### Local Testing
```bash
# Link package locally
npm link

# Test in another directory
cd /path/to/test/project
specdev init
```

### Release
```bash
# Patch version (1.0.0 -> 1.0.1)
npm run release

# Minor version (1.0.0 -> 1.1.0)
npm run release:minor

# Major version (1.0.0 -> 2.0.0)
npm run release:major
```

## Updating Templates

1. Edit files in `templates/.specdev/`
2. Run `npm test` to verify
3. Bump version: `npm run release`
4. Publish: `npm publish --access public`

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## License

MIT

## Support

- Issues: [GitHub Issues](https://github.com/yourname/specdev-cli/issues)
- Documentation: See `.specdev/` folder after initialization

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.
