import { join } from 'node:path'
import fse from 'fs-extra'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { resolveTargetDir } from '../utils/command-context.js'
import {
  assertCurrentAssignmentPath,
  checkpointedContractFor,
  contractPreview,
  normalizeReviewPolicy,
  relativeToRepo,
  validateAssignmentContract,
} from '../utils/assignment-vnext.js'
import { decideGuidedNode, stepGuidedNode } from '../utils/engine-sync.js'

export async function checkpointCommand(positionalArgs = [], flags = {}) {
  const phase = positionalArgs[0]
  if (phase !== 'brainstorm') {
    console.error('Assignment vNext has one explicit checkpoint: specdev checkpoint brainstorm')
    process.exitCode = 1
    return
  }

  const targetDir = resolveTargetDir(flags)
  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)
  const contract = await validateAssignmentContract(assignmentPath)
  if (!contract.valid) {
    const payload = {
      command: 'checkpoint',
      version: 2,
      status: 'fail',
      phase,
      assignment: name,
      issues: contract.errors,
    }
    if (flags.json) console.log(JSON.stringify(payload, null, 2))
    else {
      console.error(`Brainstorm contract is not ready for ${name}:`)
      for (const issue of contract.errors) console.error(`  - ${issue}`)
    }
    process.exitCode = 1
    return
  }

  let state
  try {
    state = await assertCurrentAssignmentPath(targetDir, assignmentPath)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
    return
  }
  if (state.position.node === 'brainstorm') {
    stepGuidedNode(targetDir, 'brainstorm', {
      contract: relativeToRepo(targetDir, contract.path),
      contract_hash: contract.hash,
    })
  } else if (state.position.node === 'approve-contract') {
    const checkpointed = await checkpointedContractFor(targetDir)
    if (checkpointed?.contract_hash !== contract.hash) {
      const assignmentStatus = await fse
        .readJson(join(assignmentPath, 'status.json'))
        .catch(() => ({}))
      const reset = decideGuidedNode(targetDir, 'approve-contract', {
        approved: false,
        contract_hash: checkpointed?.contract_hash || contract.hash,
        actor: 'contract-recheckpoint',
        approved_at: new Date().toISOString(),
        review_policy: normalizeReviewPolicy(assignmentStatus.review_policy),
      })
      if (!reset.synchronized) {
        console.error('Could not return the changed contract to Brainstorm for re-checkpointing')
        process.exitCode = 1
        return
      }
      const refreshed = stepGuidedNode(targetDir, 'brainstorm', {
        contract: relativeToRepo(targetDir, contract.path),
        contract_hash: contract.hash,
      })
      if (!refreshed.synchronized) {
        console.error('Could not checkpoint the changed Assignment contract')
        process.exitCode = 1
        return
      }
    }
  } else {
    console.error(`Assignment is at ${state.position.node}, not Brainstorm`)
    process.exitCode = 1
    return
  }

  const payload = {
    command: 'checkpoint',
    version: 2,
    status: 'pass',
    phase,
    assignment: name,
    contract: relativeToRepo(targetDir, contract.path),
    contract_hash: contract.hash,
    contract_preview: contractPreview(contract.content),
    acceptance_criteria: contract.acceptanceIds,
    next_actions: {
      optional_review: 'specdev reviewloop brainstorm',
      approval: 'specdev approve brainstorm',
    },
  }
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else {
    console.log(`Brainstorm contract ready: ${name}`)
    console.log(`Contract: ${payload.contract}`)
    console.log(`Contract hash: ${contract.hash}`)
    console.log('Contract preview:')
    for (const line of payload.contract_preview) console.log(`  - ${line}`)
    console.log('Optional review: specdev reviewloop brainstorm')
    console.log('When the user explicitly agrees: specdev approve brainstorm')
  }
}
