import fse from 'fs-extra'

export function resolveTargetDir(flags = {}) {
  return typeof flags.target === 'string' ? flags.target : process.cwd()
}

export async function requireSpecdevDirectory(specdevPath) {
  if (await fse.pathExists(specdevPath)) {
    return
  }
  console.error('❌ No .specdev directory found')
  console.log('   Run "specdev init" first')
  process.exit(1)
}
