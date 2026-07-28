# Searching Adhoc history

Adhoc receipts are durable historical evidence, but individual receipts are
intentionally excluded from `knowledge.sqlite` so small one-off changes do not
overwhelm curated repository guidance.

When a question may relate to an earlier bounded change, search receipts first:

```bash
rg -i --glob '*.md' "<terms>" .specdev/adhoc
```

Commit subjects contain the Adhoc scope, and every delivery commit carries a
`SpecDev-Adhoc` trailer:

```bash
git log --all --regexp-ignore-case --grep="<terms>" --oneline
git log --all --fixed-strings --grep="SpecDev-Adhoc:" --oneline
specdev adhoc show <ID> --json
```

Treat a receipt as evidence about that historical change, not automatically as
current guidance. If the finding is reusable, verify it against the current
repository and curate it into the appropriate FAQ, architecture, codestyle,
domain, or workflow knowledge file.
