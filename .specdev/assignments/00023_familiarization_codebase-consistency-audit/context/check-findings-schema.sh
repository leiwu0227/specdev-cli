#!/usr/bin/env bash
set -e
F=".specdev/assignments/00023_familiarization_codebase-consistency-audit/findings.md"
[ -f "$F" ] || { echo "MISSING: $F"; exit 1; }
fail=0
required=(
  "# Findings"
  "## Executive Summary"
  "## Root Docs and Misc"
  "## Source Code"
  "## Templates and Workflow Content"
  "## Tests"
  "## .specdev State"
)
for s in "${required[@]}"; do
  grep -Fq "$s" "$F" || { echo "FAIL: missing section: $s"; fail=1; }
done
if ! grep -Eq '\b(legacy|contradiction|inconsistency|duplication|drift)\b' "$F"; then
  echo "FAIL: no finding type tags present"
  fail=1
fi
if ! grep -Eq '\b(high|med|low)\b' "$F"; then
  echo "FAIL: no severity tags present"
  fail=1
fi
[ $fail -eq 0 ] && echo "FINDINGS CONFORMS"
exit $fail
