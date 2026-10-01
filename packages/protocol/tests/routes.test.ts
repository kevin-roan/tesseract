import { describe, expect, test } from "bun:test";
import {
  appendQuery,
  buildFragment,
  buildQuery,
  createId,
  errorBody,
  errorCodeForStatus,
  ErrorBodySchema,
  ID_PREFIXES,
  isFinalAgentRunState,
  isFinalBuildState,
  isFinalProcessState,
  isIdOfKind,
  isValidProjectId,
  normalizeProjectId,
  parseFragment,
  parseParams,
  projectIdFromName,
  restPaths,
  routePatterns,
  statusForErrorCode,
  uiPaths,
  wsPaths,
} from "../src/index";

describe("route builders", () => {
  test("static REST paths", () => {
    expect(restPaths.health()).toBe("/v1/health");
    expect(restPaths.authTicket()).toBe("/v1/auth/ticket");
    expect(restPaths.status()).toBe("/v1/status");
    expect(restPaths.context()).toBe("/v1/context");
    expect(restPaths.identity()).toBe("/v1/identity");
    expect(restPaths.ports()).toBe("/v1/ports");
    expect(restPaths.projects()).toBe("/v1/projects");
    expect(restPaths.terminals()).toBe("/v1/terminals");
    expect(restPaths.display()).toBe("/v1/display");
    expect(restPaths.displayScreenshot()).toBe("/v1/display/screenshot");
    expect(restPaths.events()).toBe("/v1/events");
  });

  test("parameterized REST paths encode ids", () => {
    expect(restPaths.project("my.app")).toBe("/v1/projects/my.app");
    expect(restPaths.project("../x y")).toBe("/v1/projects/..%2Fx%20y");
    expect(restPaths.projectGit("app")).toBe("/v1/projects/app/git");
    expect(restPaths.process("prc_1")).toBe("/v1/processes/prc_1");
    expect(restPaths.terminal("trm_1")).toBe("/v1/terminals/trm_1");
    expect(restPaths.build("bld_1")).toBe("/v1/builds/bld_1");
    expect(restPaths.agentRun("run_1")).toBe("/v1/agent/runs/run_1");
    expect(restPaths.liveActivities()).toBe("/v1/push/live-activities");
    expect(restPaths.liveActivity("AB12")).toBe("/v1/push/live-activities/AB12");
  });

  test("query parameters", () => {
    expect(restPaths.processes()).toBe("/v1/processes");
    expect(restPaths.processes({})).toBe("/v1/processes");
    expect(restPaths.processes({ projectId: "app" })).toBe("/v1/processes?projectId=app");
    expect(restPaths.builds({ projectId: "a b" })).toBe("/v1/builds?projectId=a%20b");
    expect(restPaths.artifacts({ projectId: "app" })).toBe("/v1/artifacts?projectId=app");
    expect(restPaths.agentRuns({ projectId: "app" })).toBe("/v1/agent/runs?projectId=app");
    expect(restPaths.agentRuns({ projectId: "app", archived: true })).toBe("/v1/agent/runs?projectId=app&archived=true");
    expect(restPaths.agentRunsArchive()).toBe("/v1/agent/runs/archive");
    expect(restPaths.agentRunsDelete()).toBe("/v1/agent/runs/delete");
    expect(restPaths.processLogs("prc_1", { tail: 50 })).toBe("/v1/processes/prc_1/logs?tail=50");
    expect(restPaths.buildLogs("bld_1")).toBe("/v1/builds/bld_1/logs");
    expect(restPaths.artifactDownload("art_1", { ticket: "t/+=" })).toBe("/v1/artifacts/art_1/download?ticket=t%2F%2B%3D");
  });

  test("websocket paths", () => {
    expect(wsPaths.events()).toBe("/v1/events");
    expect(wsPaths.terminalStream("trm_1")).toBe("/v1/terminals/trm_1/stream");
    expect(wsPaths.processLogStream("prc_1")).toBe("/v1/processes/prc_1/logs/stream");
    expect(wsPaths.buildLogStream("bld_1")).toBe("/v1/builds/bld_1/logs/stream");
    expect(wsPaths.agentRunStream("run_1")).toBe("/v1/agent/runs/run_1/stream");
    expect(wsPaths.vnc()).toBe("/v1/display/vnc");
  });

  test("ui paths carry secrets in the fragment", () => {
    expect(uiPaths.terminal()).toBe("/ui/terminal");
    expect(uiPaths.terminal({ ticket: "a b", session: "trm_1" })).toBe("/ui/terminal#ticket=a%20b&session=trm_1");
    expect(uiPaths.vnc({ ticket: "t", password: "p&w" })).toBe("/ui/vnc#ticket=t&password=p%26w");
    expect(uiPaths.vnc({ ticket: "t", password: null })).toBe("/ui/vnc#ticket=t");
  });

  test("route patterns match the builders", () => {
    expect(routePatterns.rest.project).toBe("/v1/projects/:id");
    expect(routePatterns.rest.ports).toBe("/v1/ports");
    expect(routePatterns.rest.agentRun).toBe("/v1/agent/runs/:id");
    expect(routePatterns.rest.liveActivity).toBe("/v1/push/live-activities/:token");
    expect(routePatterns.ws.terminalStream).toBe("/v1/terminals/:id/stream");
    expect(routePatterns.ui.vnc).toBe("/ui/vnc");
    const check = (builders: Record<string, (id: string) => string>, patterns: Record<string, string>) => {
      expect(Object.keys(builders).sort()).toEqual(Object.keys(patterns).sort());
      for (const [key, pattern] of Object.entries(patterns)) {
        const build = builders[key];
        if (!build) throw new Error(`missing builder ${key}`);
        expect(/:\w+/.test(pattern) ? build("ID") : build(undefined as never)).toBe(pattern.replace(/:\w+/, "ID"));
      }
    };
    check(restPaths as unknown as Record<string, (id: string) => string>, routePatterns.rest);
    check(wsPaths as unknown as Record<string, (id: string) => string>, routePatterns.ws);
  });
});

describe("query and fragment helpers", () => {
  test("buildQuery skips nullish values", () => {
    expect(buildQuery()).toBe("");
    expect(buildQuery({ a: undefined, b: null })).toBe("");
    expect(buildQuery({ a: 1, b: true, c: "x y" })).toBe("?a=1&b=true&c=x%20y");
    expect(buildFragment({ ticket: "t" })).toBe("#ticket=t");
    expect(appendQuery("/p", { ticket: "t" })).toBe("/p?ticket=t");
    expect(appendQuery("/p?a=1", { ticket: "t" })).toBe("/p?a=1&ticket=t");
    expect(appendQuery("/p", {})).toBe("/p");
  });

  test("parseParams / parseFragment", () => {
    expect(parseFragment("#ticket=a%20b&session=trm_1&password=")).toEqual({
      ticket: "a b",
      session: "trm_1",
      password: "",
    });
    expect(parseParams("?a=1&a=2&flag&bad=%E0%A4%A")).toEqual({ a: "1", flag: "" });
    expect(parseParams("")).toEqual({});
  });
});

describe("ids", () => {
  test("project ids", () => {
    expect(isValidProjectId("electron-hello")).toBe(true);
    expect(isValidProjectId("a")).toBe(true);
    expect(isValidProjectId("App")).toBe(false);
    expect(isValidProjectId("-app")).toBe(false);
    expect(isValidProjectId("a".repeat(64))).toBe(true);
    expect(isValidProjectId("a".repeat(65))).toBe(false);
    expect(normalizeProjectId("  MyApp ")).toBe("myapp");
    expect(normalizeProjectId("my app")).toBeNull();
    expect(normalizeProjectId("../etc")).toBeNull();
  });

  test("projectIdFromName slugifies", () => {
    expect(projectIdFromName("My Cool App!")).toBe("my-cool-app");
    expect(projectIdFromName("  __Expensifo v2.0 ")).toBe("expensifo-v2.0");
    expect(projectIdFromName("!!!")).toBeNull();
    expect(projectIdFromName("x".repeat(100))?.length).toBe(64);
  });

  test("createId and isIdOfKind", () => {
    const seen = new Set<string>();
    for (const kind of Object.keys(ID_PREFIXES) as Array<keyof typeof ID_PREFIXES>) {
      const id = createId(kind);
      expect(id.startsWith(ID_PREFIXES[kind])).toBe(true);
      expect(id).toMatch(/^[a-z]{3,4}_[0-9a-z]{10}$/);
      expect(isIdOfKind(kind, id)).toBe(true);
      seen.add(id);
    }
    expect(seen.size).toBe(Object.keys(ID_PREFIXES).length);
    expect(isIdOfKind("build", "prc_abc")).toBe(false);
  });
});

describe("state and error helpers", () => {
  test("final states", () => {
    expect(isFinalProcessState("running")).toBe(false);
    expect(isFinalProcessState("orphaned")).toBe(true);
    expect(isFinalBuildState("queued")).toBe(false);
    expect(isFinalBuildState("cancelled")).toBe(true);
    expect(isFinalAgentRunState("running")).toBe(false);
    expect(isFinalAgentRunState("failed")).toBe(true);
  });

  test("error code mapping", () => {
    expect(errorCodeForStatus(401)).toBe("unauthorized");
    expect(errorCodeForStatus(422)).toBe("bad_request");
    expect(errorCodeForStatus(503)).toBe("unavailable");
    expect(errorCodeForStatus(500)).toBe("internal");
    expect(statusForErrorCode("conflict")).toBe(409);
    const body = errorBody("not_found", "No such build");
    expect(ErrorBodySchema.parse(body)).toEqual({ error: { code: "not_found", message: "No such build" } });
  });
});
