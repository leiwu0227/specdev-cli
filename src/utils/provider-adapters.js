const FILESYSTEM_POLICY = Object.freeze({
  worker: 'workspace-write',
  reviewer: 'read-only',
})

const NETWORK_CAPABILITIES = Object.freeze({
  codex: new Set(['worker', 'reviewer']),
  claude: new Set(),
  cursor: new Set(),
})

export function resolveProviderAccessPolicy({ profile, role }) {
  if (!profile || !profile.provider) throw new Error('agent profile is required')
  if (!Object.hasOwn(FILESYSTEM_POLICY, role)) throw new Error(`invalid agent role: ${role}`)
  if (!Object.hasOwn(NETWORK_CAPABILITIES, profile.provider)) {
    throw new Error(`unsupported agent provider: ${profile.provider}`)
  }
  const network = profile.network ?? false
  if (typeof network !== 'boolean') throw new Error(`${role} profile network must be true or false`)
  const filesystem = FILESYSTEM_POLICY[role]
  if (network && !NETWORK_CAPABILITIES[profile.provider].has(role)) {
    throw new Error(
      `${profile.provider} provider cannot enforce network-enabled ${filesystem} access for the ${role} profile`
    )
  }
  return { filesystem, network }
}

export function buildProviderInvocation({ profile, role, cwd, resultPath }) {
  const accessPolicy = resolveProviderAccessPolicy({ profile, role })

  if (profile.provider === 'codex') {
    const args = [
      'exec',
      '--ephemeral',
      '--cd',
      cwd,
      '--sandbox',
      role === 'reviewer' ? 'read-only' : 'workspace-write',
      '--model',
      profile.model,
    ]
    if (role === 'reviewer' && accessPolicy.network) args.push('--config', 'web_search="live"')
    if (role === 'worker' && accessPolicy.network)
      args.push('--config', 'sandbox_workspace_write.network_access=true')
    if (profile.effort) args.push('--config', `model_reasoning_effort="${profile.effort}"`)
    if (resultPath) args.push('--output-last-message', resultPath)
    args.push('-')
    return { command: 'codex', args, stdin: true, resultMode: 'file', accessPolicy }
  }

  if (profile.provider === 'claude') {
    const args = [
      '--print',
      '--input-format',
      'text',
      '--output-format',
      'text',
      '--no-session-persistence',
      '--model',
      profile.model,
      '--permission-mode',
      role === 'reviewer' ? 'plan' : 'acceptEdits',
    ]
    if (profile.effort) args.push('--effort', profile.effort)
    return { command: 'claude', args, stdin: true, resultMode: 'stdout', accessPolicy }
  }

  if (profile.provider === 'cursor') {
    if (profile.effort) {
      throw new Error('cursor provider does not support an effort setting')
    }
    const args = ['--print', '--trust', '--workspace', cwd, '--model', profile.model]
    if (role === 'reviewer') args.push('--mode', 'plan')
    else args.push('--sandbox', 'enabled')
    return { command: 'cursor-agent', args, stdin: true, resultMode: 'stdout', accessPolicy }
  }

  throw new Error(`unsupported agent provider: ${profile.provider}`)
}
