export function parseArgv(argv) {
  const [, , command, ...args] = argv
  const flags = {}
  const positionalArgs = []

  args.forEach((arg) => {
    if (arg.startsWith('--')) {
      const equalIndex = arg.indexOf('=')
      if (equalIndex > -1) {
        const key = arg.slice(2, equalIndex)
        const value = arg.slice(equalIndex + 1)
        flags[key] = value
      } else {
        flags[arg.slice(2)] = true
      }
      return
    }

    if (arg.startsWith('-')) {
      flags[arg.slice(1)] = true
      return
    }

    positionalArgs.push(arg)
  })

  return { command, flags, positionalArgs }
}
