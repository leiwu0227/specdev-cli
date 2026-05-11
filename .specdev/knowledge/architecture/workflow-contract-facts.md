# Workflow Contract Facts

Assignment `00017_refactor_workflow-architecture` introduced `src/utils/workflow-contract.js` as the owner for structured workflow facts.

Use the contract for phase lists, assignment types, required brainstorm sections, core artifact paths, and gate/status field names. Command modules should keep behavior in Node, but read validation lists and paths from the contract instead of duplicating literals.

Generated command-skill prose in `src/commands/init.js` should also derive structured lists from the contract. Drift tests should cover high-value docs and templates without trying to parse every prose sentence.

When adding a new workflow fact, add it to the contract only after there is a real consumer. Broad guidance, examples, FAQ schemas, and speculative guard definitions should stay in guides or skills until code needs structured data.
