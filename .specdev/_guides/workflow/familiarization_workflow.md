# Familiarization Assignment Workflow

## Purpose
Guide coding agents through structured research and learning of unfamiliar code areas.

---

## Step 1: Proposal

**Deliverable:** `proposal.md`
**Owner:** User
**Guide:** User creates this file

**Key content:** What code area/system needs understanding; why (new team member, prepare for refactor); learning objectives; scope/constraints (time-box, depth level); expected deliverable format (diagrams, documentation, demo, spike code).

**Next:** Agent may suggest improvements (requires user approval); proceed to research.

---

## Step 2: Research

**Deliverable:** `research.md` with comprehensive findings
**Owner:** Agent researches and documents
**Guide:** `.specdev/_guides/task/research_guide.md`

**Process:** Read proposal.md; conduct structured investigation (read code, follow function calls, run with debugger, test different inputs, write spike code); document findings in research.md (entry points, architecture, data flows, key concepts, code examples, hypotheses tested, open questions).

**Next:** Present findings to user for review.

---

## Step 3: Presentation

**Deliverable:** `presentation.md` and `scaffold/` directory
**Owner:** Agent creates, user approves
**Guide:** `.specdev/_guides/task/presentation_guide.md`

**Process:** Create presentation.md (short description, architecture diagram, logic flow, key findings, next steps); create scaffolding files (follow scaffolding_guide.md; one scaffold per key file investigated; documents structure learned); present to user (start with presentation.md overview; user reviews scaffolds for details).

**User approval required:** Agent presents final package for approval.

**Next:** User approves presentation → move to finalize.

---

## Step 4: Finalize

**Deliverable:** Updated documentation
**Owner:** Agent finalizes
**Guide:** `.specdev/_guides/task/documentation_guide.md`

**Process:** Update feature_descriptions.md (add to "System Documentation" section; describe what was learned in 1-2 sentences; point to presentation.md and scaffolds for details); update project_scaffolding/ with learning pointers, cross-references, entry points for future familiarization; mark assignment DONE in assignment_progress.md.

**Final:** Assignment complete.

---

## Key Checkpoints

- ✅ Proposal defines clear learning objectives
- ✅ Research findings documented in research.md
- ✅ Presentation created (presentation.md and scaffolds)
- ✅ User approves presentation
- ✅ Documentation updated (feature_descriptions.md, project_scaffolding)

---

## Familiarization-Specific Tips

- **Time-box deep dives** - Prefer breadth-first discovery with targeted drills
- **Document as you go** - Capture findings immediately in research.md
- **Maintain hypothesis log** - Track what you tested and what you learned
- **Separate facts from assumptions** - Mark assumptions clearly for validation
- **Share early** - Present interim findings to avoid misaligned expectations
- **Tag artifacts** - Label screenshots, logs, recordings with assignment ID
- **Record blockers** - Note unknowns and open questions for follow-up work
- **Create reproducible path** - Document your learning journey for future agents
- **Use spike code** - Small experiments that demonstrate understanding
- **Visual aids help** - Diagrams often explain better than words
