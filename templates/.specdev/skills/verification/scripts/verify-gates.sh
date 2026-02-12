#!/usr/bin/env bash
set -euo pipefail

# verify-gates.sh — Run gate checks for an assignment
#
# Usage: verify-gates.sh <assignment-path> <project-root>
# Output: JSON {"assignment": "...", "gates": {"gate_0": {"passed": bool, "checks": [...]}, ...}, "all_passed": bool}
# Checks: gate_0=proposal+plan exist, gate_1=scaffold if needed, gate_2=tests pass, gate_3=review passed, gate_4=final review
# Exit: 0 if all pass, 1 if any fail

ASSIGNMENT_PATH="${1:-}"
PROJECT_ROOT="${2:-}"

if [ -z "$ASSIGNMENT_PATH" ] || [ ! -d "$ASSIGNMENT_PATH" ]; then
  echo "Error: assignment directory required" >&2
  echo "Usage: verify-gates.sh <assignment-path> <project-root>" >&2
  exit 1
fi

if [ -z "$PROJECT_ROOT" ] || [ ! -d "$PROJECT_ROOT" ]; then
  echo "Error: project root directory required" >&2
  echo "Usage: verify-gates.sh <assignment-path> <project-root>" >&2
  exit 1
fi

ASSIGNMENT_PATH=$(cd "$ASSIGNMENT_PATH" && pwd)
PROJECT_ROOT=$(cd "$PROJECT_ROOT" && pwd)
ASSIGNMENT_NAME=$(basename "$ASSIGNMENT_PATH")

# Gate 0: proposal + plan exist
GATE_0_CHECKS=""
GATE_0_PASSED=true

if [ -f "$ASSIGNMENT_PATH/proposal.md" ]; then
  GATE_0_CHECKS="${GATE_0_CHECKS}\"proposal.md exists\","
else
  GATE_0_CHECKS="${GATE_0_CHECKS}\"MISSING: proposal.md\","
  GATE_0_PASSED=false
fi

if [ -f "$ASSIGNMENT_PATH/plan.md" ]; then
  GATE_0_CHECKS="${GATE_0_CHECKS}\"plan.md exists\","
  # Check plan has tasks
  TASK_COUNT=$(grep -c '^### Task [0-9]' "$ASSIGNMENT_PATH/plan.md" || true)
  if [ "$TASK_COUNT" -gt 0 ]; then
    GATE_0_CHECKS="${GATE_0_CHECKS}\"plan has $TASK_COUNT task(s)\","
  else
    GATE_0_CHECKS="${GATE_0_CHECKS}\"WARNING: plan has no tasks\","
  fi
else
  GATE_0_CHECKS="${GATE_0_CHECKS}\"MISSING: plan.md\","
  GATE_0_PASSED=false
fi

# Gate 1: scaffold (check if scaffold/ dir exists and has content)
GATE_1_CHECKS=""
GATE_1_PASSED=true

if [ -d "$ASSIGNMENT_PATH/scaffold" ]; then
  SCAFFOLD_COUNT=$(find "$ASSIGNMENT_PATH/scaffold" -type f -not -name '.gitkeep' 2>/dev/null | wc -l)
  if [ "$SCAFFOLD_COUNT" -gt 0 ]; then
    GATE_1_CHECKS="${GATE_1_CHECKS}\"scaffold/ has $SCAFFOLD_COUNT file(s)\","
  else
    GATE_1_CHECKS="${GATE_1_CHECKS}\"scaffold/ exists but empty (may be OK)\","
  fi
else
  GATE_1_CHECKS="${GATE_1_CHECKS}\"no scaffold/ directory (not required)\","
fi

# Gate 2: tests pass
GATE_2_CHECKS=""
GATE_2_PASSED=true

# Try to find and run verify-tests.sh
VERIFY_TESTS=""
SKILL_ROOT=$(dirname "$(dirname "$0")")
TDD_VERIFY="$SKILL_ROOT/test-driven-development/scripts/verify-tests.sh"

if [ -f "$TDD_VERIFY" ]; then
  VERIFY_TESTS="$TDD_VERIFY"
fi

if [ -n "$VERIFY_TESTS" ]; then
  TEST_OUTPUT=$(bash "$VERIFY_TESTS" "$PROJECT_ROOT" 2>/dev/null || true)
  TEST_PASSED=$(echo "$TEST_OUTPUT" | node -e "
    let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
      try{const j=JSON.parse(d);console.log(j.passed?'true':'false')}
      catch(e){console.log('unknown')}
    });
  " 2>/dev/null || echo "unknown")

  if [ "$TEST_PASSED" = "true" ]; then
    GATE_2_CHECKS="${GATE_2_CHECKS}\"tests pass\","
  elif [ "$TEST_PASSED" = "false" ]; then
    GATE_2_CHECKS="${GATE_2_CHECKS}\"tests FAIL\","
    GATE_2_PASSED=false
  else
    GATE_2_CHECKS="${GATE_2_CHECKS}\"could not determine test status\","
  fi
else
  GATE_2_CHECKS="${GATE_2_CHECKS}\"verify-tests.sh not found — manual check needed\","
fi

# Gate 3: review passed
GATE_3_CHECKS=""
GATE_3_PASSED=true

if [ -f "$ASSIGNMENT_PATH/review_request.json" ]; then
  REVIEW_STATUS=$(grep -o '"status":\s*"[^"]*"' "$ASSIGNMENT_PATH/review_request.json" | head -1 | sed 's/"status":\s*"//;s/"//')
  if [ "$REVIEW_STATUS" = "passed" ]; then
    GATE_3_CHECKS="${GATE_3_CHECKS}\"review status: passed\","
  else
    GATE_3_CHECKS="${GATE_3_CHECKS}\"review status: $REVIEW_STATUS\","
    GATE_3_PASSED=false
  fi
else
  GATE_3_CHECKS="${GATE_3_CHECKS}\"no review_request.json — review not requested\","
  GATE_3_PASSED=false
fi

# Gate 4: final review
GATE_4_CHECKS=""
GATE_4_PASSED=true

if [ -f "$ASSIGNMENT_PATH/review_request.json" ]; then
  REVIEW_GATE=$(grep -o '"gate":\s*"[^"]*"' "$ASSIGNMENT_PATH/review_request.json" | head -1 | sed 's/"gate":\s*"//;s/"//')
  REVIEW_STATUS=$(grep -o '"status":\s*"[^"]*"' "$ASSIGNMENT_PATH/review_request.json" | head -1 | sed 's/"status":\s*"//;s/"//')
  if [ "$REVIEW_GATE" = "gate_4" ] && [ "$REVIEW_STATUS" = "passed" ]; then
    GATE_4_CHECKS="${GATE_4_CHECKS}\"final review: passed\","
  else
    GATE_4_CHECKS="${GATE_4_CHECKS}\"final review not completed (gate=$REVIEW_GATE, status=$REVIEW_STATUS)\","
    GATE_4_PASSED=false
  fi
else
  GATE_4_CHECKS="${GATE_4_CHECKS}\"no final review found\","
  GATE_4_PASSED=false
fi

# Determine overall pass
ALL_PASSED=true
if [ "$GATE_0_PASSED" != "true" ] || [ "$GATE_2_PASSED" != "true" ] || [ "$GATE_3_PASSED" != "true" ] || [ "$GATE_4_PASSED" != "true" ]; then
  ALL_PASSED=false
fi

# Strip trailing commas from check arrays
GATE_0_CHECKS=$(echo "$GATE_0_CHECKS" | sed 's/,$//')
GATE_1_CHECKS=$(echo "$GATE_1_CHECKS" | sed 's/,$//')
GATE_2_CHECKS=$(echo "$GATE_2_CHECKS" | sed 's/,$//')
GATE_3_CHECKS=$(echo "$GATE_3_CHECKS" | sed 's/,$//')
GATE_4_CHECKS=$(echo "$GATE_4_CHECKS" | sed 's/,$//')

# Output JSON
node -e "
  const data = {
    assignment: process.argv[1],
    gates: {
      gate_0: { passed: process.argv[2] === 'true', checks: JSON.parse('[' + process.argv[3] + ']') },
      gate_1: { passed: process.argv[4] === 'true', checks: JSON.parse('[' + process.argv[5] + ']') },
      gate_2: { passed: process.argv[6] === 'true', checks: JSON.parse('[' + process.argv[7] + ']') },
      gate_3: { passed: process.argv[8] === 'true', checks: JSON.parse('[' + process.argv[9] + ']') },
      gate_4: { passed: process.argv[10] === 'true', checks: JSON.parse('[' + process.argv[11] + ']') }
    },
    all_passed: process.argv[12] === 'true'
  };
  console.log(JSON.stringify(data, null, 2));
" "$ASSIGNMENT_NAME" \
  "$GATE_0_PASSED" "$GATE_0_CHECKS" \
  "$GATE_1_PASSED" "$GATE_1_CHECKS" \
  "$GATE_2_PASSED" "$GATE_2_CHECKS" \
  "$GATE_3_PASSED" "$GATE_3_CHECKS" \
  "$GATE_4_PASSED" "$GATE_4_CHECKS" \
  "$ALL_PASSED"

# Exit based on overall result
if [ "$ALL_PASSED" = "true" ]; then
  exit 0
else
  exit 1
fi
