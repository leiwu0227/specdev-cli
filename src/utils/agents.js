import { existsSync } from 'fs'
import { join } from 'path'

export const AGENT_CONFIGS = {
  'claude-code': {
    detect: (dir) => existsSync(join(dir, '.claude')),
    wrapperDir: join('.claude', 'skills'),
    wrapperFile: (name) => join(name, 'SKILL.md'),
  },
  'codex': {
    detect: (dir) => existsSync(join(dir, '.codex')),
    wrapperDir: join('.codex', 'skills'),
    wrapperFile: (name) => join(name, 'SKILL.md'),
  },
  'opencode': {
    detect: (dir) => existsSync(join(dir, '.opencode')),
    wrapperDir: join('.claude', 'skills'),
    wrapperFile: (name) => join(name, 'SKILL.md'),
  },
}

export function detectCodingAgents(targetDir) {
  const detected = []
  for (const [agentName, config] of Object.entries(AGENT_CONFIGS)) {
    if (config.detect(targetDir)) {
      detected.push(agentName)
    }
  }
  return detected
}
