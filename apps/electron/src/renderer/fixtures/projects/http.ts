import { routePatterns, type CreateProject, type Project } from "@theone/protocol";
import { isScenario } from "../scenario";
import { defineHttpFixtures, reply, type HttpFixtureRequest } from "../types";
import { GTK_PARITY, PARITY_SCRIPTS, parityProcesses } from "./parity";
import { BASE_IDS, CLONE_PROCESS_ID, REFERENCE_IDS, fixtureBuilds, fixtureProcesses, fixtureProjectList } from "./data";

export { SCENARIOS } from "./data";

const rest = routePatterns.rest;
const parity = () => isScenario(GTK_PARITY);
const ids = () => (isScenario("reference") || parity() ? REFERENCE_IDS : BASE_IDS);
const busy = () => isScenario("busy");
const withParityScripts = (project: Project): Project => ({ ...project, scripts: PARITY_SCRIPTS[project.id] ?? project.scripts });
const projects = (): Project[] => {
  if (isScenario("empty")) return [];
  const list = fixtureProjectList(ids());
  return parity() ? list.map(withParityScripts) : list;
};
const byProject = <T extends { projectId: string | null }>(items: T[], request: HttpFixtureRequest) => {
  const projectId = request.query.get("projectId");
  return projectId ? items.filter((item) => item.projectId === projectId) : items;
};
const notFound = (id: string) => reply(404, { error: { code: "not_found", message: `Project ${id} not found` } });
const withProject = (request: HttpFixtureRequest, respond: (project: Project) => unknown) => {
  const id = request.params[0] ?? "";
  const project = projects().find((candidate) => candidate.id === id);
  return project ? respond(project) : notFound(id);
};

export default defineHttpFixtures([
  { method: "GET", path: rest.projects, respond: projects },
  { method: "GET", path: rest.project, respond: (request) => withProject(request, (project) => project) },
  { method: "GET", path: rest.processes, respond: (request) => byProject(parity() ? parityProcesses() : fixtureProcesses(ids()), request) },
  { method: "GET", path: rest.builds, respond: (request) => byProject(fixtureBuilds(ids(), busy()), request) },
  {
    method: "POST",
    path: rest.projects,
    respond: (request) => {
      const body = request.body as CreateProject;
      const id = body.name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
      const created: Project = { ...fixtureProjectList(ids())[1]!, id, name: body.name, path: `/workspace/projects/${id}`, git: null, confidential: body.confidential ?? false };
      return body.gitUrl ? { project: created, processId: CLONE_PROCESS_ID } : { project: created };
    },
  },
  {
    method: "PUT",
    path: rest.projectName,
    respond: (request) => withProject(request, (project) => ({ ...project, name: (request.body as { name: string | null }).name ?? project.id })),
  },
  {
    method: "PUT",
    path: rest.projectClaudeAccount,
    respond: (request) => withProject(request, (project) => ({ ...project, claudeAccountId: (request.body as { accountId: string | null }).accountId })),
  },
  { method: "DELETE", path: rest.project, respond: (request) => withProject(request, (project) => ({ id: project.id, trashPath: `/tmp/${project.id}` })) },
]);
