import { createHash } from 'node:crypto'
import { join, relative } from 'node:path'
import fse from 'fs-extra'
import { stringify } from 'yaml'
import {
  commitExactDelivery,
  findCommitByTrailer,
  firstParent,
  gitChangedPathsAtCommit,
  gitStatusEntries,
  requireGitHead,
  synchronizeIndexPaths,
} from './git-delivery.js'

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
async function fileDigest(path) {
  try {
    const stat = await fse.lstat(path)
    if (!stat.isFile()) throw new Error(`Closure publication requires a regular file: ${path}`)
    return digest(await fse.readFile(path))
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

export async function prepareClosurePublication({ targetDir, missionPath, mission }) {
  const ownPath = relative(targetDir, join(missionPath, 'mission.yaml'))
  const dirty = new Set((await gitStatusEntries(targetDir)).map((entry) => entry.path))
  mission.closure.prepared_files = Object.fromEntries(
    await Promise.all(
      mission.closure.plan.terminal_paths
        .filter((path) => path !== ownPath && dirty.has(path))
        .map(async (path) => [path, await fileDigest(join(targetDir, path))])
    )
  )
}

export async function publishClosure({ targetDir, specdevPath, missionPath, mission }) {
  const { closure } = mission
  const { plan } = closure
  const ownPath = relative(targetDir, join(missionPath, 'mission.yaml'))
  if (!closure.prepared_files) throw new Error('Closure publication manifest is missing')
  const files = {
    ...closure.prepared_files,
    [ownPath]: digest(stringify(mission, { lineWidth: 0 })),
  }
  const paths = Object.keys(files).sort()
  const receiptPath = join(specdevPath, 'cache', 'mission-close', `${mission.id}.json`)
  const receipt = await fse.readJson(receiptPath).catch((error) => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  if (paths.some((path) => !plan.terminal_paths.includes(path)))
    throw new Error('Closure publication contains an unauthorized path')
  let commit = await findCommitByTrailer(targetDir, 'SpecDev-Closure-Plan', plan.digest, {
    revision: 'HEAD',
  })
  if (!commit) {
    if ((await requireGitHead(targetDir)) !== plan.checkout.revision)
      throw new Error('Closure publication HEAD changed; retry on the confirmed revision')
    const verifyFiles = async () => {
      for (const [path, expected] of Object.entries(files)) {
        if ((await fileDigest(join(targetDir, path))) !== expected)
          throw new Error(`Prepared closure file changed: ${path}`)
      }
    }
    await verifyFiles()
    const result = await commitExactDelivery(targetDir, {
      expectedHead: plan.checkout.revision,
      paths,
      subject: `specdev(mission): close ${mission.id} with accepted limitations`,
      trailers: {
        'SpecDev-Mission': mission.id,
        'SpecDev-Commit-Type': 'closure',
        'SpecDev-Disposition': 'accepted-with-limitations',
        'SpecDev-Closure-Plan': plan.digest,
      },
      finalizeDraft: verifyFiles,
    })
    commit = result.commit
  } else if (receipt?.commit !== commit && (await requireGitHead(targetDir)) === commit) {
    // Complete a process interruption between update-ref and index synchronization.
    for (const [path, expected] of Object.entries(files)) {
      if ((await fileDigest(join(targetDir, path))) !== expected)
        throw new Error(`Published closure file changed: ${path}`)
    }
    await synchronizeIndexPaths(targetDir, paths, commit)
  }
  if (
    (await firstParent(targetDir, commit)) !== plan.checkout.revision ||
    JSON.stringify(await gitChangedPathsAtCommit(targetDir, commit)) !== JSON.stringify(paths)
  ) {
    throw new Error('Closure commit differs from the confirmed parent or path manifest')
  }
  if (receipt?.commit !== commit) {
    await fse.outputJson(
      `${receiptPath}.tmp-${process.pid}`,
      { commit, plan_digest: plan.digest },
      { spaces: 2 }
    )
    await fse.move(`${receiptPath}.tmp-${process.pid}`, receiptPath, { overwrite: true })
  }
  return { parent: plan.checkout.revision, terminal_commit: commit, committed_paths: paths }
}
