import assert from 'node:assert/strict'
import {
  actionableMissionGap,
  adoptLegacyMissionReplan,
  advanceMissionGap,
  attachMissionGapAssignment,
  awaitMissionGapValidation,
  closeMissionGap,
  compactMissionGaps,
  failMissionGap,
  missionGap,
  openMissionGap,
} from '../src/utils/mission-gaps.js'

const mission = {}
const childA = openMissionGap(mission, {
  kind: 'child',
  sourceId: '00001',
  signalId: 'child:00001:follow-up',
  artifact: 'outcome-a.md',
})
const childB = openMissionGap(mission, {
  kind: 'child',
  sourceId: '00002',
  signalId: 'child:00002:follow-up',
  artifact: 'outcome-b.md',
})
assert.notEqual(childA.gap.id, childB.gap.id, 'different children converge independently')

const restarted = JSON.parse(JSON.stringify(mission))
const duplicate = openMissionGap(restarted, {
  kind: 'child',
  sourceId: '00001',
  signalId: 'child:00001:follow-up',
  artifact: 'rewritten-outcome-a.md',
})
assert.equal(duplicate.gap.id, childA.gap.id, 'restart reuses the stable source identity')
assert.equal(duplicate.processed, false, 'restart cannot process the same signal twice')

attachMissionGapAssignment(restarted, childA.gap.id, '00003', { stage: 'resolution' })
const resolver = advanceMissionGap(restarted, childA.gap.id, {
  signalId: 'child:00003:follow-up',
})
assert.equal(resolver.gap.stage, 'resolver', 'repair descendant advances its parent gap')
attachMissionGapAssignment(restarted, childA.gap.id, '00004', { stage: 'resolver' })
const arbiter = advanceMissionGap(restarted, childA.gap.id, {
  signalId: 'child:00004:follow-up',
})
assert.equal(arbiter.gap.stage, 'arbiter')
const finite = advanceMissionGap(restarted, childA.gap.id, {
  signalId: 'arbiter:still-open',
})
assert.equal(finite.gap.stage, 'arbiter', 'the escalation ladder is finite')
assert.equal(actionableMissionGap(restarted).id, childA.gap.id)

awaitMissionGapValidation(restarted, childB.gap.id, { artifact: 'resolution.md' })
assert.equal(missionGap(restarted, childB.gap.id).status, 'validating')
closeMissionGap(restarted, childB.gap.id, { evidence: 'verification.json' })
assert.equal(missionGap(restarted, childB.gap.id).disposition, 'evidence-closed')
failMissionGap(restarted, childA.gap.id, 'semantic-failure', {
  reason: 'Acceptance evidence proves the objective cannot be met.',
})
assert.equal(missionGap(restarted, childA.gap.id).disposition, 'semantic-failure')

const infrastructure = openMissionGap(restarted, {
  kind: 'final-verification',
  sourceId: 'authorized-command',
  signalId: 'verification:1',
}).gap
failMissionGap(restarted, infrastructure.id, 'infrastructure-failure', {
  reason: 'Provider unavailable.',
})
assert.equal(missionGap(restarted, infrastructure.id).disposition, 'infrastructure-failure')

const legacy = {
  pending_replan: {
    reason: 'child_follow_up',
    child: '00009',
    artifact: 'legacy-outcome.md',
    created_at: '2026-07-26T00:00:00.000Z',
  },
  replan_attempts: { child_follow_up: 1 },
}
assert.equal(adoptLegacyMissionReplan(legacy), true)
assert.equal(legacy.pending_replan, undefined)
assert.equal(legacy.replan_attempts, undefined)
assert.equal(
  actionableMissionGap(legacy).source.key,
  'child:00009',
  'legacy replan state adopts one actionable durable gap'
)

assert.deepEqual(compactMissionGaps(restarted), {
  opened: 3,
  closed: 1,
  failed: 2,
  dispositions: {
    'semantic-failure': 1,
    'evidence-closed': 1,
    'infrastructure-failure': 1,
  },
})

console.log('Mission gap tests passed.')
