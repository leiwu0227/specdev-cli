import { join } from 'path'
import fse from 'fs-extra'

/**
 * Resolve the focus instruction for a given review round.
 * Reads review-focus.json from the reviewloop skill directory.
 * Returns empty string on missing file, malformed JSON, or missing round key.
 */
export async function resolveRoundFocus(specdevPath, round) {
  const focusPath = join(specdevPath, 'skills', 'core', 'reviewloop', 'review-focus.json')

  if (!(await fse.pathExists(focusPath))) return ''

  let config
  try {
    config = await fse.readJson(focusPath)
  } catch {
    console.warn(`Warning: invalid review-focus.json at ${focusPath}`)
    return ''
  }

  const roundFocus = config.round_focus
  if (!roundFocus) return ''

  return roundFocus[String(round)] || roundFocus.default || ''
}
