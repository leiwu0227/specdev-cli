#!/usr/bin/env bash
# reviewloop.sh — deterministic review loop engine
#
# Invokes an external CLI reviewer, parses pass/fail from its output,
# and enforces round limits with escalation.
#
# Usage:
#   reviewloop.sh --reviewer <name> --round <N> [--scope diff|files|custom] [--context <text>]
#
# Environment:
#   REVIEWLOOP_REVIEWERS_DIR  Path to directory containing reviewer JSON configs.
#                           Falls back to ../reviewers relative to this script.
#
# Output (stdout): JSON object with verdict, round, max_rounds, escalate, findings
# Exit 0 on successful execution (even if verdict=fail), exit 1 on errors.
#
# Security note: reviewer commands are executed via eval. Placeholder tokens
# ({prompt}, {stdin}, {files}) are replaced with env var references rather
# than literal content to avoid injection. Only run trusted reviewer configs.

set -euo pipefail

# --- Defaults ---
REVIEWER=""
ROUND=""
SCOPE=""
CONTEXT=""

# --- Parse arguments ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --reviewer) REVIEWER="$2"; shift 2 ;;
    --round)    ROUND="$2";    shift 2 ;;
    --scope)    SCOPE="$2";    shift 2 ;;
    --context)  CONTEXT="$2";  shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# --- Validate required args ---
if [[ -z "$REVIEWER" ]]; then
  echo "Error: --reviewer is required" >&2
  exit 1
fi

if [[ -z "$ROUND" ]]; then
  echo "Error: --round is required" >&2
  exit 1
fi

if ! [[ "$ROUND" =~ ^[0-9]+$ ]] || [[ "$ROUND" -lt 1 ]]; then
  echo "Error: --round must be a positive integer" >&2
  exit 1
fi

# --- Locate reviewer config ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REVIEWERS_DIR="${REVIEWLOOP_REVIEWERS_DIR:-"${SCRIPT_DIR}/../reviewers"}"
CONFIG_FILE="${REVIEWERS_DIR}/${REVIEWER}.json"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Error: reviewer config '${REVIEWER}' not found at ${CONFIG_FILE}" >&2
  exit 1
fi

# --- Parse JSON config ---
# Use Node for robust JSON parsing (handles escaping/quotes correctly).
if ! mapfile -t __REVIEWLOOP_CFG < <(node -e '
const fs = require("node:fs")
const path = process.argv[1]
try {
  const cfg = JSON.parse(fs.readFileSync(path, "utf8"))
  console.log(cfg.command ?? "")
  console.log(cfg.scope ?? "")
  console.log(cfg.max_rounds ?? "")
  console.log(cfg.pass_pattern ?? "")
  console.log(cfg.fail_pattern ?? "")
} catch (err) {
  console.error(`Error: invalid reviewer config JSON at ${path}: ${err.message}`)
  process.exit(1)
}
' "$CONFIG_FILE"); then
  exit 1
fi

COMMAND="${__REVIEWLOOP_CFG[0]:-}"
CONFIG_SCOPE="${__REVIEWLOOP_CFG[1]:-}"
MAX_ROUNDS="${__REVIEWLOOP_CFG[2]:-}"
PASS_PATTERN="${__REVIEWLOOP_CFG[3]:-}"
FAIL_PATTERN="${__REVIEWLOOP_CFG[4]:-}"
unset __REVIEWLOOP_CFG

if [[ -z "${COMMAND//[[:space:]]/}" ]]; then
  echo "Error: reviewer config '${REVIEWER}' is missing required field 'command'" >&2
  exit 1
fi

# --- Apply defaults ---
MAX_ROUNDS="${MAX_ROUNDS:-3}"
PASS_PATTERN="${PASS_PATTERN:-LGTM|no issues|approved|PASS|pass}"
FAIL_PATTERN="${FAIL_PATTERN:-needs changes|issues found|\\bfailed\\b|\\bfail\\b|reject}"

if ! [[ "$MAX_ROUNDS" =~ ^[0-9]+$ ]] || [[ "$MAX_ROUNDS" -lt 1 ]]; then
  echo "Error: reviewer config '${REVIEWER}' has invalid max_rounds '${MAX_ROUNDS}' (must be a positive integer)" >&2
  exit 1
fi

# Scope: flag overrides config
EFFECTIVE_SCOPE="${SCOPE:-${CONFIG_SCOPE:-diff}}"

# --- Assemble context ---
REVIEW_CONTEXT=""
case "$EFFECTIVE_SCOPE" in
  diff)
    REVIEW_CONTEXT="$(git diff HEAD 2>/dev/null || true)"
    ;;
  files)
    CHANGED_FILES="$(git diff HEAD --name-only 2>/dev/null || true)"
    if [[ -n "$CHANGED_FILES" ]]; then
      while IFS= read -r f; do
        if [[ -f "$f" ]]; then
          REVIEW_CONTEXT="${REVIEW_CONTEXT}--- ${f} ---
$(cat "$f")
"
        fi
      done <<< "$CHANGED_FILES"
    fi
    ;;
  custom)
    REVIEW_CONTEXT="$CONTEXT"
    ;;
  *)
    REVIEW_CONTEXT="$(git diff HEAD 2>/dev/null || true)"
    ;;
esac

# --- Build review prompt ---
REVIEW_PROMPT="Review the following code changes (round ${ROUND} of ${MAX_ROUNDS}):

${REVIEW_CONTEXT}"

# --- Export env vars for commands that want them ---
export REVIEWLOOP_PROMPT="$REVIEW_PROMPT"
export REVIEWLOOP_CONTEXT="$REVIEW_CONTEXT"
export REVIEWLOOP_ROUND="$ROUND"
export REVIEWLOOP_MAX_ROUNDS="$MAX_ROUNDS"

# --- Write context to temp file for commands that need file input ---
TMPFILE="$(mktemp)"
trap 'rm -f "$TMPFILE"' EXIT
echo "$REVIEW_PROMPT" > "$TMPFILE"
export REVIEWLOOP_CONTEXT_FILE="$TMPFILE"

# --- Substitute placeholders in command ---
# Replace tokens with env var references so eval expands them at runtime.
# This avoids multi-line/special-char issues since only the variable name
# is injected into the command string, not the content itself.
CMD="$COMMAND"
CMD="${CMD//\{prompt\}/\$REVIEWLOOP_PROMPT}"
CMD="${CMD//\{stdin\}/\$REVIEWLOOP_CONTEXT}"
export REVIEWLOOP_FILES="$(git diff HEAD --name-only 2>/dev/null || true)"
CMD="${CMD//\{files\}/\$REVIEWLOOP_FILES}"

# --- Execute reviewer command ---
set +e
OUTPUT="$(eval "$CMD" 2>&1)"
CMD_EXIT=$?
set -e

if [[ $CMD_EXIT -ne 0 ]]; then
  echo "Error: reviewer command failed with exit code ${CMD_EXIT}" >&2
  echo "Output: ${OUTPUT}" >&2
  exit 1
fi

# --- Determine verdict ---
VERDICT=""
# Check fail pattern first (fail takes priority)
if echo "$OUTPUT" | grep -qiE "$FAIL_PATTERN"; then
  VERDICT="fail"
elif echo "$OUTPUT" | grep -qiE "$PASS_PATTERN"; then
  VERDICT="pass"
else
  # Neither pattern matched — default to fail
  VERDICT="fail"
fi

# --- Check escalation ---
ESCALATE="false"
if [[ "$VERDICT" == "fail" && "$ROUND" -ge "$MAX_ROUNDS" ]]; then
  ESCALATE="true"
fi

# --- Escape output for JSON ---
# Escape backslashes, double quotes, tabs, carriage returns, and strip control chars
FINDINGS="$(printf '%s' "$OUTPUT" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g; s/\r/\\r/g' | tr -d '\000-\010\013\014\016-\037' | tr '\n' ' ' | sed 's/ *$//')"

# --- Output JSON result ---
cat <<ENDJSON
{"verdict":"${VERDICT}","round":${ROUND},"max_rounds":${MAX_ROUNDS},"escalate":${ESCALATE},"findings":"${FINDINGS}"}
ENDJSON
