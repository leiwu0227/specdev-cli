---
name: fireperp
description: Web search via Perplexity API
type: tool
---

# Fireperp

Web search tool powered by the Perplexity Search API. Use it to research topics, look up API docs, verify facts, and check the current state of libraries or frameworks.

## Prerequisite

Set the `PERPLEXITY_API_KEY` environment variable with a valid Perplexity API key (starts with `pplx-`).

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `scripts/search.sh` | Run a web search query | During brainstorming, fact-checking, or API research |

## Usage

```bash
scripts/search.sh <query> [--max-results N] [--format text|json]
```

**Arguments:**

| Argument | Default | Description |
|----------|---------|-------------|
| `<query>` | *(required)* | Search query string |
| `--max-results N` | `10` | Number of results (1-20) |
| `--format text\|json` | `text` | Output format |

## Examples

```bash
# Basic search
scripts/search.sh "node.js fetch API timeout handling"

# Fewer results for quick lookups
scripts/search.sh "rust serde derive macro" --max-results 3

# JSON output for programmatic use
scripts/search.sh "latest React 19 features" --format json
```

## Output Formats

### text (default)

Optimized for agent reading:

```
[1] 2025-01-15 | https://example.com/article
Summary snippet from the search result...
-----

[2] N/A | https://docs.example.com/api
Another result snippet...
-----
```

### json

For programmatic use:

```json
{
  "results": [
    {
      "title": "Article Title",
      "url": "https://example.com/article",
      "snippet": "Summary text...",
      "date": "2025-01-15"
    }
  ],
  "count": 1
}
```

## When to Use

- **Brainstorming:** Research existing solutions, competing approaches, or prior art
- **API docs:** Look up current API signatures, parameters, or migration guides
- **Fact-checking:** Verify version numbers, release dates, or compatibility claims
- **Library state:** Check if a library is maintained, its latest version, or known issues
