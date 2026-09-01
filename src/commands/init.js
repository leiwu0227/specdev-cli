import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import fse from 'fs-extra'
import { blankLine, printLines, printSection } from '../utils/output.js'
import { skillsInstallCommand } from './skills-install.js'
import { scanSkillsDir } from '../utils/skills.js'
import { installGraphPackages, installWorkspaceEngine } from '../utils/engine.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Platform adapter configurations
export function adapterContent(heading) {
  return `# ${heading}

Read \`.specdev/_main.md\` for the full SpecDev workflow and rules.

Classify each request before creating workflow state. Questions, read-only
inspection, and small requested documentation artifacts that do not change
product, runtime, public-contract, or workflow behavior are Direct. Direct
writes create no graph, receipt, or automatic commit. Use Roadmap, Adhoc,
Discussion, Assignment, or Mission only when the user explicitly selects that
lane; never silently make every request an Assignment.

For a Direct documentation write, announce once, read destination instructions
and only the facts needed for the artifact, write it, and verify it narrowly.
Do not require broad project orientation for a low-risk note. For example,
writing an HTTP usage manual under project notes is Direct; "Use SpecDev Adhoc
to update the public API manual and commit it" is explicitly selected Adhoc.

An explicit request to write a bounded coordination or handoff note into another
repository does not select Adhoc or create SpecDev state in the active
repository. Write only that auxiliary note and honor the destination's
instructions. If the request changes the destination repository's product,
runtime, or workflow state, or explicitly requests SpecDev governance there,
re-anchor in that repository and classify the work there before editing.

IMPORTANT: Announce "Specdev: <what you're doing>" at meaningful phase
boundaries and whenever the plan changes, verification fails, or work blocks.
Repeated read-only probes within one announced phase need no extra announcement.
`
}

export const ADAPTERS = {
  claude: { path: 'CLAUDE.md', heading: 'CLAUDE.md' },
  codex: { path: 'AGENTS.md', heading: 'AGENTS.md' },
  cursor: { path: join('.cursor', 'rules'), heading: 'Cursor Rules' },
}

export const SKILL_FILES = {
  'specdev-adhoc': `---
name: specdev-adhoc
description: Run a user-explicitly-selected Adhoc change without a RippleGraph workflow
---

Use Adhoc only when the user selects a concrete bounded repository change and
does not want that detour to become another Assignment. This does not reject or
terminate an unrelated active Assignment. Start with \`specdev adhoc start
"<scope>"\`.

Read \`.specdev/project_notes/big_picture.md\` unconditionally. When repository
behavior, conventions, or a recurring failure is unfamiliar, run a bounded
\`specdev knowledge search "<objective or symptom terms>"\` before planning.
Precise all-term and quoted-phrase matching is the default; narrow partial or
noisy results with distinguishing terms or a quoted phrase, and use explicit
\`--mode=broad\` only for any-term discovery. Do not bulk-read knowledge
directories. Treat matches as historical leads, verify relevant behavior in
current code, and check for hard-coded counts, enumerated families, or other
closed-world assumptions. Use \`--include-stale\` only to inspect older guidance
and revalidate it before use. Search again with exact terms when implementation
produces an unexpected symptom. If code verification exposes a reusable missing
constraint, send it through an evidence-bound, user-approved \`knowledge curate\`
proposal; source code is not bulk-indexed or promoted by search alone.

A bounded file write request has not thereby selected Adhoc. In particular, an
explicit coordination or handoff note written into another
repository is an auxiliary artifact: write only that note, honor destination
instructions, and do not create SpecDev state in the active repository. If the
request instead changes the destination repository's product, runtime, or
workflow state, or explicitly requests SpecDev governance there, re-anchor in
that repository and classify the work there before editing.

For example, "write an HTTP usage manual under project notes" is Direct when
the artifact does not change product behavior or public contracts. "Use SpecDev
Adhoc to update the public API manual and commit it" explicitly selects this
governed lane and retains its receipt and final-commit guarantees.

Start classifies every expanded dirty path before creating state. Independent
Discussion and Test Audit paths remain outside Adhoc ownership; requesting
\`--adopt-dirty\` while any such path is present refuses the whole adoption and
reports every rejected owner and recovery action. An accepted adoption persists
the exact path/status manifest at the starting revision. Use \`--title="..."\`
when the commit needs a short subject independent of the full receipt scope.

An active standalone Assignment may coexist only at its quiescent approved
pre-implementation boundary: its focus, lifecycle run, artifacts, and Attempt
records remain preserved outside Adhoc ownership. An implementation Git
boundary, a live or ambiguous worker/reviewer Attempt, dirty product paths, or
uncertain ownership blocks Adhoc before state is created. \`--adopt-dirty\`
cannot absorb those conflicts. Finish and cancel retain the same Assignment
identity for continuation; shelving is explicit terminal user authority, never
an automatic pause or prerequisite. Assignment-advancing commands remain
blocked until the detour finishes or is cancelled.

Make the change directly without a scheduler, worktree, subagent, or approval
gate. Verification execution always requires repository/user authorization.
After authorization, structured evidence may be captured with \`specdev adhoc
verify --label="..." -- <command>\`; failed attempts and passing reruns remain
in the receipt. Finish with \`specdev adhoc finish --outcome="..."\` when the
latest evidence for each label passes, or retain the supported manual
\`--verification="..."\` summary. Finish stages the persisted manifest plus
valid Adhoc-owned paths through an exact temporary-index transaction and clears
active state only after the delivery commit and remaining owned delta verify.
Its requested, committed, rejected, and remaining facts come from Git rather
than outcome prose.
\`specdev adhoc cancel\` leaves source changes untouched.

Announce meaningful phases, plan changes, failed verification, and blockers
with "Specdev: <action>"; repeated read-only probes need no separate announcement.
`,
  'specdev-start': `---
name: specdev-start
description: Interactive Q&A to fill in your project's big_picture.md
---

Read \`.specdev/project_notes/big_picture.md\`.
If it is already project-specific, present it and ask whether the user wants an
update. Otherwise ask one focused question at a time about purpose, users,
technology, architecture, and constraints. Draft the complete file, show it to
the user, and write only after confirmation.

Announce meaningful phases, plan changes, failed verification, and blockers
with "Specdev: <action>"; repeated read-only probes need no separate announcement.
`,
  'specdev-rewind': `---
name: specdev-rewind
description: Fully re-read the specdev workflow and re-anchor from scratch
---

You have drifted from the specdev workflow. Stop what you're doing and:

1. Read \`.specdev/_main.md\` completely.
2. Read the typed \`.specdev/.current\` focus, if present.
3. Run \`specdev next --json\` for an Assignment, \`specdev mission status\`
   for a Mission, or \`specdev discussion <id>\` for a Discussion.
4. Treat the durable graph and folder artifacts as authoritative.

Announce meaningful phases, plan changes, failed verification, and blockers
with "Specdev: <action>"; repeated read-only probes need no separate announcement.
`,
  'specdev-layout-migration': `---
name: specdev-layout-migration
description: Guide an agent through a safe, user-approved .specdev layout migration
---

Read \`.specdev/_guides/migration_guide.md\`.

Follow the guide as an interactive migration workflow:

1. Inspect the existing \`.specdev/\` tree without moving files.
2. **Cross-check product and graph contracts before proposing any move.** \`rg '<path>' src tests templates\`. Paths referenced by \`src/commands/\`, \`src/utils/\`, or \`.specdev/workflows/\` are load-bearing — recommend "Leave in place" even if they are not in the guide's Target Structure block.
3. Classify the remaining artifacts against the modern structure.
4. Write \`.specdev/migration/layout-plan.md\` with proposed moves, files to leave in place, and questions for the user.
5. Ask the user to approve the plan before editing.
6. Apply only approved moves, preserving content and avoiding overwrites.
7. Verify with \`specdev status --json\` and summarize what changed.

If the user only needs the old deterministic assignment-file migration, discuss \`specdev migrate legacy-assignments --dry-run\` first.

Announce meaningful phases, plan changes, failed verification, and blockers
with "Specdev: <action>"; repeated read-only probes need no separate announcement.
`,
  'specdev-assignment': `---
name: specdev-assignment
description: Create an Assignment and collaborate on its single contract
---

Run \`specdev assignment "<objective>"\`. Collaborate directly with the user in
\`brainstorm/contract.md\`; do not spawn a Brainstorm author.

After reading \`.specdev/project_notes/big_picture.md\`, run one bounded
\`specdev knowledge search "<objective terms>"\` while shaping the contract.
Read only relevant fresh result paths, keep repository instructions and the
approved contract authoritative, and never bulk-load the knowledge directory.
Carry relevant paths into contract context or the implementation plan. Search
again with symptom terms after an unexpected failure. Precise all-term and
quoted-phrase matching is the default; narrow partial or noisy results first and
use \`--mode=broad\` only for deliberate any-term discovery. Results are
historical investigation leads, not current authority: inspect relevant current
code and look for hard-coded counts, enumerated families, and other closed-world
assumptions. Route reusable constraints missing from living knowledge through a
repository-evidence-bound, user-approved \`knowledge curate\` proposal; never
bulk-index source or publish the search result itself. Stale results require
explicit retrieval and revalidation.

Keep the contract proportional. Reference existing project context instead of
restating it, record only change-specific decisions and constraints, and use the
fewest independent observable acceptance criteria (normally 1-3 for a small
change and rarely more than 5). Tasks, file lists, and generic quality checks
belong in the plan, not the contract.

When the contract has no TODOs and the user is comfortable, run \`specdev
checkpoint brainstorm\`. Brainstorm review is optional by default:
\`specdev reviewloop brainstorm\`.

Review policy may be set at creation or approval with
\`--brainstorm-review=optional|required\` and
\`--implementation-review=required|waived\`; approval freezes it. A waiver never
waives acceptance evidence.

Before requesting agreement, show the exact contract path and hash plus the
command's concise contract-preview bullets covering objective, scope, and key
acceptance criteria. Also show any verdict, textual changes, and divergence
classification. If review changed the contract, run \`specdev checkpoint
brainstorm\` once more to present the final hash. Only after explicit user
agreement run \`specdev approve brainstorm\`, then \`specdev implement\` for the
automatic section.

Announce meaningful phases, plan changes, failed verification, and blockers
with "Specdev: <action>"; repeated read-only probes need no separate announcement.
`,
  'specdev-continue': `---
name: specdev-continue
description: Resume SpecDev work from durable workflow and folder artifacts
---

Run \`specdev next --json\` for a focused workflow. For a Mission, run \`specdev
mission status <id>\` then \`specdev mission run <id>\`. For a Discussion, run
\`specdev discussion <id>\`. Ordinary interrupted source may be inspected,
continued, repaired, or rewritten; do not assume database-style recovery.

Before resuming an Assignment, inspect its lifecycle in \`specdev status --json\`.
A shelved or unsupported Assignment is terminal and immutable: translate “resume” into
\`specdev assignment --from-assignment=<terminal-id>\`, which creates a fresh ID
and contract. Never reactivate the old graph or treat its approval or historical
verification as current. Abandoned work remains terminal and is not a shelf.

Announce meaningful phases, plan changes, failed verification, and blockers
with "Specdev: <action>"; repeated read-only probes need no separate announcement.
`,
  'specdev-discussion': `---
name: specdev-discussion
description: Start or resume concurrent code-read-only exploration
---

Run \`specdev discussion "<topic>"\`. Treat product code as read-only and write
only the returned Discussion's \`brainstorm/proposal.md\` and
\`brainstorm/design.md\`. Resume with \`specdev discussion D00001\`.

Optional review: \`specdev reviewloop discussion --discussion=D00001\`.
Complete only when the user is satisfied: \`specdev discussion D00001
--complete\`. Promotion creates fresh identity and a fresh contract.

Announce meaningful phases, plan changes, failed verification, and blockers
with "Specdev: <action>"; repeated read-only probes need no separate announcement.
`,
  'specdev-roadmap': `---
name: specdev-roadmap
description: Collaborate on user-approved roadmap notes without workflow state
---

Use Roadmap only when the user explicitly selects it. Run \`specdev roadmap
--json\` to display the writable boundary, standard files, and stateless rules.
Read the current roadmap as needed, but treat product code and every path
outside these locations as read-only:

- Direct Markdown files under \`.specdev/project_notes/roadmap/designs/\`
- \`.specdev/project_notes/roadmap/forecast.md\`

Every Markdown file under \`roadmap/designs/\` must contain fewer than 800
words (maximum 799). \`core_concepts.md\` and
\`source_code_folder_structure.md\` are the standard cross-cutting notes. Every
other design note must cover one independent feature or module and minimize
overlap with the standard notes and its peers.

\`forecast.md\` is a future-work roadmap. When creating or revising it, quickly
inspect current code read-only against the Roadmap designs, identify design-note
sections not yet reflected in code, and list those gaps in dependency order.
Write each gap as its own Markdown section containing fewer than 200 words
(maximum 199).

Treat approved designs as the target state: identify code gaps versus the
designs, never design gaps versus current code. Current code may be a superset
of the designs; extra code-only features do not create forecast items or
automatic design-note updates. The user separately initiates Roadmap
collaboration to incorporate such features into the design notes.

Collaborate with the user on one exact candidate edit at a time. Show the exact
destination and complete proposed content or diff, then wait for explicit user
approval before writing. Invocation alone never authorizes a write. Roadmap
creates no ID, RippleGraph state, receipt, snapshot, or automatic commit, and it
does not grant authority to implement forecast items.

Roadmap has no active lifecycle. It applies only while the user is explicitly
collaborating on roadmap notes. Selecting another lane immediately supersedes
Roadmap collaboration; no exit command or state transition is required.

Announce meaningful phases, plan changes, failed verification, and blockers
with "Specdev: <action>"; repeated read-only probes need no separate announcement.
`,
  'specdev-mission': `---
name: specdev-mission
description: Create and run a foreground Mission with automatic bounded waves
---

Run \`specdev mission create "<objective>"\` and collaborate on the Mission
contract, including its exact final integrated verification command. Run
\`specdev mission run M00001\` to validate it, and run it again if review changed
the contract. Before requesting agreement, show the exact contract path and hash
plus the command's concise contract-preview bullets. Only after explicit
agreement run \`specdev mission run M00001 --approve\`.

Read \`.specdev/project_notes/big_picture.md\` unconditionally and search fresh
living knowledge once with Mission objective terms during planning. Record only
relevant result paths for the queue and child context. Children search again
only for child-specific unknowns or unexpected symptoms. Never bulk-load
knowledge or silently use stale/superseded entries. Default precise search uses
all terms and quoted phrases; narrow partial/noisy results and reserve
\`--mode=broad\` for deliberate any-term discovery. Treat matches as historical
leads and verify them in current code, including hard-coded counts, enumerated
families, and other closed-world assumptions. Route reusable constraints absent
from living knowledge through repository-evidence-bound, user-approved
\`knowledge curate\`; never bulk-index source or treat a match as current truth.

Keep the Mission contract proportional just like an Assignment contract. Do not
restate big-picture notes or turn implementation tasks into acceptance criteria.
Multi-child Assignment contracts are narrow deltas that inherit unchanged
Mission authority.

The controller stays in the foreground and starts with one full-scope child.
Set \`Initial child plan: planned\` in the contract only for a concrete
execution, dependency, decision, or verification boundary. Planned children
receive static waves; independent children in one wave automatically use up to
three validated ignored worktrees and integrate in declared order. Use
\`--takeover\` only after inspecting an interrupted controller.

Announce meaningful phases, plan changes, failed verification, and blockers
with "Specdev: <action>"; repeated read-only probes need no separate announcement.
`,
  'specdev-knowledge-curation': `---
name: specdev-knowledge-curation
description: Propose, approve, publish, and reindex bounded living-knowledge updates
---

Run \`specdev knowledge curate --json\` for a mutation-free bounded scan. Inspect
only relevant eligible sources and owner candidates. Draft the exact JSON
manifest from \`proposal_template\` under ignored
\`.specdev/cache/knowledge-curation/\`; include durable citations, current
verification, owner search results, conflicts, and exclusions. Update or
supersede the owning note instead of creating parallel truth.

When direct code inspection establishes a reusable constraint absent from the
durable source, rerun the scan with bounded
\`--repo-evidence=project/path#Lstart-Lend\`. Keep the returned content-addressed
\`repository_evidence\` unchanged and reference it from each supported change.
Repository evidence verifies current code bytes and location; it never replaces
an eligible durable source, owner checks, current verification, or exact user
approval, and source code is never bulk-indexed.

Run \`specdev knowledge curate --proposal=<path> --json\` to validate and bind
the unchanged proposal. Show its exact paths and proposal ID. Only after user
approval run the displayed \`--approve=<proposal-id>\` command. A big-picture
proposal has a separate \`--approve-big-picture=<id>\` token and must never be
inferred from ordinary knowledge approval.

Resume with \`specdev knowledge curate --status\` or the unchanged approval
command. Publication and its receipt are idempotent. If the index is stale, use
the exact \`specdev knowledge rebuild\` recovery command and do not roll back
authoritative Markdown.

Announce meaningful phases, plan changes, failed verification, and blockers
with "Specdev: <action>"; repeated read-only probes need no separate announcement.
`,
  'specdev-test-audit': `---
name: specdev-test-audit
description: Audit redundant tests read-only and prepare an exact Assignment
---

Run \`specdev test-audit "<scope>"\`. Treat all product code and tests as
read-only. Fill only the returned Test Audit's \`audit.md\` and
\`assignment-contract.md\`; every candidate needs rationale, retained
protection, cost impact, and confidence.

Resume with \`specdev test-audit TA00001\` and freeze with \`--complete\` only
when the exact contract is ready. Promotion through \`specdev assignment
--from-test-audit=TA00001\` is the first step that may later grant write
authority after normal user approval.

Announce meaningful phases, plan changes, failed verification, and blockers
with "Specdev: <action>"; repeated read-only probes need no separate announcement.
`,
  'specdev-reviewloop': `---
name: specdev-reviewloop
description: Run interactive review or bounded automatic convergence
---

Reviewer provider, model, effort, and timeout come from
\`.specdev/agents.yaml\` plus optional ignored local overrides. Do not ask the
user to choose a reviewer per execution and do not pass \`--autocontinue\`.

- Brainstorm: \`specdev reviewloop brainstorm\`; never auto-approve.
- Mission Brainstorm: \`specdev reviewloop mission --mission=M00001\`; never
  auto-approve.
- Implementation: normally invoked by \`specdev implement\`; finite primary,
  conditional, resolver, and arbiter stages are automatic.
- Discussion: \`specdev reviewloop discussion --discussion=D00001\`.

For Assignment or Mission Brainstorm approval, show the exact contract path and
hash plus the command's concise contract-preview bullets before asking the user
to agree.

Only \`specdev reviewloop\` produces a transition-authorizing strict result
envelope. Native coding-CLI review sessions are advisory and cannot advance
SpecDev state.

Announce meaningful phases, plan changes, failed verification, and blockers
with "Specdev: <action>"; repeated read-only probes need no separate announcement.
`,
}

// The unique adapters to create on every init
export const ALL_ADAPTERS = [ADAPTERS.claude, ADAPTERS.codex, ADAPTERS.cursor]

export const COMMAND_SKILL_DIRS = [join('.claude', 'skills'), join('.codex', 'skills')]

export async function initCommand(flags = {}) {
  const targetDir = typeof flags.target === 'string' ? flags.target : process.cwd()
  const force = flags.force || flags.f
  const dryRun = flags['dry-run']

  if (flags.platform && !flags.json) {
    console.log(
      'ℹ️  --platform is deprecated and ignored; all adapters are now created automatically'
    )
  }

  const specdevPath = join(targetDir, '.specdev')
  const templatePath = join(__dirname, '../../templates/.specdev')

  // Check if .specdev already exists
  if (existsSync(specdevPath) && !force) {
    if (flags.json) {
      console.log(
        JSON.stringify(
          {
            command: 'init',
            version: 1,
            status: 'error',
            error: '.specdev folder already exists in this directory',
            path: specdevPath,
          },
          null,
          2
        )
      )
      process.exitCode = 1
      return
    }
    console.error('❌ .specdev folder already exists in this directory')
    console.log('   Use --force to overwrite, or remove the existing folder first')
    process.exitCode = 1
    return
  }

  if (dryRun) {
    if (flags.json) {
      console.log(
        JSON.stringify(
          {
            command: 'init',
            version: 1,
            status: 'ok',
            dry_run: true,
            from: templatePath,
            to: specdevPath,
          },
          null,
          2
        )
      )
      return
    }
    console.log('🔍 Dry run mode - would copy:')
    console.log(`   From: ${templatePath}`)
    console.log(`   To: ${specdevPath}`)
    return
  }

  // Copy the template
  const origLog = flags.json ? console.log : null
  if (flags.json) console.log = () => {}
  try {
    if (force) {
      await fse.remove(specdevPath)
    }
    await fse.copy(templatePath, specdevPath, {
      overwrite: force,
      errorOnExist: !force,
    })
    // Install immutable, versioned graph packages rather than leaving the
    // unversioned template directories in a new workspace.
    await fse.remove(join(specdevPath, 'workflows'))
    await installGraphPackages(join(templatePath, 'workflows'), join(specdevPath, 'workflows'))
    const engine = installWorkspaceEngine(targetDir)

    // Generate all platform adapter files (never overwrite existing)
    for (const adapter of ALL_ADAPTERS) {
      const adapterPath = join(targetDir, adapter.path)

      if (!existsSync(adapterPath)) {
        // Ensure parent directory exists (needed for .cursor/rules)
        const adapterDir = dirname(adapterPath)
        if (!existsSync(adapterDir)) {
          mkdirSync(adapterDir, { recursive: true })
        }
        writeFileSync(adapterPath, adapterContent(adapter.heading), 'utf-8')
        console.log(`✅ Created ${adapter.path}`)
      } else {
        console.log(`ℹ️  ${adapter.path} already exists, skipping (preserving your customizations)`)
      }
    }

    // Install command skills for the supported first-class agents.
    for (const skillDirRoot of COMMAND_SKILL_DIRS) {
      const skillsDir = join(targetDir, skillDirRoot)
      for (const [skillName, content] of Object.entries(SKILL_FILES)) {
        const skillDir = join(skillsDir, skillName)
        mkdirSync(skillDir, { recursive: true })
        writeFileSync(join(skillDir, 'SKILL.md'), content, 'utf-8')
      }
      console.log(`✅ Installed ${Object.keys(SKILL_FILES).length} skills to ${skillDirRoot}/`)
    }

    // Install Claude Code SessionStart hook
    const hookDir = join(targetDir, '.claude', 'hooks')
    mkdirSync(hookDir, { recursive: true })

    const hookScriptSrc = join(__dirname, '../../hooks/session-start.sh')
    const hookScriptDest = join(hookDir, 'specdev-session-start.sh')

    if (existsSync(hookScriptSrc)) {
      const hookContent = readFileSync(hookScriptSrc, 'utf-8')
      writeFileSync(hookScriptDest, hookContent, { mode: 0o755 })
      console.log('✅ Installed SessionStart hook to .claude/hooks/')

      // Register hook in .claude/settings.json
      const settingsPath = join(targetDir, '.claude', 'settings.json')
      let settings = {}
      let settingsParseFailed = false
      if (existsSync(settingsPath)) {
        try {
          settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
        } catch {
          settingsParseFailed = true
          console.warn(
            '⚠️  .claude/settings.json is invalid JSON, skipping hook registration to avoid overwriting it'
          )
        }
      }

      if (!settingsParseFailed) {
        if (!settings.hooks) settings.hooks = {}
        if (!Array.isArray(settings.hooks.SessionStart)) settings.hooks.SessionStart = []

        const specdevHookCommand = '.claude/hooks/specdev-session-start.sh'
        const alreadyRegistered = settings.hooks.SessionStart.some(
          (entry) => entry.hooks && entry.hooks.some((h) => h.command === specdevHookCommand)
        )

        if (!alreadyRegistered) {
          settings.hooks.SessionStart.push({
            matcher: 'startup|resume|clear|compact',
            hooks: [{ type: 'command', command: specdevHookCommand }],
          })
          writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n')
          console.log('✅ Registered SessionStart hook in .claude/settings.json')
        }
      }
    }

    // Auto-install tool skills if any are available
    const toolsDir = join(specdevPath, 'skills', 'tools')
    if (await fse.pathExists(toolsDir)) {
      const available = await scanSkillsDir(toolsDir, 'tool')
      if (available.length > 0) {
        const skillNames = available.map((s) => s.name).join(',')
        blankLine()
        console.log('Installing tool skills...')
        await skillsInstallCommand([], { target: targetDir, skills: skillNames })
      }
    }

    if (origLog) {
      console.log = origLog
      console.log(
        JSON.stringify(
          {
            command: 'init',
            version: 1,
            status: 'ok',
            path: specdevPath,
            guided_workflows: engine.registered.length - 1,
          },
          null,
          2
        )
      )
      return
    }

    console.log('✅ SpecDev initialized successfully!')
    blankLine()
    printSection('📖 Next steps:')
    printLines([
      '   1. Use specdev-start (or run specdev start) to fill in your project context',
      '   2. Classify work as Direct, Roadmap, Adhoc, Discussion, Assignment, or Mission',
      '   3. Run specdev next --json only to resume a focused workflow',
    ])
    blankLine()
    printSection('Platform adapters created:')
    printLines([
      '   CLAUDE.md        Claude Code',
      '   AGENTS.md        Codex / generic agents',
      '   .cursor/rules    Cursor',
    ])
    blankLine()
    printSection('Agent command skills:')
    printLines([
      '   .claude/skills/       Claude Code',
      '   .codex/skills/        Codex',
      '   specdev-start         Interactive project context setup',
      '   specdev-adhoc         Bounded change without a workflow graph',
      '   specdev-assignment    Reserve ID and start brainstorm',
      '   specdev-continue      Resume from current phase',
      '   specdev-discussion    Concurrent code-read-only exploration',
      '   specdev-roadmap       Stateless user-approved roadmap collaboration',
      '   specdev-mission       Foreground orchestration with automatic bounded waves',
      '   specdev-knowledge-curation  Verified living-knowledge publication',
      '   specdev-reviewloop    Configured reviewer loop',
      '   specdev-rewind        Full workflow re-read',
    ])

    blankLine()
    console.log('Agent profiles: .specdev/agents.yaml')
  } catch (error) {
    if (origLog) console.log = origLog
    if (flags.json) {
      console.log(
        JSON.stringify(
          {
            command: 'init',
            version: 1,
            status: 'error',
            error: error.message,
          },
          null,
          2
        )
      )
      process.exitCode = 1
      return
    }
    console.error('❌ Failed to initialize SpecDev:', error.message)
    process.exitCode = 1
  }
}
