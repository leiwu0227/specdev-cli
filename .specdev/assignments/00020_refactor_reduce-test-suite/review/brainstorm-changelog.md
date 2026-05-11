## Round 1

- Addressed [F1.1] by making workflow-agent coverage an explicit retained smoke path in the design.
- The retained suite now includes a lightweight merged workflow-agent test covering agent spec validation, a successful runner invocation, malformed-output or retry behavior, `specdev research` artifact creation, and `specdev agents inspect --json`.
- Clarified that narrow runner internals and subsumption string scans can be deleted once the shipped workflow-agent commands are covered by the smoke path.
