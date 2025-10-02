## How to complete a proposed feature.

**Reference Example**: See `.specdev/features/000_example_feature/` for a complete worked example.

Steps:

- The user MUST provide a feature name, if absent, ask for it 
- Create a feature documentation folder  in .specdev/features/###_featurename, where ### is the feature increment. Look at .specdev/project_notes/feature_progress.md to decide the feature number 
- Once the folder is created, the feature creation process should be broken down into 6 steps.

1. Proposal: user should create a proposal.md file in ###_featurename, this should provide a high level description of what the feature is
2. Planning: refer to .specdev/generic_guides/planning_guide.md as guide to write a detailed plan (NO IMPLEMENTATION, discussions only) and save it as ###_featurename/plan.md
3. Code Scaffolding: refer to .specdev/generic_guides/scaffolding_guide.md as guide to write scaffolding_documents
4. Gate 1 - Scaffolding Review: refer to .specdev/generic_guides/validation_guide.md, user must approve scaffolding before proceeding
5. Implementation: refer to .specdev/generic_guides/implementing_guide.md as guide to implement the actual code, applying Gate 2 validation after each task
6. Gate 3-5 - Final Validation: refer to .specdev/generic_guides/validation_guide.md to complete testing, integration, and documentation gates before marking feature as DONE 


The structure of the feature doc folder will be 

.specdev/features/[###_feature]/
├── proposal.md              # provided by user
├── plan.md                  # detailed plan
├── research.md              # optional research notes
├── implementation.md        # implementation steps, task by task todo list
├── validation_checklist.md  # quality gates tracking (created during feature setup)
└── scaffold/                # contains the scaffolding of the files to be generated
    ├── file1.md
    └── ...