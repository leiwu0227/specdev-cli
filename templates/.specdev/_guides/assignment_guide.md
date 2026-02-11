## How to complete a proposed assignment.

**Reference Example**: See `.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/` for a complete worked example.

Steps:

- The user MUST provide an assignment name, if absent, ask for it 
- Create an assignment documentation folder in .specdev/assignments/#####_type_name, where ##### is the next increment (five digits), `type` is assignment type (feature, refactor, familiarization, bugfix, etc.), and `name` is a kebab-case descriptor. Look at .specdev/project_notes/assignment_progress.md to decide the assignment number 
- Once the folder is created, copy `.specdev/_templates/gate_checklist.md` into the assignment folder as `validation_checklist.md` to track quality gates
- The assignment creation process should be broken down into 6 steps.
- Review the assignment-type workflow guide in .specdev/_guides/workflow/ (e.g., feature_workflow.md, refactor_workflow.md, familiarization_workflow.md, bugfix_workflow.md) before diving into the plan.

1. Proposal: user should create a proposal.md file in #####_type_name describing the assignment at a high level, if it's not there, ask for it
2. Planning: refer to .specdev/_guides/task/planning_guide.md to write a detailed plan (NO IMPLEMENTATION, discussions only) and save it as #####_type_name/plan.md
3. Code Scaffolding: follow .specdev/_guides/task/scaffolding_guide.md to write scaffolding documents
4. Gate 1 - Scaffolding Review: use .specdev/_guides/task/validation_guide.md; the user must approve scaffolding before proceeding
5. Implementation: follow .specdev/_guides/task/implementing_guide.md — each task is a TDD Red-Green-Refactor cycle (test first, then code). Dispatch isolated subagents per task using the controller/worker model. Apply Gate 2 TDD validation after each task.
6. Gates 3-5 - Final Validation: run two-stage review (Stage 1: spec compliance, Stage 2: code quality) via subagent reviewers, then complete documentation and project scaffolding gates per .specdev/_guides/task/validation_guide.md before marking the assignment as DONE


The structure of the assignment documentation folder will be

.specdev/assignments/[#####_type_name]/
├── proposal.md              # provided by user
├── plan.md                  # detailed plan
├── research.md              # optional research notes
├── implementation.md        # implementation steps, task-by-task todo list
├── validation_checklist.md  # copied from _templates/gate_checklist.md
└── scaffold/                # contains the scaffolding of the files to be generated
    ├── file1.md
    └── ...
