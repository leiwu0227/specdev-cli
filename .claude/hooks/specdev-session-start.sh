#!/usr/bin/env bash
set -euo pipefail

# SessionStart hook for specdev
# Injects phase-aware context into Claude Code sessions

SPECDEV_DIR=".specdev"

# No-op if .specdev doesn't exist
if [ ! -d "$SPECDEV_DIR" ]; then
  echo '{}'
  exit 0
fi

# Find latest assignment
ASSIGNMENTS_DIR="$SPECDEV_DIR/assignments"
if [ ! -d "$ASSIGNMENTS_DIR" ]; then
  # No assignments yet — just inject basic awareness
  CONTEXT="You have specdev installed. Read .specdev/_main.md for the full workflow.\n\nAnnounce every subtask with \"Specdev: <action>\"."
  ESCAPED=$(printf '%s' "$CONTEXT" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' ')
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "$ESCAPED"
  }
}
EOF
  exit 0
fi

# Find latest (highest numbered) assignment
LATEST=$(ls -1d "$ASSIGNMENTS_DIR"/*/ 2>/dev/null | sort | tail -1 || true)
if [ -z "$LATEST" ]; then
  # No assignment subdirectories — same as no assignments
  CONTEXT="You have specdev installed. Read .specdev/_main.md for the full workflow.\n\nAnnounce every subtask with \"Specdev: <action>\"."
  ESCAPED=$(printf '%s' "$CONTEXT" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' ')
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "$ESCAPED"
  }
}
EOF
  exit 0
fi

ASSIGNMENT_NAME=$(basename "$LATEST")

# Detect phase from artifacts
PHASE="no assignment"
if [ -d "$LATEST/implementation" ]; then
  PHASE="implementation"
elif [ -f "$LATEST/breakdown/plan.md" ]; then
  PHASE="breakdown"
elif [ -f "$LATEST/brainstorm/design.md" ] || [ -f "$LATEST/brainstorm/proposal.md" ]; then
  PHASE="brainstorm"
else
  PHASE="new (no artifacts yet)"
fi

# Discover tool skills
TOOLS_DIR="$SPECDEV_DIR/skills/tools"
TOOL_SKILLS=""
if [ -d "$TOOLS_DIR" ]; then
  for skill_dir in "$TOOLS_DIR"/*/; do
    [ -d "$skill_dir" ] || continue
    skill_md="$skill_dir/SKILL.md"
    [ -f "$skill_md" ] || continue
    skill_name=$(basename "$skill_dir")
    # Extract description from frontmatter
    skill_desc=$(sed -n '/^---$/,/^---$/{ /^description:/{ s/^description:[[:space:]]*//; p; } }' "$skill_md")
    if [ -n "$skill_desc" ]; then
      TOOL_SKILLS="${TOOL_SKILLS}${TOOL_SKILLS:+, }${skill_name} (${skill_desc})"
    else
      TOOL_SKILLS="${TOOL_SKILLS}${TOOL_SKILLS:+, }${skill_name}"
    fi
  done
fi

# Build context message
CONTEXT="SpecDev active. Assignment: $ASSIGNMENT_NAME | Phase: $PHASE\n\n"

case "$PHASE" in
  brainstorm)
    CONTEXT="${CONTEXT}Rules:\n- Interactive Q&A to validate the design\n- Produce proposal.md and design.md\n- Do not start coding until design is approved\n\nNext: Complete design, run specdev checkpoint brainstorm, get user approval via specdev approve brainstorm"
    ;;
  breakdown)
    CONTEXT="${CONTEXT}Rules:\n- Break design into executable tasks in breakdown/plan.md\n- Each task: 2-5 min, TDD, exact file paths and code\n- Include acceptance criteria for every task\n\nNext: Complete plan.md, inline review, then implementation starts automatically"
    ;;
  implementation)
    CONTEXT="${CONTEXT}Rules:\n- TDD: write failing test -> make it pass -> refactor\n- No completion claims without running tests\n- One task at a time via subagents\n- Per-task review: spec compliance then code quality\n\nNext: Complete remaining tasks, get user approval"
    ;;
  *)
    CONTEXT="${CONTEXT}Run specdev assignment <name> to start a new assignment."
    ;;
esac

if [ -n "$TOOL_SKILLS" ]; then
  CONTEXT="${CONTEXT}\n\nTool skills available: ${TOOL_SKILLS}. Declare in plan tasks via Skills: field."
fi

CONTEXT="${CONTEXT}\n\nAnnounce every subtask with \"Specdev: <action>\"."

# Escape for JSON
escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

ESCAPED=$(escape_for_json "$CONTEXT")

cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "$ESCAPED"
  }
}
EOF

exit 0
