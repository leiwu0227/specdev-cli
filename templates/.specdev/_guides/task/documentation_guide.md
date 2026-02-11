# Documentation Guide

## Purpose
Guide coding agents on updating project documentation after completing assignments.

---

## When to Update

Update documentation at Gate 5, before marking assignment as DONE:
- **Feature assignments** → Update feature_descriptions.md
- **Refactor assignments** → Update feature_descriptions.md
- **Familiarization assignments** → Update feature_descriptions.md
- **Bugfix assignments** → Usually no update needed (fixes existing features)

---

## Updating feature_descriptions.md

Location: `.specdev/project_notes/feature_descriptions.md`

### For Feature Assignments

Add to "Features" section:

```markdown
### [Feature Name]
**Assignment:** #####_feature_name
**Completed:** YYYY-MM-DD
**Description:** What it does (1-2 sentences)
**Key files:** path/to/main.py, path/to/other.py
**Details:** See `.specdev/assignments/#####_feature_name/scaffold/` for implementation details
```

### For Refactor Assignments

Add to "Architecture & Structure" section:

```markdown
### [Component Name]
**Assignment:** #####_refactor_name
**Completed:** YYYY-MM-DD
**Description:** What changed architecturally (1-2 sentences)
**Impact:** Which parts of system affected
**Details:** See `.specdev/assignments/#####_refactor_name/scaffold/` for new structure
```

### For Familiarization Assignments

Add to "System Documentation" section:

```markdown
### [System Investigated]
**Assignment:** #####_familiarization_name
**Completed:** YYYY-MM-DD
**Summary:** High-level understanding (1-2 sentences)
**Key insights:** Important discoveries
**Details:** See `.specdev/assignments/#####_familiarization_name/presentation.md` and `scaffold/` for full documentation
```

---

## Documentation Philosophy

**Keep it brief:**
- feature_descriptions.md = catalog (1-2 sentences per entry)
- Scaffolding = detailed documentation (implementation, signatures, dependencies, workflows)

**Always point to scaffolding for:**
- Implementation details
- Function signatures
- Dependencies
- Workflows
- Examples

---

## Other Documentation Updates

### User-Facing Documentation
- Update README/docs only when user requests
- Update after feature adds public API or changes user workflow
- Keep changes minimal and focused

### Inline Documentation
- Add docstrings to all public functions
- Comment complex algorithms
- Explain non-obvious behavior

### Project Scaffolding
- Update `.specdev/project_scaffolding/` with new/modified files
- Add metadata about assignment and purpose
- See `project_scaffolding/_README.md` for format

---

## Knowledge Capture

After finalizing documentation, distill learnings into `knowledge/` branches:

- `codestyle/` - naming conventions, error patterns, test structure discovered
- `architecture/` - design decisions, module boundaries, dependency insights
- `domain/` - business concepts and terminology clarified
- `workflow/` - what worked/didn't in this assignment for this project

If the assignment revealed improvements to the SpecDev workflow itself, note them in `knowledge/_workflow_feedback/`.

Keep entries concise and actionable. This is reference material for future assignments, not a journal.

---

## Checklist

Before completing assignment:
- [ ] feature_descriptions.md updated (if applicable)
- [ ] Scaffolding documents complete and accurate
- [ ] User-facing docs updated (if requested)
- [ ] Inline comments added to complex code
- [ ] Project scaffolding updated
- [ ] Learnings captured in `knowledge/` branches
