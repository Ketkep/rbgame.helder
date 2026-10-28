# AI Delegation — Claude (Lead) + ChatGPT (Supporting)

Shared operating manual for "Trust Me…". Read this before touching `ai-tasks/`.

## Roles
| Who | Role | Owns |
|---|---|---|
| Human | Product Owner | Priorities, final decisions, runs/configures the ChatGPT schedule |
| Claude | Lead Developer | Architecture, major features, complex debugging, security, integrations, **final review of everything** |
| ChatGPT | Supporting Developer (from **2026-11-01**) | Small, independent, well-specified tasks |

**Delegate to ChatGPT:** UI/CSS polish, isolated bug fixes, utilities, tests, docs, accessibility, small refactors, narrow investigations.
**Keep with Claude:** netcode (`src/net/`), co-op layer, horror renderer/stalker, level architecture, anything touching many files.
Delegate only when it saves effort overall (writing a precise task costs tokens). No artificial tasks.

## Status: routine delegation is INACTIVE before 2026-11-01
Do not queue routine tasks earlier unless the human asks.

## Task files (`ai-tasks/TASK-NNN.md`)
Copy the template in `ai-tasks/README.md`. One file per task, unique incrementing ID.
Statuses: `PENDING` (new) · `IN_PROGRESS` · `BLOCKED` · `REVIEW` (ChatGPT finished) · `ACCEPTED` (only Claude sets, after verifying) · `REJECTED` · `CANCELLED`.

## Workflow
1. Claude writes a task with exact acceptance criteria, relevant files, constraints; status `PENDING`; briefly tells the human it is queued.
2. ChatGPT checks daily at **00:00 and 15:00 Europe/Amsterdam** from 2026-11-01 (human configures this; never assume a check happened without evidence such as a commit/branch/response). Takes a PENDING task → `IN_PROGRESS`.
3. ChatGPT works on its **own branch** (`chatgpt/TASK-NNN`) and never edits files Claude is changing at the same time. Done → fill "Result", set `REVIEW`.
4. Claude keeps working between checks; it does not wait on ChatGPT.
5. If ChatGPT cannot write to GitHub / run tests / open PRs, fall back to: a proposed patch in the task file's Result section, or a human-assisted apply. Do not assume capabilities.

## Claude's review procedure
Status `REVIEW` is never acceptance. Claude must: inspect the real diff → check each acceptance criterion → run relevant tests (`npm test`, `npm run check`, `npm run build`, `node tools/test-game.mjs`, `node tools/test-coop.mjs` as relevant) → check it fits the architecture → then ACCEPT (merge), REJECT, or request corrections. Record feedback in the task file and add any reusable lesson to `ai-tasks/LESSONS.md`.

## BLOCKED handling
Claude reads the blocker, then: supplies context, clarifies, decides, asks the human, or takes the task over (noting why in the file).

## Token efficiency
Short tasks, link files instead of pasting them, one concern per task, no re-explaining project context that is in `CLAUDE.md`/`docs/`.

## Learning
`ai-tasks/LESSONS.md` is read before writing any task. Add a lesson whenever a task was rejected, blocked, or surprised us. Keep it concise and project-specific.
