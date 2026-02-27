export async function skillsRemoveCommand(positionalArgs = [], flags = {}) {
  if (!positionalArgs[0]) {
    console.error('Missing required skill name')
    console.log('Usage: specdev skills remove <name>')
    process.exitCode = 1
    return
  }
  console.log('Remove command — not yet implemented')
}
