---
name: gate-coordination
description: Script-driven gate review protocol for multi-agent handoff
---

# Gate Coordination

## Contract

- **Input:** An implementation ready for gate review
- **Process:** Request review → poll status → handle result
- **Output:** Review status (passed or failed with feedback)
- **Next skill:** code-review or verification (if passed), fix issues (if failed)

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `scripts/request-review.sh` | Write a review_request.json to trigger a review | When implementation is ready for review |
| `scripts/poll-review.sh` | Check the current review status | After requesting, to check progress |

## Process

### Phase 1: Pre-flight

Before requesting a review, confirm:

1. All tests pass (run verify-tests.sh)
2. Implementation matches the plan (run spec review mentally or via script)
3. Code is committed and pushed to the branch
4. You know which gate you're requesting: gate_3 (implementation review) or gate_4 (final review)

### Phase 2: Request

1. Run `scripts/request-review.sh <assignment-path> <gate> [notes]`
2. The script creates `review_request.json` in the assignment directory
3. The file contains: version, assignment_id, gate, status=pending, timestamp, head_commit, changed_files
4. Confirm the file was created at the output path

### Phase 3: Wait

1. Run `scripts/poll-review.sh <assignment-path>` to check status
2. Status lifecycle: pending → in_progress → passed/failed
3. If pending or in_progress — wait and poll again
4. If passed — proceed to next skill
5. If failed — read the review feedback and fix issues

### Phase 4: Handle Result

**If passed:**
- Proceed to the next gate or to verification
- The review_request.json serves as evidence for the verification skill

**If failed:**
- Read the review feedback (in review_request.json or associated review file)
- Fix the issues identified
- Run tests again
- Request a new review (the old request will be overwritten)

## File Protocol

The `review_request.json` file has this lifecycle:

```
pending → in_progress → passed
                      → failed → (fix) → pending (new request)
```

Fields:
- `version`: Schema version (currently "1")
- `assignment_id`: Name of the assignment directory
- `gate`: Which gate ("gate_3" or "gate_4")
- `status`: Current status
- `requested_at`: ISO timestamp
- `head_commit`: Git HEAD at time of request
- `changed_files`: List of files changed in the implementation

## Red Flags

- Requesting review before tests pass — always verify tests first
- Not polling after requesting — the review won't start itself
- Ignoring failed review feedback — every finding must be addressed
- Requesting gate_4 before gate_3 passes — gates are sequential

## Integration

- **Before this skill:** executing or subagent-dispatch (produces the work to review)
- **After this skill:** code-review (handles the actual review), verification (final checks)
- **Protocol:** This skill handles the coordination; code-review handles the content
