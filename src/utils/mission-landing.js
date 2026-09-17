// Compatibility-only entry points. Mission completion is a local commit.
export async function inspectMissionLanding() {
  return {
    status: 'unsupported',
    reason: 'branch_management_removed',
    error: 'SpecDev no longer performs Mission landing; Git state is unchanged.',
  }
}
export const landMission = inspectMissionLanding
