#!/usr/bin/env bash
set -euo pipefail

# search.sh — Web search via Perplexity API
#
# Usage: search.sh <query> [--max-results N] [--format text|json]
# Output: Search results to stdout
# Exit: 0 on success, 1 on error

QUERY="${1:-}"

if [ -z "$QUERY" ]; then
  echo "Error: search query is required" >&2
  echo "Usage: search.sh <query> [--max-results N] [--format text|json]" >&2
  exit 1
fi

if [ -z "${PERPLEXITY_API_KEY:-}" ]; then
  echo "Error: PERPLEXITY_API_KEY environment variable is not set" >&2
  echo "Get an API key at https://www.perplexity.ai/settings/api" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/perplexity-search.mjs" "$@"
