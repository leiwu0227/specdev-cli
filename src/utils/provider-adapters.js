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

export function reviewerSessionCapability({ profile, role }) {
  if (role !== 'reviewer' || profile?.provider !== 'claude') {
    return { supported: false, provider: profile?.provider || null }
  }
  return { supported: true, provider: 'claude', version: 1 }
}

export function buildProviderInvocation({
  profile,
  role,
  cwd,
  resultPath,
  providerSession = null,
}) {
  const accessPolicy = resolveProviderAccessPolicy({ profile, role })
  const session = normalizeProviderSession({ profile, role, providerSession })

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
      session ? 'json' : 'text',
      '--model',
      profile.model,
      '--permission-mode',
      role === 'reviewer' ? 'plan' : 'acceptEdits',
    ]
    if (!session) args.splice(5, 0, '--no-session-persistence')
    if (session?.mode === 'resume') args.push('--resume', session.id)
    if (profile.effort) args.push('--effort', profile.effort)
    return {
      command: 'claude',
      args,
      stdin: true,
      resultMode: session ? 'claude-json' : 'stdout',
      accessPolicy,
      providerSession: session,
    }
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

export function decodeProviderOutput(invocation, stdout) {
  if (invocation.resultMode !== 'claude-json') {
    return { resultText: String(stdout || ''), providerSessionId: null }
  }

  let decoded
  try {
    decoded = JSON.parse(String(stdout || '').trim())
  } catch {
    throw new Error('Claude returned malformed structured output')
  }
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    throw new Error('Claude returned invalid structured output')
  }
  if (typeof decoded.result !== 'string' || !decoded.result.trim()) {
    throw new Error('Claude structured output did not contain a result')
  }
  const providerSessionId = validProviderSessionId(decoded.session_id)
    ? decoded.session_id.trim()
    : null
  if (invocation.providerSession?.mode === 'resume') {
    if (!providerSessionId || providerSessionId !== invocation.providerSession.id) {
      throw new Error('Claude resume did not confirm the requested session identity')
    }
  }
  return { resultText: decoded.result, providerSessionId }
}

function normalizeProviderSession({ profile, role, providerSession }) {
  if (!providerSession) return null
  if (!reviewerSessionCapability({ profile, role }).supported) {
    throw new Error(`${profile.provider} provider does not support reviewer session continuation`)
  }
  if (!['capture', 'resume'].includes(providerSession.mode)) {
    throw new Error('provider session mode must be capture or resume')
  }
  if (providerSession.mode === 'capture') return { mode: 'capture' }
  if (!validProviderSessionId(providerSession.id)) {
    throw new Error('provider resume session identity is invalid')
  }
  return { mode: 'resume', id: providerSession.id.trim() }
}

function validProviderSessionId(value) {
  return /^[A-Za-z0-9_-]{8,256}$/.test(String(value || '').trim())
}
