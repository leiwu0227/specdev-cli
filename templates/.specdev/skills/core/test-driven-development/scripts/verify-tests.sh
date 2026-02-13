#!/usr/bin/env bash
set -euo pipefail

# verify-tests.sh — Run a project's test suite and return structured JSON results
#
# Usage: verify-tests.sh <project-root> [test-command]
# Output: JSON {"passed": bool, "exit_code": N, "command": "...", "output_summary": "..."}
# Auto-detect: package.json→npm test, Cargo.toml→cargo test, pyproject.toml→pytest, Makefile→make test
# Exit: 0 always (test status in JSON), 1 only on script failure (bad args)

PROJECT_ROOT="${1:-}"
TEST_CMD="${2:-}"

if [ -z "$PROJECT_ROOT" ] || [ ! -d "$PROJECT_ROOT" ]; then
  echo "Error: project root directory required" >&2
  echo "Usage: verify-tests.sh <project-root> [test-command]" >&2
  exit 1
fi

PROJECT_ROOT=$(cd "$PROJECT_ROOT" && pwd)

# Auto-detect test command if not provided
if [ -z "$TEST_CMD" ]; then
  if [ -f "$PROJECT_ROOT/package.json" ]; then
    # Check if there's a test script defined
    HAS_TEST=$(node -e "
      const pkg = JSON.parse(require('fs').readFileSync('$PROJECT_ROOT/package.json', 'utf-8'));
      console.log(pkg.scripts && pkg.scripts.test ? 'yes' : 'no');
    " 2>/dev/null || echo "no")
    if [ "$HAS_TEST" = "yes" ]; then
      TEST_CMD="npm test"
    fi
  elif [ -f "$PROJECT_ROOT/Cargo.toml" ]; then
    TEST_CMD="cargo test"
  elif [ -f "$PROJECT_ROOT/pyproject.toml" ]; then
    TEST_CMD="pytest"
  elif [ -f "$PROJECT_ROOT/Makefile" ]; then
    if grep -q '^test:' "$PROJECT_ROOT/Makefile" 2>/dev/null; then
      TEST_CMD="make test"
    fi
  fi

  if [ -z "$TEST_CMD" ]; then
    # No test command found — report as JSON
    node -e "
      console.log(JSON.stringify({
        passed: false,
        exit_code: -1,
        command: '(none detected)',
        output_summary: 'No test command found. Checked: package.json (npm test), Cargo.toml (cargo test), pyproject.toml (pytest), Makefile (make test)'
      }, null, 2));
    "
    exit 0
  fi
fi

# Run the test command from project root and capture output
OUTPUT_FILE=$(mktemp)
EXIT_CODE=0
(cd "$PROJECT_ROOT" && $TEST_CMD) > "$OUTPUT_FILE" 2>&1 || EXIT_CODE=$?

# Read output and truncate to a summary
OUTPUT=$(cat "$OUTPUT_FILE" | tail -50)
rm -f "$OUTPUT_FILE"

# Determine pass/fail
if [ "$EXIT_CODE" -eq 0 ]; then
  PASSED="true"
else
  PASSED="false"
fi

# Output structured JSON
node -e "
  const passed = process.argv[1] === 'true';
  const exitCode = parseInt(process.argv[2], 10);
  const command = process.argv[3];
  const output = process.argv[4];
  console.log(JSON.stringify({
    passed: passed,
    exit_code: exitCode,
    command: command,
    output_summary: output.substring(0, 2000)
  }, null, 2));
" "$PASSED" "$EXIT_CODE" "$TEST_CMD" "$OUTPUT"
