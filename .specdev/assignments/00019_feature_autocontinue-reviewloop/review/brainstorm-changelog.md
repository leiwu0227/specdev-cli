## Round 1

### Addressed Findings
1. [F1.1] Revised the implementation shape to name source-of-truth files in `templates/.specdev/` and `src/` instead of installed/generated runtime files. The design now explicitly calls out the reviewloop and implementing skill templates, generated wrapper source in `src/commands/init.js`, CLI output sources in `src/commands/implement.js` and `src/commands/checkpoint.js`, and tests for generated/templated instructions.

