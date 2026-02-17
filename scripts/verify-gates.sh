#!/usr/bin/env bash
#
# verify-gates.sh — Deterministic structural gate checks for SpecDev assignments
#
# Usage: scripts/verify-gates.sh <assignment-path>
#
# Runs mechanical/structural checks only (no AI reasoning).
# Exits non-zero on failure.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: verify-gates.sh <assignment-path>"
  echo "Example: verify-gates.sh .specdev/assignments/00001_feature_auth"
  exit 1
fi

ASSIGNMENT_PATH="$1"
FAILURES=0
WARNINGS=0

pass() {
  echo "  ✅ $1"
}

fail() {
  echo "  ❌ $1"
  FAILURES=$((FAILURES + 1))
}

warn() {
  echo "  ⚠️  $1"
  WARNINGS=$((WARNINGS + 1))
}

section() {
  echo ""
  echo "── $1 ──"
}

# Verify assignment directory exists
if [ ! -d "$ASSIGNMENT_PATH" ]; then
  echo "❌ Assignment directory not found: $ASSIGNMENT_PATH"
  exit 1
fi

# Detect complexity class from breakdown/plan.md
COMPLEXITY=""
if [ -f "$ASSIGNMENT_PATH/breakdown/plan.md" ]; then
  if grep -qiE '\bLOW\b' "$ASSIGNMENT_PATH/breakdown/plan.md"; then
    COMPLEXITY="LOW"
  elif grep -qiE '\bHIGH\b' "$ASSIGNMENT_PATH/breakdown/plan.md"; then
    COMPLEXITY="HIGH"
  elif grep -qiE '\bMEDIUM\b' "$ASSIGNMENT_PATH/breakdown/plan.md"; then
    COMPLEXITY="MEDIUM"
  fi
fi

# ── Gate 0: Planning ──

section "Gate 0: Planning"

if [ -f "$ASSIGNMENT_PATH/breakdown/plan.md" ]; then
  pass "breakdown/plan.md exists"
else
  fail "breakdown/plan.md missing"
fi

if [ -n "$COMPLEXITY" ]; then
  pass "Complexity class detected: $COMPLEXITY"
else
  warn "No complexity class (LOW/MEDIUM/HIGH) found in breakdown/plan.md"
fi

if [ -f "$ASSIGNMENT_PATH/skills_invoked.md" ]; then
  pass "skills_invoked.md exists"
else
  warn "skills_invoked.md missing (optional for LOW complexity)"
fi

# ── Gate 1: Post-Architecture Review (conditional) ──

section "Gate 1: Post-Architecture Review"

if [ "$COMPLEXITY" = "MEDIUM" ] || [ "$COMPLEXITY" = "HIGH" ]; then
  if [ -f "$ASSIGNMENT_PATH/scaffold/_architecture.md" ]; then
    pass "scaffold/_architecture.md exists (required for $COMPLEXITY)"
  else
    fail "scaffold/_architecture.md missing (required for $COMPLEXITY complexity)"
  fi
elif [ "$COMPLEXITY" = "LOW" ]; then
  pass "Skipped (LOW complexity)"
else
  warn "Cannot determine — complexity class not detected"
fi

# ── Gate 2: Implementation & TDD ──

section "Gate 2: Implementation & TDD"

if [ -d "$ASSIGNMENT_PATH/implementation" ]; then
  pass "implementation/ directory exists"
else
  fail "implementation/ directory missing"
fi

if [ -f "$ASSIGNMENT_PATH/implementation/progress.json" ]; then
  pass "implementation/progress.json exists"
else
  fail "implementation/progress.json missing"
fi

# Require implementation evidence:
# - V4: at least one tasks/*/result.md
# - V3 legacy: implementation.md with task table entries
HAS_V4_RESULTS=0
if [ -d "$ASSIGNMENT_PATH/tasks" ]; then
  if find "$ASSIGNMENT_PATH/tasks" -mindepth 2 -maxdepth 2 -type f -name "result.md" | grep -q .; then
    HAS_V4_RESULTS=1
  fi
fi

HAS_V3_TDD=0
if [ -f "$ASSIGNMENT_PATH/implementation.md" ]; then
  if grep -qE '^\|.*\b(T[0-9]+|task)' "$ASSIGNMENT_PATH/implementation.md" 2>/dev/null; then
    HAS_V3_TDD=1
  fi
fi

if [ "$HAS_V4_RESULTS" -eq 1 ]; then
  pass "V4 implementation evidence found (tasks/*/result.md)"
elif [ "$HAS_V3_TDD" -eq 1 ]; then
  pass "Legacy implementation.md has TDD table entries"
elif [ -f "$ASSIGNMENT_PATH/implementation.md" ]; then
  fail "Legacy implementation.md found but no TDD table entries"
else
  fail "No implementation evidence found (expected tasks/*/result.md or legacy implementation.md)"
fi

# ── Review: Spec Compliance + Code Quality ──

section "Review: Spec Compliance + Code Quality"

if [ -f "$ASSIGNMENT_PATH/review_request.json" ]; then
  pass "review_request.json exists"

  # Validate JSON structure
  if command -v node &>/dev/null; then
    VALID=$(node -e "
      try {
        const r = JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));
        const required = ['version', 'assignment_id', 'assignment_path', 'gate', 'status', 'timestamp'];
        const hasRequired = required.every((k) => Object.prototype.hasOwnProperty.call(r, k));
        const validVersion = r.version === 1;
        const validId = typeof r.assignment_id === 'string' && r.assignment_id.length > 0;
        const validGate = r.gate === 'review' || r.gate === 'gate_3' || r.gate === 'gate_4';
        const validStatus = ['pending', 'in_progress', 'awaiting_approval', 'passed', 'failed'].includes(r.status);
        const validTimestamp = typeof r.timestamp === 'string' && !Number.isNaN(Date.parse(r.timestamp));
        const ok = hasRequired && validVersion && validId && validGate && validStatus && validTimestamp;
        console.log(ok ? 'valid' : 'invalid');
      } catch(e) { console.log('invalid'); }
    " "$ASSIGNMENT_PATH/review_request.json" 2>/dev/null)
    if [ "$VALID" = "valid" ]; then
      pass "review_request.json has required fields"
    else
      fail "review_request.json missing/invalid required fields (version, assignment_id, assignment_path, gate, status, timestamp)"
    fi
  fi
else
  warn "review_request.json not yet created"
fi

if [ -f "$ASSIGNMENT_PATH/brainstorm/proposal.md" ] || [ -f "$ASSIGNMENT_PATH/brainstorm/design.md" ]; then
  pass "brainstorm artifacts exist (needed for spec comparison)"
else
  fail "brainstorm artifacts missing (needed for spec compliance review)"
fi

if [ -f "$ASSIGNMENT_PATH/breakdown/plan.md" ]; then
  pass "breakdown/plan.md exists (needed for spec comparison)"
else
  fail "breakdown/plan.md missing (needed for spec compliance review)"
fi

# ── Structural Checks ──

section "Structural Checks"

if [ -f "$ASSIGNMENT_PATH/review_report.md" ]; then
  pass "review_report.md exists"
else
  warn "review_report.md missing (review may still be in progress)"
fi

# Check for required assignment structure
for required_dir in context tasks; do
  if [ -d "$ASSIGNMENT_PATH/$required_dir" ]; then
    pass "$required_dir/ directory exists"
  else
    warn "$required_dir/ directory missing"
  fi
done

# ── Summary ──

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAILURES -eq 0 ]; then
  echo "✅ All structural checks passed ($WARNINGS warning(s))"
  exit 0
else
  echo "❌ $FAILURES check(s) failed, $WARNINGS warning(s)"
  exit 1
fi
