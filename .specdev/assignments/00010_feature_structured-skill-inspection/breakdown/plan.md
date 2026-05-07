# Structured Skill Inspection Implementation Plan

> **For agent:** Implement this plan task-by-task using TDD discipline.

**Goal:** Add read-only, structured skill inspection so agents can discover skills as JSON and load one skill file or support file at a time.

**Architecture:** Extend the existing `specdev skills` command family instead of adding a new top-level command. Enrich the shared skill scanner in `src/utils/skills.js`, then use the same inventory for text output, `--json`, and `skills view`. Keep install/remove/sync behavior unchanged.

**Tech Stack:** Node.js ESM CLI, `fs-extra`, existing plain Node.js test harness.

**Execution Mode:** inline

---

### Task 1: Add Structured Skills JSON
**Mode:** standard
**Skills:** test-driven-development
**Files:** Modify `src/utils/skills.js`, `src/commands/skills.js`, `tests/test-skills.js`

**Step 1: Write the failing test**
Add this test block to `tests/test-skills.js` after the initial skills listing assertions:

```js
console.log('\nskills listing as json:')
result = runCmd(['skills', `--target=${TEST_DIR}`, '--json'])
assert(result.status === 0, 'skills --json succeeds', result.stderr)
const skillsJson = JSON.parse(result.stdout)
assert(skillsJson.command === 'skills', 'skills json command is skills')
assert(skillsJson.version === 1, 'skills json version is 1')
assert(skillsJson.status === 'ok', 'skills json status is ok')
assert(Array.isArray(skillsJson.skills), 'skills json includes skills array')
const jsonCore = skillsJson.skills.find((skill) => skill.name === 'brainstorming')
assert(jsonCore?.category === 'core', 'skills json includes core category')
assert(jsonCore?.path.endsWith('.specdev/skills/core/brainstorming'), 'skills json includes core path')
assert(jsonCore?.skill_md_path.endsWith('.specdev/skills/core/brainstorming/SKILL.md'), 'skills json includes skill md path')
assert(jsonCore?.has_scripts === true, 'skills json includes scripts flag')
assert(jsonCore?.active === undefined, 'core skills have no active flag')
const jsonTool = skillsJson.skills.find((skill) => skill.name === 'test-folder-skill')
assert(jsonTool?.category === 'tool', 'skills json includes tool category')
assert(jsonTool?.description === 'A test skill', 'skills json includes description')
assert(jsonTool?.active === false, 'uninstalled tool skill is inactive')
```

Keep existing `scanSkillsDir` camelCase assertions, and add:

```js
assert(folderSkill?.path.endsWith('.specdev/skills/tools/test-folder-skill'), 'scanner includes skill path')
assert(folderSkill?.skillMdPath.endsWith('.specdev/skills/tools/test-folder-skill/SKILL.md'), 'scanner includes skill md path')
```

**Step 2: Run test to verify it fails**
Run: `node ./tests/test-skills.js`
Expected: FAIL because `skills --json` still prints human text and scanner records do not include paths.

**Step 3: Write minimal implementation**
In `src/utils/skills.js`, enrich scanner records:

```js
skills.push({
  name: entry.name,
  description: desc,
  hasScripts,
  category,
  path: join(dir, entry.name),
  skillMdPath: skillMd,
})
```

For flat markdown skills:

```js
const markdownPath = join(dir, entry.name)
skills.push({
  name: entry.name.replace('.md', ''),
  description: '',
  hasScripts: false,
  category,
  path: markdownPath,
  skillMdPath: markdownPath,
})
```

In `src/commands/skills.js`, add JSON output on the default list path only. Keep subcommand routing before list handling. Convert internal camelCase fields to the public snake_case JSON shape:

```js
function toSkillJson(skill, activeNames) {
  const item = {
    name: skill.name,
    category: skill.category,
    description: skill.description,
    path: skill.path,
    skill_md_path: skill.skillMdPath,
    has_scripts: skill.hasScripts,
  }
  if (skill.category === 'tool') {
    item.active = activeNames.has(skill.name)
  }
  return item
}
```

Emit:

```js
if (flags.json) {
  console.log(JSON.stringify({
    command: 'skills',
    version: 1,
    status: 'ok',
    skills: skills.map((skill) => toSkillJson(skill, activeNames)),
  }, null, 2))
  return
}
```

**Step 4: Run test to verify it passes**
Run: `node ./tests/test-skills.js`
Expected: PASS.

**Step 5: Commit**
Run:

```bash
git add src/utils/skills.js src/commands/skills.js tests/test-skills.js .specdev/assignments/00010_feature_structured-skill-inspection
git commit -m "feat: add skills json output"
```

### Task 2: Add Guarded Skills View
**Mode:** full
**Skills:** test-driven-development
**Files:** Modify `src/commands/skills.js`, `tests/test-skills.js`, `README.md`

**Step 1: Write the failing test**
Add this test block to `tests/test-skills.js` after the JSON listing block:

```js
console.log('\nskills view:')
result = runCmd(['skills', 'view', 'brainstorming', `--target=${TEST_DIR}`])
assert(result.status === 0, 'skills view succeeds for core skill', result.stderr)
assert(result.stdout.includes('# Brainstorming'), 'skills view prints SKILL.md content')
assert(!result.stdout.includes('Available skills'), 'skills view does not print list output')

result = runCmd(['skills', 'view', 'test-folder-skill', 'scripts/run.sh', `--target=${TEST_DIR}`])
assert(result.status === 0, 'skills view succeeds for support file', result.stderr)
assert(result.stdout.includes('echo "ok"'), 'skills view prints support file content')

result = runCmd(['skills', 'view', 'test-folder-skill', '../active-tools.json', `--target=${TEST_DIR}`])
assert(result.status === 1, 'skills view blocks traversal')
assert(result.stderr.includes('Cannot read outside skill directory'), 'skills view explains traversal block')

result = runCmd(['skills', 'view', 'missing-skill', `--target=${TEST_DIR}`])
assert(result.status === 1, 'skills view fails for missing skill')
assert(result.stderr.includes('Unknown skill: missing-skill'), 'skills view reports missing skill')
```

**Step 2: Run test to verify it fails**
Run: `node ./tests/test-skills.js`
Expected: FAIL because `skills view` is not implemented.

**Step 3: Write minimal implementation**
In `src/commands/skills.js`, import `resolve` and `relative` from `path`:

```js
import { join, resolve, relative } from 'path'
```

Route `view` before install/remove/sync:

```js
if (subcommand === 'view') {
  return skillsViewCommand(positionalArgs.slice(1), flags)
}
```

Add a shared inventory helper:

```js
async function loadSkills(targetDir) {
  const skillsPath = join(targetDir, '.specdev', 'skills')
  if (!(await fse.pathExists(skillsPath))) {
    return { error: 'No .specdev/skills directory found.' }
  }
  const skills = []
  skills.push(...await scanSkillsDir(join(skillsPath, 'core'), 'core'))
  skills.push(...await scanSkillsDir(join(skillsPath, 'tools'), 'tool'))
  skills.sort((a, b) => a.name.localeCompare(b.name))
  return { skills, skillsPath }
}
```

Use that helper from list output and implement view:

```js
async function skillsViewCommand(args, flags) {
  const skillName = args[0]
  const relativePath = args[1] || 'SKILL.md'
  if (!skillName) {
    console.error('Usage: specdev skills view <name> [relative-path]')
    process.exitCode = 1
    return
  }

  const targetDir = resolveTargetDir(flags)
  const { skills, error } = await loadSkills(targetDir)
  if (error) {
    console.error(error)
    console.error('Run `specdev init` first.')
    process.exitCode = 1
    return
  }

  const skill = skills.find((item) => item.name === skillName)
  if (!skill) {
    console.error(`Unknown skill: ${skillName}`)
    process.exitCode = 1
    return
  }

  const baseDir = skill.path.endsWith('.md') ? resolve(skill.path, '..') : resolve(skill.path)
  const targetPath = relativePath === 'SKILL.md' ? skill.skillMdPath : join(baseDir, relativePath)
  const resolvedTarget = resolve(targetPath)
  const rel = relative(baseDir, resolvedTarget)
  if (rel.startsWith('..') || rel === '..' || rel.startsWith('/') || rel.startsWith('\\')) {
    console.error('Cannot read outside skill directory')
    process.exitCode = 1
    return
  }

  if (!(await fse.pathExists(resolvedTarget))) {
    console.error(`Skill file not found: ${relativePath}`)
    process.exitCode = 1
    return
  }

  console.log(await fse.readFile(resolvedTarget, 'utf-8'))
}
```

Add README usage near the existing skill management section:

```markdown
specdev skills --json                 # Machine-readable skill inventory
specdev skills view <name> [path]     # Print a skill file or support file
```

**Step 4: Run targeted tests**
Run: `node ./tests/test-skills.js`
Expected: PASS.

**Step 5: Run full suite**
Run: `npm test`
Expected: PASS.

**Step 6: Commit**
Run:

```bash
git add README.md src/commands/skills.js tests/test-skills.js .specdev/assignments/00010_feature_structured-skill-inspection
git commit -m "feat: add guarded skills view"
```
