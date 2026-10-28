# Issues (project management)

Linear-style issue tracking per project. The user writes issues for a project; an
issue assigned to **Claude** is worked on by the controller as an agent run in that
project. Types live in `packages/protocol/src/schemas/issues.ts`, client methods in
`packages/client` (`listIssues`, `createIssue`, `getIssue`, `updateIssue`,
`deleteIssue`, `commentOnIssue`, `dispatchIssue`).

## Model

- `Issue { id (iss_…), projectId, number, title, description (markdown), status,
  priority, assignee, labels, sortOrder, agentRunId, agentState, sessionId,
  createdAt, updatedAt, completedAt }`.
- `number` is a per-project sequence starting at 1 (never reused); UIs show the
  identifier `<PROJECT-ID uppercased>-<number>`, e.g. `MOBILE-12`.
- `status`: `backlog | todo | in_progress | in_review | done | canceled` (board
  order). `done`/`canceled` are closed; entering them sets `completedAt`, leaving
  them clears it.
- `priority`: `none | urgent | high | medium | low`.
- `assignee`: `me | claude | null`.
- `IssueComment { id (isc_…), issueId, author: me | claude | system, body,
  agentRunId, createdAt }` is the activity feed.

## REST (all bearer-authenticated)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/v1/issues?projectId=&status=&assignee=` | — | `Issue[]`, ordered by status (board order), `sortOrder`, then `number` desc; at most `LIMITS.maxIssueList` |
| POST | `/v1/projects/:id/issues` | `CreateIssue` | `201 Issue`; 404 unknown project. Default status `todo` when assigned to Claude, else `backlog`; default priority `none`; `sortOrder` puts it at the top of its column |
| GET | `/v1/issues/:id` | — | `IssueDetail` (issue + comments oldest first, last `LIMITS.maxIssueComments`) |
| PATCH | `/v1/issues/:id` | `UpdateIssue` | `200 Issue` |
| DELETE | `/v1/issues/:id` | — | `200 Issue`; cancels its running agent run; deletes comments |
| POST | `/v1/issues/:id/comments` | `CreateIssueComment` | `201 IssueComment` |
| POST | `/v1/issues/:id/dispatch` | `DispatchIssue` | `200 Issue`: assigns to Claude and starts a run now; 409 while one is running; 409 for a closed issue; 503 without `claude` |

Events on `/v1/events`: `issue.updated { issue }`, `issue.deleted { id, projectId }`,
`issue.commented { comment, projectId }`. Deleting a project deletes its issues.

## Claude automation

The controller (`IssueService`) starts an agent run (`AgentRunService.start`, the
issue's project as cwd, the project's Claude account) when:

1. an issue is **created** with `assignee: "claude"` and an open status other than
   `backlog`, or
2. an issue is **updated** so that it is assigned to Claude and open and not
   `backlog` (assignee changed to `claude`, or status moved out of
   `backlog`/closed while assigned to Claude), and no run for it is running, or
3. `POST /dispatch` is called (moves `backlog` to `todo` first), or
4. the user (`author: me`) **comments** on an open Claude issue with no running run
   and a known `sessionId`: the comment is sent as a follow-up that resumes the
   session (`resumeSessionId`).

`backlog` means "not yet": assigning a backlog issue to Claude does not start work
until it is moved to `todo` (or dispatched).

The first prompt is built from the issue: identifier, title, description, labels,
priority, prior comments, plus instructions: work in the project, keep changes
focused, and finish with a short summary of what was done. The run's env carries
`TESSERACT_ISSUE_ID`, so Claude may use `tesseract-controller issue …` inside the
sandbox (see below).

Run lifecycle → issue:

- run starts: `status → in_progress`, `agentRunId`, `agentState: running`, a
  `system` comment "Claude started working (run_…)".
- `agent.updated` events keep `agentState` and `sessionId` in sync.
- run `succeeded`: `status → in_review` (unless the issue was closed or moved by
  the user meanwhile, i.e. it is no longer `in_progress`), a `claude` comment with
  the run's `result` text (or "Finished." when empty).
- run `failed`/`cancelled`: `status → todo` if still `in_progress`, a `system`
  comment with the error.
- unassigning Claude, closing the issue, or deleting it cancels a running run.
- after a controller restart, runs left `running` are reconciled from the
  `agent_runs` table on startup.

## In-sandbox CLI

`tesseract-controller issue list|show|create|update|comment` talks to the local
controller. `issue comment <id> <text>` posts as `claude`; `<id>` defaults to
`$TESSERACT_ISSUE_ID`. Claude can split work into new issues with `issue create`.

## UIs

- **Desktop** (`apps/electron`): an "Issues" tab in project detail: board (columns by
  status, drag to move) and list view, quick create, an issue panel with editable
  title/description, status/priority/assignee/label pickers, "Assign to Claude" /
  "Run Claude now", activity feed with comment composer, and a link to the agent run.
- **Mobile** (`apps/mobile`): an "Issues" entry on the project screen: list grouped by
  status with filters (all / Claude / mine), create sheet, issue detail with property
  pickers, assign-to-Claude toggle, activity and comment composer, link to the run.
  Live updates come from the `issue.*` events.
