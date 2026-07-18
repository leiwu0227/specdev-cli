import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = resolve(
  process.argv[2] ||
    process.env.RIPPLEGRAPH_SOURCE ||
    join(repoRoot, '..', '..', '..', 'ripplepulse', 'lib', 'ripplegraph')
)
const vendorDir = join(repoRoot, 'vendor')
const tempDir = join(vendorDir, '.pack')

mkdirSync(tempDir, { recursive: true })
const packed = spawnSync('npm', ['pack', '--pack-destination', tempDir], {
  cwd: sourceRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
})
if (packed.status !== 0) process.exit(packed.status || 1)

const tarballs = readdirSync(tempDir).filter((name) => name.endsWith('.tgz'))
if (tarballs.length !== 1) {
  throw new Error(`expected one RippleGraph tarball, found ${tarballs.length}`)
}

for (const name of readdirSync(vendorDir)) {
  if (name.startsWith('ripplegraph-') && name.endsWith('.tgz')) {
    rmSync(join(vendorDir, name))
  }
}

const tarball = tarballs[0]
copyFileSync(join(tempDir, tarball), join(vendorDir, tarball))
rmSync(tempDir, { recursive: true, force: true })
console.log(`Vendored ${tarball} from ${sourceRoot}`)
