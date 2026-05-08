# Full Suite Reviewloop Command Hang

During assignment 00012, `.specdev/skills/core/test-driven-development/scripts/verify-tests.sh . "npm test"` did not complete. Process inspection showed the run reached `test-reviewloop-command.js`; after reviewer child processes exited, the Node test process remained alive.

Mitigation: when full `npm test` hangs, inspect the process tree before terminating and run the assignment-relevant focused suites separately. Record the full-suite blocker in `review/validation_checklist.md` instead of claiming full-suite success.

Future cleanup: investigate open handles in `tests/test-reviewloop-command.js`, especially around spawned reviewer subprocesses and timeout cases.
