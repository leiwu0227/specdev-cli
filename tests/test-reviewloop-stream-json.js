import { createReviewerStreamJsonTranslator } from '../src/utils/reviewer-stream-json.js'

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

function createTranslator() {
  const rendered = []
  const raw = []
  let activityCount = 0
  const translator = createReviewerStreamJsonTranslator({
    writeRendered: (line) => rendered.push(line),
    writeRaw: (chunk) => raw.push(String(chunk)),
  })
  const ctx = {
    markActivity() {
      activityCount++
    },
  }
  return {
    translator,
    rendered,
    raw,
    ctx,
    activityCount: () => activityCount,
  }
}

function line(value) {
  return `${JSON.stringify(value)}\n`
}

console.log('\nstream-json rendering:')
{
  const t = createTranslator()
  t.translator.onStdout(Buffer.from([
    line({ type: 'system', subtype: 'init', model: 'claude-opus' }),
    line({ type: 'assistant', message: { content: [{ type: 'text', text: 'Review text\n' }] } }),
    line({ type: 'assistant', message: { content: [{ type: 'thinking', thinking: 'hidden reasoning' }] } }),
    line({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: '/tmp/example.js', limit: 10 } }] } }),
    line({ type: 'user', message: { content: [{ type: 'tool_result', is_error: false, content: 'ok' }] } }),
    line({ type: 'user', message: { content: [{ type: 'tool_result', is_error: true, content: 'permission denied' }] } }),
    line({ type: 'result', subtype: 'success', duration_ms: 1234, num_turns: 3 }),
    line({ type: 'result', subtype: 'error_max_turns' }),
  ].join('')), t.ctx)

  assert(t.rendered.includes('> session start (model=claude-opus)\n'), 'renders system init')
  assert(t.rendered.includes('Review text\n'), 'renders assistant text verbatim')
  assert(t.rendered.includes('> thinking...\n'), 'collapses thinking content')
  assert(t.rendered.some((value) => value.startsWith('> tool: Read(')), 'renders tool use')
  assert(t.rendered.includes('  -> tool ok\n'), 'renders successful tool result')
  assert(t.rendered.includes('  -> tool error: permission denied\n'), 'renders error tool result')
  assert(t.rendered.includes('> done (1234ms, 3 turns)\n'), 'renders success result')
  assert(t.rendered.includes('> error: error_max_turns\n'), 'renders error result')
  assert(t.activityCount() === 8, 'marks activity once per rendered event')
  assert(t.raw.join('').includes('"type":"system"'), 'writes raw chunks to sidecar sink')
}

console.log('\nstream-json pass-through and buffering:')
{
  const t = createTranslator()
  t.translator.onStdout(Buffer.from('plain line\n'), t.ctx)
  t.translator.onStdout(Buffer.from('{not json}\n'), t.ctx)
  const full = line({ type: 'assistant', message: { content: [{ type: 'text', text: 'split text' }] } })
  const first = full.slice(0, 20)
  const second = full.slice(20)
  t.translator.onStdout(Buffer.from(first), t.ctx)
  assert(t.rendered.length === 2, 'partial JSON line does not render')
  assert(t.activityCount() === 2, 'partial JSON line does not mark activity')
  t.translator.onStdout(Buffer.from(second), t.ctx)
  assert(t.rendered.includes('split text\n'), 'split JSON line renders after completion')
  assert(t.activityCount() === 3, 'completed split line marks activity once')
  assert(t.raw.join('') === `plain line\n{not json}\n${full}`, 'raw chunks are preserved verbatim')
}

console.log('\nstream-json flush:')
{
  const t = createTranslator()
  t.translator.onStdout(Buffer.from('tail without newline'), t.ctx)
  assert(t.rendered.length === 0, 'tail without newline is buffered')
  t.translator.flush(t.ctx)
  assert(t.rendered.includes('tail without newline\n'), 'flush renders buffered tail')
  assert(t.activityCount() === 1, 'flush marks activity for rendered tail')
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
