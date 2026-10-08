import { routePatterns, type StartBuild, type StartProcess } from "@tesseract/protocol";
import { defineHttpFixtures, reply, type HttpFixtureRequest } from "../types";
import { allBuilds, allProcesses, fixturePorts, logLines, startedBuild, startedProcess } from "./data";

export { SCENARIOS } from "./data";

const rest = routePatterns.rest;
const idOf = (request: HttpFixtureRequest) => request.params[0] ?? "";
const notFound = (what: string, id: string) => reply(404, { error: { code: "not_found", message: `${what} ${id} not found` } });

const findProcess = (request: HttpFixtureRequest) => allProcesses().find((process) => process.id === idOf(request));
const findBuild = (request: HttpFixtureRequest) => allBuilds().find((build) => build.id === idOf(request));

export default defineHttpFixtures([
  { method: "GET", path: rest.ports, respond: fixturePorts },
  {
    method: "GET",
    path: rest.process,
    respond: (request) => findProcess(request) ?? notFound("Process", idOf(request)),
  },
  {
    method: "DELETE",
    path: rest.process,
    respond: (request) => {
      const process = findProcess(request);
      return process ? { ...process, state: "stopped", endedAt: new Date().toISOString() } : notFound("Process", idOf(request));
    },
  },
  { method: "GET", path: rest.processLogs, respond: () => logLines("process") },
  { method: "POST", path: rest.processes, respond: ({ body }) => startedProcess(body as StartProcess) },
  {
    method: "GET",
    path: rest.build,
    respond: (request) => findBuild(request) ?? notFound("Build", idOf(request)),
  },
  {
    method: "DELETE",
    path: rest.build,
    respond: (request) => {
      const build = findBuild(request);
      return build ? { ...build, state: "cancelled", endedAt: new Date().toISOString() } : notFound("Build", idOf(request));
    },
  },
  { method: "GET", path: rest.buildLogs, respond: () => logLines("build") },
  { method: "POST", path: rest.builds, respond: ({ body }) => startedBuild(body as StartBuild) },
]);
