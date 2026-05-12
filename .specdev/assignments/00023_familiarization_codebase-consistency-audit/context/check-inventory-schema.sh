#!/usr/bin/env bash
set -e
DIR="$(dirname "$0")"
fail=0
for f in "$DIR"/inventory-*.md; do
  [ -f "$f" ] || { echo "MISSING: $f"; fail=1; continue; }
  required=("## Files" "## References" "## Within-area findings")
  case "$(basename "$f")" in
    inventory-source.md) ;;
    *) required+=("## Claims & instructions") ;;
  esac
  for s in "${required[@]}"; do
    grep -Fq "$s" "$f" || { echo "FAIL: $f missing section: $s"; fail=1; }
  done
done
[ $fail -eq 0 ] && echo "ALL INVENTORIES CONFORM"
exit $fail
