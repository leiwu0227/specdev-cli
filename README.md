# SpecDev CLI

Adding spec based guidance for coding agent to your project. A watered down version of Speckit. 

![Workflow Sequence](docs/coding_workflow.png)

## Quick Start

```bash
# Install globally
npm install -g github:leiwu0227/specdev-cli

# Initialize in your project
specdev init

# After setting up, in coding agent cli, ask it to read ./specdev/_main.md to get started. 

```

## Getting Started

1. Ask your coding agent to read `.specdev/_main.md` to get started
2. Update `.specdev/project_notes/big_picture.md` with your project info
3. Start chatting with the coding agent

**Examples:**
- "I want to develop a new feature called ..."
- "I want to get familiar with the code base in this folder ..."
- "I want to refactor this file ..."
- "I want to fix this bug ..."

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
