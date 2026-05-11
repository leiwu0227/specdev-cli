# Workflow Agents

Assignment `00018_feature_workflow-agents` introduced agents as a third SpecDev workflow primitive alongside skills and scripts.

Use agents for contract-bound reasoning subroutines that the workflow calls through external CLIs. Agent source files live under `templates/.specdev/agents/<name>/` and install into projects at `.specdev/agents/<name>/`. Specs are referenced by path, not by registry lookup.

`src/utils/agent-runner.js` owns generic execution mechanics: Markdown Agent Spec loading, YAML frontmatter parsing, `ajv` validation for metadata and final JSON output, prompt transport by stdin or argv, target-project `cwd`, process-group timeout cleanup, capped stdout, stream-json sidecars, markdown artifact validation, and retry prompts after validation failures.

`specdev research` is the first agent command. It resolves the active assignment, reads the installed researcher spec from the target project, safely packs optional context files, invokes the platform runner, and writes validated research artifacts under the assignment `context/` directory. `specdev agents inspect <path>` is the debugging surface for validating agent specs.

Reviewloop remains separate for now. `agent-runner` is designed to plausibly subsume reviewer-runner later, but this assignment intentionally did not migrate reviewloop.
