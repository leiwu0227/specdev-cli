#!/usr/bin/env bash
set -euo pipefail

# complete-task.sh — Mark a task completed and report batch status
#
# Usage:
#   complete-task.sh <plan-file> <task-number> [summary]
#
# Output: Task status and batch progress to stdout
# Exit: 0 on success, 1 on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PLAN_FILE="${1:-}"
TASK_NUM="${2:-}"
SUMMARY="${3:-}"

if [ -z "$PLAN_FILE" ] || [ -z "$TASK_NUM" ]; then
  echo "Error: plan file and task number required" >&2
  echo "Usage: complete-task.sh <plan-file> <task-number> [summary]" >&2
  exit 1
fi

if [ ! -f "$PLAN_FILE" ]; then
  echo "Error: plan file not found: $PLAN_FILE" >&2
  exit 1
fi

ASSIGNMENT_DIR="$(cd "$(dirname "$PLAN_FILE")/.." && pwd)"
PROGRESS_FILE="${ASSIGNMENT_DIR}/implementation/progress.json"

# Mark the task as completed via track-progress.sh
"${SCRIPT_DIR}/track-progress.sh" "$PLAN_FILE" "$TASK_NUM" completed > /dev/null

# Store summary (if provided) and calculate batch status
node -e "
  const fs = require('fs');
  const taskNum = parseInt(process.argv[1], 10);
  const summary = process.argv[2] || '';
  const progressFile = process.argv[3];

  const data = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));

  // Store summary if provided
  const task = data.tasks.find(t => t.number === taskNum);
  if (task && summary) {
    task.summary = summary;
    fs.writeFileSync(progressFile, JSON.stringify(data, null, 2));
  }

  // Calculate batch info
  const batchNumber = Math.ceil(taskNum / 3);
  const batchStart = (batchNumber - 1) * 3 + 1;
  const batchEnd = Math.min(batchNumber * 3, data.total_tasks);

  const batchTasks = data.tasks.filter(t => t.number >= batchStart && t.number <= batchEnd);
  const batchCompleted = batchTasks.filter(t => t.status === 'completed').length;
  const batchTotal = batchTasks.length;

  // Output status
  console.log('Task ' + taskNum + ': completed');
  if (summary) {
    console.log('Summary: ' + summary);
  }
  if (batchCompleted === batchTotal) {
    console.log('Batch ' + batchNumber + ': ' + batchCompleted + '/' + batchTotal + ' complete — run test suite before next batch');
  } else {
    console.log('Batch ' + batchNumber + ': ' + batchCompleted + '/' + batchTotal + ' complete — continue to next task');
  }
" "$TASK_NUM" "$SUMMARY" "$PROGRESS_FILE"
