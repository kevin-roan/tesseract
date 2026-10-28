import { routePatterns, type CreateIssue, type CreateIssueComment, type UpdateIssue } from "@tesseract/protocol";
import { defineHttpFixtures, reply, type HttpFixtureRequest } from "../types";
import { commentOnIssue, createIssue, deleteIssue, dispatchIssue, findIssue, issueDetail, listIssues, startRun, updateIssue } from "./data";

const rest = routePatterns.rest;
const idOf = (request: HttpFixtureRequest) => request.params[0] ?? "";
const notFound = (id: string) => reply(404, { error: { code: "not_found", message: `Issue ${id} not found` } });

function withIssue(request: HttpFixtureRequest, respond: (issue: NonNullable<ReturnType<typeof findIssue>>) => unknown) {
  const issue = findIssue(idOf(request));
  return issue ? respond(issue) : notFound(idOf(request));
}

export default defineHttpFixtures([
  { method: "GET", path: rest.issues, respond: ({ query }) => listIssues(query) },
  { method: "POST", path: rest.projectIssues, respond: (request) => reply(201, createIssue(idOf(request), request.body as CreateIssue)) },
  { method: "GET", path: rest.issue, respond: (request) => withIssue(request, issueDetail) },
  { method: "PATCH", path: rest.issue, respond: (request) => withIssue(request, (issue) => updateIssue(issue, request.body as UpdateIssue)) },
  { method: "DELETE", path: rest.issue, respond: (request) => withIssue(request, deleteIssue) },
  {
    method: "POST",
    path: rest.issueComments,
    respond: (request) => withIssue(request, (issue) => reply(201, commentOnIssue(issue, request.body as CreateIssueComment))),
  },
  {
    method: "POST",
    path: rest.issueDispatch,
    respond: (request) =>
      withIssue(request, (issue) => {
        const dispatched = dispatchIssue(issue);
        return dispatched ? startRun(dispatched) : reply(409, { error: { code: "conflict", message: "Claude is already working on this issue" } });
      }),
  },
]);
