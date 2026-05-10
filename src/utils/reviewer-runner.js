import { spawn as realSpawn } from 'child_process'

export const REVIEWER_TERMINATION_GRACE_MS = 5000
export const DEFAULT_STDOUT_BUFFER_LIMIT = 2 * 1024 * 1024

function isoFromNow(now) {
  const value = now()
  return new Date(value).toISOString()
}

function secondsElapsed(elapsedMs) {
  return Math.floor(elapsedMs / 1000)
}

function appendCapped(buffer, chunk, limit) {
  if (limit <= 0) return buffer
  const next = Buffer.concat([buffer, Buffer.from(chunk)])
  if (next.length <= limit) return next
  return next.subarray(next.length - limit)
}

export function runReviewerProcess({
  command,
  cwd,
  env,
  timeoutMs,
  heartbeatMs,
  onStdout = (chunk, ctx) => {
    process.stdout.write(chunk)
    if (chunk.length > 0) ctx.markActivity()
  },
  onStderr = (chunk, ctx) => {
    process.stderr.write(chunk)
    if (chunk.length > 0) ctx.markActivity()
  },
  onHeartbeat = (elapsedMs) => {
    process.stderr.write(`⏳ reviewer running - ${secondsElapsed(elapsedMs)}s elapsed\n`)
  },
  stdoutBufferLimit = DEFAULT_STDOUT_BUFFER_LIMIT,
  spawn = realSpawn,
  now = () => Date.now(),
  setTimeout: setTimer = globalThis.setTimeout,
  clearTimeout: clearTimer = globalThis.clearTimeout,
  killProcessGroup = (pid, signal) => process.kill(pid, signal),
} = {}) {
  const startedMs = now()
  const startedAt = isoFromNow(now)
  let stdoutBuffer = Buffer.alloc(0)
  let settled = false
  let heartbeatTimer = null
  let timeoutTimer = null
  let killTimer = null

  return new Promise((resolve, reject) => {
    const child = spawn('bash', ['-c', command], {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    })

    function finish(result) {
      if (settled) return
      settled = true
      clearTimer(timeoutTimer)
      clearTimer(heartbeatTimer)
      if (killTimer && !result.timedOut) clearTimer(killTimer)
      const endedMs = now()
      resolve({
        ...result,
        startedAt,
        endedAt: new Date(endedMs).toISOString(),
        elapsedMs: endedMs - startedMs,
        stdoutBuffer,
      })
    }

    function rearmHeartbeat() {
      clearTimer(heartbeatTimer)
      heartbeatTimer = setTimer(() => {
        onHeartbeat(now() - startedMs)
        rearmHeartbeat()
      }, heartbeatMs)
    }

    const ctx = {
      markActivity() {
        if (!settled) rearmHeartbeat()
      },
    }

    rearmHeartbeat()
    timeoutTimer = setTimer(() => {
      if (settled) return
      try {
        killProcessGroup(-child.pid, 'SIGTERM')
      } catch {
        // Process may already have exited.
      }
      killTimer = setTimer(() => {
        try {
          killProcessGroup(-child.pid, 'SIGKILL')
        } catch {
          // Process may already have exited.
        }
      }, REVIEWER_TERMINATION_GRACE_MS)
      killTimer?.unref?.()
      finish({ exitCode: null, timedOut: true })
    }, timeoutMs)

    child.stdout.on('data', (chunk) => {
      stdoutBuffer = appendCapped(stdoutBuffer, chunk, stdoutBufferLimit)
      onStdout(chunk, ctx)
    })
    child.stderr.on('data', (chunk) => {
      onStderr(chunk, ctx)
    })
    child.on('error', (error) => {
      try {
        killProcessGroup(-child.pid, 'SIGTERM')
      } catch {
        // Process may already have exited.
      }
      clearTimer(timeoutTimer)
      clearTimer(heartbeatTimer)
      if (killTimer) clearTimer(killTimer)
      reject(error)
    })
    child.on('close', (code) => {
      finish({ exitCode: code, timedOut: false })
    })
  })
}
