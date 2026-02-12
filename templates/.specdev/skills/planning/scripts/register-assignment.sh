#!/usr/bin/env bash
set -euo pipefail

# register-assignment.sh — Create a new assignment entry linked to a plan
#
# Usage: register-assignment.sh <plan-file> <project-root> <type> <label>
#   type: feature, bugfix, refactor
#   label: kebab-case name (e.g., add-auth, fix-login)
#
# Output: Assignment directory path to stdout
# Exit: 0 on success, 1 on error

PLAN_FILE="${1:-}"
PROJECT_ROOT="${2:-}"
TYPE="${3:-}"
LABEL="${4:-}"

if [ -z "$PLAN_FILE" ] || [ -z "$PROJECT_ROOT" ] || [ -z "$TYPE" ] || [ -z "$LABEL" ]; then
  echo "Error: all arguments required" >&2
  echo "Usage: register-assignment.sh <plan-file> <project-root> <type> <label>" >&2
  exit 1
fi

if [ ! -f "$PLAN_FILE" ]; then
  echo "Error: plan file not found: $PLAN_FILE" >&2
  exit 1
fi

PROJECT_ROOT=$(cd "$PROJECT_ROOT" && pwd)

# Determine assignments directory (v2 state/ or v1 flat)
ASSIGNMENTS_DIR="$PROJECT_ROOT/.specdev/state/assignments"
if [ ! -d "$ASSIGNMENTS_DIR" ]; then
  ASSIGNMENTS_DIR="$PROJECT_ROOT/.specdev/assignments"
fi
mkdir -p "$ASSIGNMENTS_DIR"

# Find next ID
NEXT_ID=1
EXISTING=$(find "$ASSIGNMENTS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort | tail -1)
if [ -n "$EXISTING" ]; then
  LAST_NAME=$(basename "$EXISTING")
  LAST_ID=$(echo "$LAST_NAME" | grep -o '^[0-9]*' || echo "0")
  NEXT_ID=$((LAST_ID + 1))
fi

# Format ID with zero-padding
PADDED_ID=$(printf "%05d" "$NEXT_ID")

# Create assignment directory
ASSIGNMENT_NAME="${PADDED_ID}_${TYPE}_${LABEL}"
ASSIGNMENT_DIR="$ASSIGNMENTS_DIR/$ASSIGNMENT_NAME"

mkdir -p "$ASSIGNMENT_DIR"
mkdir -p "$ASSIGNMENT_DIR/context"
mkdir -p "$ASSIGNMENT_DIR/context/messages"
mkdir -p "$ASSIGNMENT_DIR/tasks"
mkdir -p "$ASSIGNMENT_DIR/scaffold"

# Create proposal.md
cat > "$ASSIGNMENT_DIR/proposal.md" << EOF
# ${LABEL}

**Type:** ${TYPE}
**Created:** $(date -Iseconds)
**Plan:** $(basename "$PLAN_FILE")

## Scope

See linked plan for full details.
EOF

# Link plan: copy content with reference to source
{
  echo "<!-- Source: $PLAN_FILE -->"
  cat "$PLAN_FILE"
} > "$ASSIGNMENT_DIR/plan.md"

# Create empty tracking files
touch "$ASSIGNMENT_DIR/context/.gitkeep"
touch "$ASSIGNMENT_DIR/context/messages/.gitkeep"
touch "$ASSIGNMENT_DIR/tasks/.gitkeep"

echo "$ASSIGNMENT_DIR"
