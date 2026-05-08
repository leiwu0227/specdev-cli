# Review Finds Masked Error Handling

Assignment 00011 showed that behavior tests can pass while error handling is still structurally wrong. `readCurrentWorkflow` returned the right output only because a broad catch hid misuse of `resolveCurrentAssignment()`.

Mitigation: when a helper returns structured `{ error }` results, tests should cover behavior and code review should verify callers follow the established error contract explicitly.
