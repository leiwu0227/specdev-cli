const TOOL_ARGS_LIMIT = 80
const TOOL_RESULT_LIMIT = 160

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function contentBlocks(event) {
  return asArray(event.message?.content)
}

function truncate(value, limit) {
  if (value.length <= limit) return value
  return `${value.slice(0, limit - 3)}...`
}

function normalizeText(text) {
  return text.endsWith('\n') ? text : `${text}\n`
}

function renderToolInput(input) {
  if (input === undefined) return ''
  return truncate(JSON.stringify(input), TOOL_ARGS_LIMIT)
}

function renderToolResult(block) {
  if (!block.is_error) return '  -> tool ok\n'
  const content = typeof block.content === 'string'
    ? block.content
    : JSON.stringify(block.content ?? '')
  return `  -> tool error: ${truncate(content, TOOL_RESULT_LIMIT)}\n`
}

function renderEvent(event, originalLine) {
  if (event.type === 'system' && event.subtype === 'init') {
    return [`> session start (model=${event.model || 'unknown'})\n`]
  }

  if (event.type === 'assistant') {
    const rendered = []
    for (const block of contentBlocks(event)) {
      if (block.type === 'text' && typeof block.text === 'string') {
        rendered.push(normalizeText(block.text))
      } else if (block.type === 'thinking') {
        rendered.push('> thinking...\n')
      } else if (block.type === 'tool_use') {
        rendered.push(`> tool: ${block.name || 'unknown'}(${renderToolInput(block.input)})\n`)
      }
    }
    return rendered
  }

  if (event.type === 'user') {
    const rendered = []
    for (const block of contentBlocks(event)) {
      if (block.type === 'tool_result') rendered.push(renderToolResult(block))
    }
    return rendered
  }

  if (event.type === 'result') {
    if (event.subtype === 'success') {
      return [`> done (${event.duration_ms ?? 0}ms, ${event.num_turns ?? 0} turns)\n`]
    }
    if (String(event.subtype || '').startsWith('error')) {
      return [`> error: ${event.subtype}\n`]
    }
  }

  return [normalizeText(originalLine)]
}

function renderLine(line) {
  try {
    return renderEvent(JSON.parse(line), line)
  } catch {
    return [normalizeText(line)]
  }
}

export function createReviewerStreamJsonTranslator({ writeRendered, writeRaw }) {
  let tail = ''

  function emitLines(lines, ctx) {
    if (lines.length === 0) return
    for (const line of lines) writeRendered(line)
    ctx.markActivity()
  }

  function consumeText(text, ctx, includeTail = false) {
    const combined = `${tail}${text}`
    const parts = combined.split('\n')
    tail = includeTail ? '' : parts.pop()
    const complete = includeTail ? parts : parts
    for (const line of complete) {
      if (line === '') continue
      emitLines(renderLine(line), ctx)
    }
  }

  return {
    onStdout(chunk, ctx) {
      writeRaw(chunk)
      consumeText(String(chunk), ctx)
    },
    flush(ctx) {
      if (!tail) return
      const buffered = tail
      tail = ''
      emitLines(renderLine(buffered), ctx)
    },
  }
}
