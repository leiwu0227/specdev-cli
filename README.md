# SpecDev CLI

A markdown-based workflow system for structured software development with coding agents.

![Workflow Sequence](docs/coding_workflow.png)

## Quick Start

```bash
# Install globally
npm install -g github:leiwu0227/specdev-cli

# Initialize in your project
specdev init

# After setting up, in coding agent cli, ask it to read ./specdev/_main.md to get started. 

```


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

## How It Works

All work happens through **assignments** in `.specdev/assignments/#####_type_name/`:

| Type | Flow |
|------|------|
| **Feature** | Proposal → Plan → Scaffold → Implement → Validate |
| **Refactor** | Proposal → Plan → Scaffold → Implement → Validate |
| **Bugfix** | Proposal → Plan → Scaffold → Implement → Validate |
| **Familiarization** | Proposal → Research → Present |


## License

MIT
