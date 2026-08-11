export function validateEvidenceOnlyObservation({ child, progress, result }) {
  if (child?.execution !== 'evidence-only') {
    throw new Error('Ordinary Mission children cannot use evidence-only completion')
  }
  const observations = (progress?.verification || []).filter(
    (receipt) => receipt.role === 'authoritative_acceptance'
  )
  const observation = observations[0]
  if (
    progress?.follow_up !== 'required' ||
    result?.status !== 'blocked' ||
    observations.length !== 1 ||
    observation.command !== child.observation_command ||
    observation.status !== 'failed' ||
    !String(observation.revision || '').trim() ||
    !String(observation.scope || '').trim() ||
    !Number.isSafeInteger(observation.duration_ms)
  ) {
    throw new Error(
      `Evidence-only child ${child?.id || 'unknown'} cannot return completed-with-follow-up because its negative observation provenance is incomplete`
    )
  }
  return observation
}
