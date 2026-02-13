#!/usr/bin/env bash
set -euo pipefail

# list-skills.sh — List all available skills with their contracts
#
# Usage: list-skills.sh <specdev-path>
# Output: Markdown summary of all skills to stdout
# Exit: 0 on success, 1 on error

SPECDEV_PATH="${1:-}"

if [ -z "$SPECDEV_PATH" ] || [ ! -d "$SPECDEV_PATH" ]; then
  echo "Error: .specdev path required" >&2
  echo "Usage: list-skills.sh <specdev-path>" >&2
  exit 1
fi

SKILLS_DIR="$SPECDEV_PATH/skills"

if [ ! -d "$SKILLS_DIR" ]; then
  echo "Error: no skills directory found at $SKILLS_DIR" >&2
  exit 1
fi

echo "# Available Skills"
echo ""

# Scan a category directory for skills
scan_category() {
  local CATEGORY_DIR="$1"
  local CATEGORY_LABEL="$2"

  [ -d "$CATEGORY_DIR" ] || return 0

  # Folder-based skills
  for dir in "$CATEGORY_DIR"/*/; do
    [ -d "$dir" ] || continue
    SKILL_FILE="$dir/SKILL.md"
    [ -f "$SKILL_FILE" ] || continue

    NAME=$(basename "$dir")
    DESC=$(grep '^description:' "$SKILL_FILE" | head -1 | sed 's/description:\s*//' || true)
    HAS_SCRIPTS="no"
    [ -d "$dir/scripts" ] && HAS_SCRIPTS="yes"

    echo "## $NAME [$CATEGORY_LABEL] [folder] [scripts: $HAS_SCRIPTS]"
    [ -n "$DESC" ] && echo "$DESC"
    echo ""

    # Extract contract if present
    CONTRACT=$(sed -n '/^## Contract/,/^## /p' "$SKILL_FILE" | head -n -1 || true)
    if [ -n "$CONTRACT" ]; then
      echo "$CONTRACT"
      echo ""
    fi
  done

  # Flat .md skills
  for file in "$CATEGORY_DIR"/*.md; do
    [ -f "$file" ] || continue
    BASENAME=$(basename "$file")
    [ "$BASENAME" = "README.md" ] && continue
    [ "$BASENAME" = "skills_invoked_template.md" ] && continue

    NAME="${BASENAME%.md}"
    FIRST_LINE=$(grep -v '^#\|^$\|^---' "$file" | head -1 | sed 's/^\*\*[^*]*\*\*\s*//' || true)

    echo "## $NAME [$CATEGORY_LABEL] [flat]"
    [ -n "$FIRST_LINE" ] && echo "$FIRST_LINE"
    echo ""
  done
}

scan_category "$SKILLS_DIR/core" "core"
scan_category "$SKILLS_DIR/tools" "tool"
