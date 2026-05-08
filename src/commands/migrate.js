import { join } from 'path'
import {
  resolveTargetDir,
  requireSpecdevDirectory,
} from '../utils/command-context.js'
import { blankLine, printBullets, printSection } from '../utils/output.js'

export async function migrateCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  blankLine()
  printSection('Guided SpecDev migration')
  printBullets([
    'Read .specdev/_guides/migration_guide.md',
    'Use the specdev-layout-migration agent skill when available',
    'Inventory the current .specdev/ tree before editing',
    'Write .specdev/migration/layout-plan.md with proposed moves and open questions',
    'Ask the user before moving, renaming, or deleting ambiguous artifacts',
    'Apply only approved moves, then verify with specdev status --json',
  ])
  blankLine()
  printSection('Legacy assignment-file migration')
  printBullets([
    'For the old deterministic V3-to-V4 assignment file mover, run:',
    'specdev migrate legacy-assignments --dry-run',
    'specdev migrate legacy-assignments',
  ])
}
