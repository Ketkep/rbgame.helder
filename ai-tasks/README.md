# ai-tasks

Task queue for Claude ↔ ChatGPT collaboration. Process: see `../AI-DELEGATION.md`. Read `LESSONS.md` first.
Files: `TASK-001.md`, `TASK-002.md`, … (none exist until a real task is worth delegating; routine use starts 2026-11-01).

## Template
```markdown
# TASK-NNN: <short title>
- **Status:** PENDING   <!-- PENDING | IN_PROGRESS | BLOCKED | REVIEW | ACCEPTED | REJECTED | CANCELLED -->
- **Priority:** low | normal | high
- **Assigned developer:** ChatGPT | Claude
- **Branch:** chatgpt/TASK-NNN

## Objective & context
## Relevant files
## Requirements & constraints
## Acceptance criteria
- [ ] …
## Dependencies
## Result / blocker   <!-- ChatGPT fills: what changed, branch/PR/patch, how verified -->
## Claude review & feedback   <!-- Claude fills: verdict + reasons -->
```
