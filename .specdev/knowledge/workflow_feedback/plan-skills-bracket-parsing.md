# Plan Skills Bracket Parsing

Assignment 00008 showed that implementation progress scripts parse `**Skills:** [test-driven-development]` as the literal skill name `[test-driven-development]`, producing a warning even though the intended skill exists.

Mitigation: write plan skill lines without brackets, e.g. `**Skills:** test-driven-development`, or update the parser to strip optional square brackets before resolving skills.
