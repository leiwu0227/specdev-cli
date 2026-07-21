export function buildProviderInvocation({ profile, role, cwd, resultPath }) {
  if (!profile || !profile.provider) throw new Error('agent profile is required')
  if (!['worker', 'reviewer'].includes(role)) throw new Error(`invalid agent role: ${role}`)

  if (profile.provider === 'codex') {
    const args = [
      'exec',
      '--ephemeral',
      '--cd', cwd,
      '--sandbox', role === 'reviewer' ? 'read-only' : 'workspace-write',
      '--model', profile.model,
    ]
    if (role === 'worker' && profile.network) {
      args.push('--config', 'sandbox_workspace_write.network_access=true')
    }
    if (profile.effort) args.push('--config', `model_reasoning_effort="${profile.effort}"`)
    if (resultPath) args.push('--output-last-message', resultPath)
    args.push('-')
    return { command: 'codex', args, stdin: true, resultMode: 'file' }
  }

  if (profile.provider === 'claude') {
    const args = [
      '--print',
      '--input-format', 'text',
      '--output-format', 'text',
      '--no-session-persistence',
      '--model', profile.model,
      '--permission-mode', role === 'reviewer' ? 'plan' : 'acceptEdits',
    ]
    if (profile.effort) args.push('--effort', profile.effort)
    return { command: 'claude', args, stdin: true, resultMode: 'stdout' }
  }

  if (profile.provider === 'cursor') {
    if (profile.effort) {
      throw new Error('cursor provider does not support an effort setting')
    }
    const args = ['--print', '--trust', '--workspace', cwd, '--model', profile.model]
    if (role === 'reviewer') args.push('--mode', 'plan')
    else args.push('--sandbox', 'enabled')
    return { command: 'cursor-agent', args, stdin: true, resultMode: 'stdout' }
  }

  throw new Error(`unsupported agent provider: ${profile.provider}`)
}
