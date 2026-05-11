# Reviewloop Autocontinue

`specdev reviewloop <phase> --reviewer=<name> --autocontinue` keeps reviewloop as the owner of review execution and phase approval, but adds an explicit post-approval continuation contract for agents.

For assignment brainstorm approval, reviewloop prints that the agent should continue to breakdown and implementation, and reuse the selected reviewer for implementation review:

```bash
specdev reviewloop implementation --reviewer=<name> --autocontinue
```

For implementation approval, reviewloop prints that the agent should continue to capture. The command also emits a JSON-shaped contract block so agents can parse the next phase and reviewer handoff without relying only on prose.

Discussions are intentionally excluded from autocontinue. Discussion checkpoints and discussion reviewloop output should not promise continuation or assignment approval.

Source-of-truth files:

- `src/commands/reviewloop.js`
- `src/commands/checkpoint.js`
- `src/commands/implement.js`
- `src/commands/init.js`
- `templates/.specdev/skills/core/reviewloop/SKILL.md`
- `templates/.specdev/skills/core/implementing/SKILL.md`

Source: 00019_feature_autocontinue-reviewloop.
