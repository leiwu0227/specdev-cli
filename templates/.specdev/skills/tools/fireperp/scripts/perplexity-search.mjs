#!/usr/bin/env node

// perplexity-search.mjs — Self-contained Perplexity Search API client
// No external dependencies — uses built-in fetch (Node >= 18)

const API_ENDPOINT = 'https://api.perplexity.ai/search'
const REQUEST_TIMEOUT = 30000

// --- Argument parsing ---

function parseArgs(argv) {
  const args = argv.slice(2)
  if (args.length === 0) {
    error('search query is required')
    process.exit(1)
  }

  const opts = { query: '', maxResults: 10, format: 'text' }
  const positional = []

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max-results') {
      const val = parseInt(args[++i], 10)
      if (isNaN(val) || val < 1 || val > 20) {
        error('--max-results must be a number between 1 and 20')
        process.exit(1)
      }
      opts.maxResults = val
    } else if (args[i] === '--format') {
      const val = args[++i]
      if (val !== 'text' && val !== 'json') {
        error('--format must be "text" or "json"')
        process.exit(1)
      }
      opts.format = val
    } else if (args[i].startsWith('--')) {
      error(`unknown option: ${args[i]}`)
      process.exit(1)
    } else {
      positional.push(args[i])
    }
  }

  opts.query = positional.join(' ')
  if (!opts.query) {
    error('search query is required')
    process.exit(1)
  }

  return opts
}

// --- API ---

async function search(query, maxResults, apiKey) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, max_results: maxResults }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 401) throw new Error('Invalid API key (401)')
      if (response.status === 429) throw new Error('Rate limit exceeded (429). Try again later.')
      if (response.status >= 500) throw new Error(`Perplexity API server error (${response.status})`)
      throw new Error(`API request failed with status ${response.status}`)
    }

    const data = await response.json()

    if (!data || !Array.isArray(data.results)) {
      throw new Error('Unexpected API response structure')
    }

    return data.results
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      throw new Error('Request timed out after 30 seconds')
    }
    throw err
  }
}

// --- Formatting ---

function formatText(results) {
  const lines = []
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const date = r.date || 'N/A'
    const url = r.url || 'N/A'
    const snippet = r.snippet || ''
    lines.push(`[${i + 1}] ${date} | ${url}`)
    lines.push(snippet)
    lines.push('-----')
    lines.push('')
  }
  return lines.join('\n')
}

function formatJSON(results) {
  return JSON.stringify({ results, count: results.length }, null, 2)
}

// --- Helpers ---

function error(msg) {
  process.stderr.write(`Error: ${msg}\n`)
}

// --- Main ---

async function main() {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) {
    error('PERPLEXITY_API_KEY environment variable is not set')
    process.exit(1)
  }

  const opts = parseArgs(process.argv)

  try {
    const results = await search(opts.query, opts.maxResults, apiKey)

    if (results.length === 0) {
      console.log('No results found')
      return
    }

    if (opts.format === 'json') {
      console.log(formatJSON(results))
    } else {
      console.log(formatText(results))
    }
  } catch (err) {
    error(err.message)
    process.exit(1)
  }
}

main()
