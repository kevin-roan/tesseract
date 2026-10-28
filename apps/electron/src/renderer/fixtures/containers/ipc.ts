import type { ContainersReport, CreateContainerRequest, DomainRoute, HostDeploy, ServerContainer } from "../../../shared/contracts/containers";
import { IpcError } from "../../../shared/ipc-types";
import { emitFixtureEvent } from "../registry";
import { currentScenario, isScenario } from "../scenario";
import { defineIpcFixtures } from "../types";
import { CONTAINERS_SCENARIOS, FIXTURE_CONTAINERS, FIXTURE_DEPLOYS, FIXTURE_LOGS, FIXTURE_ROUTES, FIXTURE_SERVER_IMAGE, fixtureReport } from "./data";

const UNAVAILABLE = "Docker isn't reachable on this computer.";

let containers: ServerContainer[] | null = null;
let routes: DomainRoute[] | null = null;
let report: ContainersReport | null = null;
let deploys: HostDeploy[] | null = null;

function currentContainers(): ServerContainer[] {
  containers ??= isScenario(CONTAINERS_SCENARIOS.empty) || isScenario(CONTAINERS_SCENARIOS.noSysbox) || isScenario(CONTAINERS_SCENARIOS.noVm) ? [] : FIXTURE_CONTAINERS.map((entry) => ({ ...entry }));
  return containers;
}

function currentRoutes(): DomainRoute[] {
  routes ??= currentContainers().length > 0 && !isScenario(CONTAINERS_SCENARIOS.noCloudflare) ? FIXTURE_ROUTES.map((entry) => ({ ...entry })) : [];
  return routes;
}

function currentDeploys(): HostDeploy[] {
  const available = currentContainers().length > 0;
  deploys ??= FIXTURE_DEPLOYS.filter((deploy) => (deploy.create && available) || currentContainers().some((entry) => entry.name === deploy.container)).map((entry) => ({ ...entry }));
  return deploys;
}

function setDeploys(next: HostDeploy[]): HostDeploy[] {
  deploys = next;
  emitFixtureEvent("containers", "deploys", next);
  return next;
}

function decideDeploy(id: string, status: HostDeploy["status"]): void {
  const found = currentDeploys().find((entry) => entry.id === id);
  if (!found) throw new IpcError("not_found", `No deploy ${id}`);
  if (found.status !== "awaiting_approval") throw new IpcError("invalid_argument", `Deploy ${id} isn't waiting for approval`);
  if (status === "deploying" && found.create && !currentContainers().some((entry) => entry.name === found.container)) {
    createContainer({ name: found.container, cpus: found.cpus, memoryMb: found.memoryMb });
  }
  const next = { ...found, status, updatedAt: new Date().toISOString() };
  setDeploys(currentDeploys().map((entry) => (entry.id === id ? next : entry)));
}

function currentReport(): ContainersReport {
  report ??= fixtureReport({
    sysbox: currentScenario() !== CONTAINERS_SCENARIOS.noSysbox && currentScenario() !== CONTAINERS_SCENARIOS.noVm,
    vm: currentScenario() === CONTAINERS_SCENARIOS.noVm,
    image: currentScenario() !== CONTAINERS_SCENARIOS.noImage,
    cloudflare: currentScenario() !== CONTAINERS_SCENARIOS.noCloudflare,
  });
  return report;
}

function setContainers(next: ServerContainer[]): ServerContainer[] {
  containers = next;
  emitFixtureEvent("containers", "containers", next);
  return next;
}

function setRoutes(next: DomainRoute[]): DomainRoute[] {
  routes = next;
  emitFixtureEvent("containers", "routes", next);
  return next;
}

function update(name: string, patch: Partial<ServerContainer>): ServerContainer {
  const found = currentContainers().find((entry) => entry.name === name);
  if (!found) throw new IpcError("not_found", `No container named ${name}`);
  const next = { ...found, ...patch };
  setContainers(currentContainers().map((entry) => (entry.name === name ? next : entry)));
  return next;
}

function createContainer(request: CreateContainerRequest): ServerContainer {
  const container: ServerContainer = {
    name: request.name,
    id: Math.random().toString(16).slice(2, 14),
    state: "running",
    status: "Up 1 second",
    image: FIXTURE_SERVER_IMAGE,
    createdAt: new Date().toISOString(),
    cpus: request.cpus ?? null,
    memoryMb: request.memoryMb ?? null,
    tailnet: null,
    tunnel: "none",
    autoDeploy: false,
  };
  setContainers([...currentContainers(), container]);
  return container;
}

export default defineIpcFixtures({
  containers: {
    report: () => currentReport(),
    list: () => {
      if (isScenario(CONTAINERS_SCENARIOS.unavailable)) throw new IpcError("unavailable", UNAVAILABLE);
      return currentContainers();
    },
    create: (request) => createContainer(request),
    start: (name) => update(name, { state: "running", status: "Up 1 second" }),
    stop: (name) => update(name, { state: "stopped", status: "Exited (0) 1 second ago" }),
    restart: (name) => update(name, { state: "running", status: "Up 1 second" }),
    remove: (name) => {
      setDeploys(currentDeploys().filter((deploy) => deploy.container !== name));
      setRoutes(currentRoutes().filter((route) => route.container !== name));
      setContainers(currentContainers().filter((entry) => entry.name !== name));
    },
    logs: () => FIXTURE_LOGS,
    buildImage: () => {
      report = fixtureReport({ sysbox: currentReport().sysbox, image: true, cloudflare: currentReport().cloudflare.connected });
      return report;
    },
    setupVm: () => {
      report = fixtureReport({ sysbox: true, image: currentReport().image !== null, cloudflare: currentReport().cloudflare.connected });
      return report;
    },
    cancel: () => ({ kind: "idle" }),
    phase: () => ({ kind: "idle" }),
    setTailscaleKey: (request) => {
      report = { ...currentReport(), tailscaleKey: Boolean(request.authKey), tailscaleTags: request.tags ?? currentReport().tailscaleTags };
      return report;
    },
    setCloudflareToken: (token) => {
      report = fixtureReport({ sysbox: currentReport().sysbox, image: currentReport().image !== null, cloudflare: Boolean(token) });
      return report;
    },
    routes: () => currentRoutes(),
    addRoute: (request) => {
      const route: DomainRoute = {
        id: `route-${Date.now()}`,
        hostname: request.hostname,
        container: request.container,
        port: request.port,
        scheme: request.scheme ?? "http",
        status: "active",
        error: null,
        createdAt: new Date().toISOString(),
      };
      setRoutes([...currentRoutes(), route]);
      return route;
    },
    removeRoute: (id) => {
      setRoutes(currentRoutes().filter((route) => route.id !== id));
    },
    syncRoutes: () => currentRoutes(),
    setAutoDeploy: (name, enabled) => update(name, { autoDeploy: enabled }),
    deploys: () => currentDeploys(),
    approveDeploy: (id) => decideDeploy(id, "deploying"),
    rejectDeploy: (id) => decideDeploy(id, "rejected"),
  },
});
