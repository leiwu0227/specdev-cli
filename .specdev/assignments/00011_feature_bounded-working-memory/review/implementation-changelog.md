# Implementation Changelog

## Round 1

- F1.1: Fixed `readCurrentWorkflow` to check `current.error` from `resolveCurrentAssignment()` before reading `current.path`, matching the rest of the codebase's current-assignment handling.
- F1.2: Cleaned up empty-state formatting so empty generated sections render as prose instead of bullet items.
