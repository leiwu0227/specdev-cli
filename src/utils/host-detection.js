const VALID_HOST_AGENTS = new Set(['codex', 'claude', 'cursor'])

function validateHostAgent(value) {
  if (VALID_HOST_AGENTS.has(value)) return value
  throw new Error(`Invalid host agent: ${value}. Expected one of: claude, codex, cursor.`)
}

export function detectHostAgent({ flagOverride } = {}, env = process.env) {
  if (flagOverride) return validateHostAgent(flagOverride)
  if (env.SPECDEV_HOST_AGENT) return validateHostAgent(env.SPECDEV_HOST_AGENT)

  const markers = []
  if (env.CLAUDECODE) markers.push('claude')
  if (env.CODEX_HOME) markers.push('codex')
  if (env.CURSOR_TRACE_ID || env.CURSOR_AGENT || env.CURSOR_SESSION_ID) markers.push('cursor')

  const unique = [...new Set(markers)]
  if (unique.length === 1) return unique[0]
  if (unique.length > 1) {
    throw new Error(`Ambiguous host agent markers: ${unique.join(', ')}`)
  }
  throw new Error('Could not detect host agent. Pass --platform=<claude|codex|cursor>.')
}
