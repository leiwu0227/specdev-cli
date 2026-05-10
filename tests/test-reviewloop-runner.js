import { EventEmitter } from 'node:events'
import { runReviewerProcess } from '../src/utils/reviewer-runner.js'

let failures = 0
let passes = 0

function assert(condition, msg, detail = '') {
  if (!condition) {
    console.error(`  FAIL ${msg}`)
    if (detail) console.error(`       ${detail}`)
    failures++
  } else {
    console.log(`  PASS ${msg}`)
    passes++
  }
}

function createFakeClock() {
  let nowMs = 0
  let nextId = 1
  const timers = new Map()

  function setTimeoutFake(fn, delay) {
    const id = nextId++
    timers.set(id, { fn, at: nowMs + delay })
    return id
  }

  function clearTimeoutFake(id) {
    timers.delete(id)
  }

  function tick(ms) {
    const target = nowMs + ms
    while (true) {
      let nextEntry = null
      for (const [id, timer] of timers.entries()) {
        if (timer.at <= target && (!nextEntry || timer.at < nextEntry.timer.at)) {
          nextEntry = { id, timer }
        }
      }
      if (!nextEntry) break
      nowMs = nextEntry.timer.at
      timers.delete(nextEntry.id)
      nextEntry.timer.fn()
    }
    nowMs = target
  }

  return {
    now: () => nowMs,
    setTimeout: setTimeoutFake,
    clearTimeout: clearTimeoutFake,
    tick,
  }
}

function createFakeChild(pid = 1234) {
  const child = new EventEmitter()
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.pid = pid
  return child
}

function createSpawn(child) {
  return function spawnFake(command, args, options) {
    spawnFake.calls.push({ command, args, options })
    return child
  }
}

console.log('\nreviewer runner heartbeat rearm:')
{
  const clock = createFakeClock()
  const child = createFakeChild()
  const spawnFake = createSpawn(child)
  spawnFake.calls = []
  const heartbeats = []

  const runPromise = runReviewerProcess({
    command: 'echo ok',
    cwd: process.cwd(),
    env: {},
    timeoutMs: 120000,
    heartbeatMs: 30000,
    spawn: spawnFake,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    onStdout(chunk, ctx) {
      if (chunk.length > 0) ctx.markActivity()
    },
    onHeartbeat(elapsedMs) {
      heartbeats.push(elapsedMs)
    },
  })

  clock.tick(10000)
  child.stdout.emit('data', Buffer.from('visible output\n'))
  clock.tick(20000)
  assert(heartbeats.length === 0, 'no heartbeat at original t=30s after visible activity')
  clock.tick(10000)
  assert(heartbeats.length === 1, 'one heartbeat fires at t=40s')
  assert(heartbeats[0] === 40000, 'heartbeat elapsed is 40s')
  clock.tick(25000)
  child.emit('close', 0)
  await runPromise
  clock.tick(5000)
  assert(heartbeats.length === 1, 'close cancels rearmed heartbeat')
}

console.log('\nreviewer runner invisible chunks:')
{
  const clock = createFakeClock()
  const child = createFakeChild()
  const spawnFake = createSpawn(child)
  spawnFake.calls = []
  const heartbeats = []

  const runPromise = runReviewerProcess({
    command: 'echo ok',
    cwd: process.cwd(),
    env: {},
    timeoutMs: 120000,
    heartbeatMs: 30000,
    spawn: spawnFake,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    onStdout() {},
    onHeartbeat(elapsedMs) {
      heartbeats.push(elapsedMs)
    },
  })

  for (let i = 0; i < 18; i++) {
    clock.tick(5000)
    child.stdout.emit('data', Buffer.from('partial'))
  }
  assert(heartbeats.join(',') === '30000,60000,90000', 'invisible chunks do not suppress heartbeat', heartbeats.join(','))
  child.emit('close', 0)
  await runPromise
}

console.log('\nreviewer runner timeout:')
{
  const clock = createFakeClock()
  const child = createFakeChild(4321)
  const spawnFake = createSpawn(child)
  spawnFake.calls = []
  const killCalls = []
  const killProcessGroup = (pid, signal) => killCalls.push({ pid, signal })

  const runPromise = runReviewerProcess({
    command: 'sleep 30',
    cwd: process.cwd(),
    env: {},
    timeoutMs: 1000,
    heartbeatMs: 30000,
    spawn: spawnFake,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    killProcessGroup,
  })

  clock.tick(1000)
  const result = await runPromise
  assert(result.timedOut === true, 'timeout result is marked timed out')
  assert(result.exitCode === null, 'timeout exit code is null')
  assert(killCalls.length === 1, 'timeout sends SIGTERM immediately')
  assert(killCalls[0].pid === -4321, 'timeout kills process group')
  assert(killCalls[0].signal === 'SIGTERM', 'timeout uses SIGTERM first')
  clock.tick(5000)
  assert(killCalls.length === 2, 'grace timer sends SIGKILL')
  assert(killCalls[1].signal === 'SIGKILL', 'grace timer uses SIGKILL')
}

console.log('\nreviewer runner kills process group:')
{
  let stdout = ''
  const result = await runReviewerProcess({
    command: `bash -c 'sleep 30 & echo "grandchild_pid=$!"; wait'`,
    cwd: process.cwd(),
    env: process.env,
    timeoutMs: 1000,
    heartbeatMs: 30000,
    onStdout(chunk, ctx) {
      stdout += String(chunk)
      ctx.markActivity()
    },
    onStderr() {},
  })
  const grandchildPid = Number(stdout.match(/grandchild_pid=(\d+)/)?.[1])
  assert(result.timedOut === true, 'real timeout is marked timed out')
  assert(Number.isInteger(grandchildPid), 'captures grandchild pid')
  await new Promise((resolve) => setTimeout(resolve, 5400))
  let childStillExists = false
  try {
    process.kill(grandchildPid, 0)
    childStillExists = true
  } catch (error) {
    childStillExists = error.code !== 'ESRCH'
  }
  assert(childStillExists === false, 'timeout kills reviewer grandchild process')
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
