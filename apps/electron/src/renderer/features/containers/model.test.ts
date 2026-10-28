import { describe, expect, it } from "vitest";
import type { ContainersReport, DomainRoute, HostDeploy, ServerContainer } from "../../../shared/contracts/containers";
import {
  approvedMessage,
  awaitingApprovalCounts,
  creationRequests,
  deployRequestView,
  newContainerSummary,
  requestSidebarItems,
  composeHostname,
  containerDetailState,
  containersListState,
  containersSidebarState,
  createBlocker,
  createErrors,
  deployBadge,
  deployRequestEntries,
  deploysFor,
  deploySubtitle,
  deployTone,
  formatMemory,
  formatResources,
  isTaskPhase,
  parseOptionalNumber,
  phaseStep,
  parsePort,
  routeCounts,
  shellPanelView,
  sidebarContainerItems,
  sortDeploys,
  sshCommand,
  toMemoryMb,
  upsertContainer,
  withoutContainer,
} from "./model";

const container = (patch: Partial<ServerContainer> = {}): ServerContainer => ({
  name: "viglis-prod",
  id: "abc",
  state: "running",
  status: "Up 3 days",
  image: "tesseract/server:1",
  createdAt: "2026-10-06T09:12:00.000Z",
  cpus: null,
  memoryMb: null,
  tailnet: null,
  tunnel: "none",
  autoDeploy: false,
  ...patch,
});

const route = (patch: Partial<DomainRoute> = {}): DomainRoute => ({
  id: "r1",
  hostname: "viglis.app",
  container: "viglis-prod",
  port: 3000,
  scheme: "http",
  status: "active",
  error: null,
  createdAt: "2026-10-06T09:30:00.000Z",
  ...patch,
});

const deploy = (patch: Partial<HostDeploy> = {}): HostDeploy => ({
  id: "dep_1",
  container: "viglis-prod",
  app: "web",
  kind: "compose",
  sourcePath: "/workspace/web",
  projectId: null,
  port: 3000,
  hostname: "beta.viglis.app",
  create: false,
  cpus: null,
  memoryMb: null,
  status: "awaiting_approval",
  sha256: "0".repeat(64),
  bytes: 2048,
  claimedBy: null,
  log: "",
  urls: [],
  error: null,
  createdAt: "2026-10-24T09:00:00.000Z",
  updatedAt: "2026-10-24T09:00:00.000Z",
  sandbox: "Studio",
  ...patch,
});

const report = (patch: Partial<ContainersReport> = {}): ContainersReport => ({
  sysbox: true,
  image: "tesseract/server:1",
  tailscaleKey: true,
  tailscaleTags: "tag:tesseract-server",
  cloudflare: { connected: false, zones: [], error: null },
  checks: [],
  ...patch,
});

describe("containers model", () => {
  it("maps containers to sorted sidebar items with pending as busy", () => {
    const items = sidebarContainerItems(
      [container({ name: "zeta", state: "stopped" }), container({ name: "alpha" }), container({ name: "mid", state: "error" })],
      new Set(["zeta"]),
    );
    expect(items.map((item) => [item.name, item.activity, item.status])).toEqual([
      ["alpha", "running", "Running"],
      ["mid", "error", "Error"],
      ["zeta", "busy", "Stopped"],
    ]);
    expect(sidebarContainerItems([container({ state: "starting" })], new Set())[0]?.activity).toBe("busy");
  });

  it("derives the sidebar state", () => {
    expect(containersSidebarState({ containers: null, failed: false, sysbox: null })).toBe("loading");
    expect(containersSidebarState({ containers: null, failed: true, sysbox: null })).toBe("unavailable");
    expect(containersSidebarState({ containers: [], failed: false, sysbox: false })).toBe("unavailable");
    expect(containersSidebarState({ containers: [], failed: false, sysbox: true })).toBe("empty");
    expect(containersSidebarState({ containers: [container()], failed: true, sysbox: false })).toBe("ready");
  });

  it("formats memory and resources", () => {
    expect(formatMemory(512)).toBe("512 MB");
    expect(formatMemory(4096)).toBe("4 GB");
    expect(formatMemory(1536)).toBe("1.5 GB");
    expect(formatResources({ cpus: 2, memoryMb: 8192 })).toBe("2 CPUs · 8 GB");
    expect(formatResources({ cpus: 1, memoryMb: null })).toBe("1 CPU");
    expect(formatResources({ cpus: null, memoryMb: null })).toBe("Shared resources");
  });

  it("builds the ssh command from the tailnet target", () => {
    expect(sshCommand(container())).toBeNull();
    const tailnet = { hostname: "api", dnsName: "api.tail1.ts.net", ip: "100.64.0.9", online: true, sshTarget: "root@api.tail1.ts.net" };
    expect(sshCommand(container({ tailnet }))).toBe("ssh root@api.tail1.ts.net");
  });

  it("parses and validates the create form", () => {
    expect(parseOptionalNumber("")).toBeNull();
    expect(parseOptionalNumber(" 0.5 ")).toBe(0.5);
    expect(parseOptionalNumber("-1")).toBeUndefined();
    expect(parseOptionalNumber("abc")).toBeUndefined();
    expect(toMemoryMb(4, "gb")).toBe(4096);
    expect(toMemoryMb(512.4, "mb")).toBe(512);
    expect(toMemoryMb(null, "gb")).toBeNull();
    expect(createErrors({ name: " ", cpus: "x", memory: "" })).toEqual({ name: "Enter a name.", cpus: "Enter a number of CPUs, like 2 or 0.5." });
    expect(createErrors({ name: "api", cpus: "2", memory: "4" })).toEqual({});
  });

  it("explains why a container can't be created", () => {
    expect(createBlocker(null)).toBeNull();
    expect(createBlocker(report({ sysbox: false, image: null }))).toBe("sysbox");
    expect(createBlocker(report({ image: null }))).toBe("image");
    expect(createBlocker(report())).toBeNull();
    const vm = { id: "sysbox", status: "error", title: "Sysbox runtime", detail: "Set up the VM", action: "setup-vm" } as const;
    expect(createBlocker(report({ sysbox: false, checks: [vm] }))).toBe("vm");
  });

  it("tracks the progress of long container tasks", () => {
    expect(phaseStep({ kind: "setting-up-vm", step: "colima start" }, "setting-up-vm")).toBe("colima start");
    expect(phaseStep({ kind: "building", step: "RUN apt-get" }, "setting-up-vm")).toBeNull();
    expect(isTaskPhase({ kind: "setting-up-vm", step: "" })).toBe(true);
    expect(isTaskPhase({ kind: "routing", hostname: "a.example.com" })).toBe(false);
  });

  it("composes hostnames and parses ports", () => {
    expect(composeHostname("App", "viglis.app")).toBe("app.viglis.app");
    expect(composeHostname(" ", "viglis.app")).toBe("viglis.app");
    expect(composeHostname(".api.", "viglis.app.")).toBe("api.viglis.app");
    expect(parsePort("8080")).toBe(8080);
    expect(parsePort("0")).toBeNull();
    expect(parsePort("70000")).toBeNull();
    expect(parsePort("80a")).toBeNull();
  });

  it("counts routes per container and updates lists", () => {
    const counts = routeCounts([route(), route({ id: "r2" }), route({ id: "r3", container: "other" })]);
    expect(counts.get("viglis-prod")).toBe(2);
    expect(counts.get("other")).toBe(1);
    const list = upsertContainer([container()], container({ state: "stopped" }));
    expect(list).toHaveLength(1);
    expect(list[0]?.state).toBe("stopped");
    expect(upsertContainer(list, container({ name: "new" }))).toHaveLength(2);
    expect(withoutContainer(list, "viglis-prod")).toEqual([]);
  });

  it("describes list and detail states", () => {
    expect(containersListState(null, null)?.loading).toBe(true);
    expect(containersListState([], null)?.action?.id).toBe("create");
    expect(containersListState(null, "Docker isn't reachable")?.action?.id).toBe("retry");
    expect(containersListState([container()], null)).toBeNull();
    expect(containerDetailState([container()], "viglis-prod", null)).toBeNull();
    expect(containerDetailState([container()], "missing", null)?.action?.id).toBe("back");
  });
});

describe("shellPanelView", () => {
  it("only offers a shell for running containers", () => {
    expect(shellPanelView({ kind: "idle" }, true)).toMatchObject({ action: "open", status: null });
    expect(shellPanelView({ kind: "idle" }, false)).toMatchObject({ action: null, placeholder: "Start the container to open a shell." });
  });

  it("tracks the session", () => {
    expect(shellPanelView({ kind: "connecting" }, true)).toMatchObject({ action: null, status: { label: "Connecting", live: true } });
    expect(shellPanelView({ kind: "open" }, true)).toMatchObject({ action: null, status: { label: "Connected", tone: "success" } });
    expect(shellPanelView({ kind: "exited", code: 0 }, true)).toMatchObject({ action: "reopen", status: { label: "Exited 0" } });
    expect(shellPanelView({ kind: "error", message: "boom" }, true)).toMatchObject({ action: "open", placeholder: "boom", status: { tone: "danger" } });
  });
});

describe("deploys model", () => {
  it("maps statuses to tones and badges", () => {
    expect(deployTone("deployed")).toBe("success");
    expect(deployTone("awaiting_approval")).toBe("warning");
    expect(deployTone("deploying")).toBe("info");
    expect(deployTone("failed")).toBe("danger");
    expect(deployTone("rejected")).toBe("neutral");
    expect(deployBadge("awaiting_approval")).toEqual({ label: "Needs approval", tone: "warning", live: false });
    expect(deployBadge("deploying")).toMatchObject({ label: "Deploying", live: true });
  });

  it("counts deploys awaiting approval per container", () => {
    const counts = awaitingApprovalCounts([
      deploy(),
      deploy({ id: "dep_2" }),
      deploy({ id: "dep_3", status: "deployed" }),
      deploy({ id: "dep_4", container: "scratch" }),
    ]);
    expect(counts.get("viglis-prod")).toBe(2);
    expect(counts.get("scratch")).toBe(1);
    expect(awaitingApprovalCounts(null).size).toBe(0);
  });

  it("sorts newest first and filters by container", () => {
    const list = [deploy({ id: "dep_old", createdAt: "2026-10-01T00:00:00.000Z" }), deploy({ id: "dep_new", container: "scratch" })];
    expect(sortDeploys(list).map((entry) => entry.id)).toEqual(["dep_new", "dep_old"]);
    expect(deploysFor(list, "scratch").map((entry) => entry.id)).toEqual(["dep_new"]);
    expect(deploysFor(list, null)).toHaveLength(2);
  });

  it("describes the deploy and the approval request", () => {
    const now = Date.parse("2026-10-24T09:05:00.000Z") / 1000;
    expect(deploySubtitle(deploy(), now)).toBe("Compose · from Studio · 5m ago");
    expect(deployRequestEntries(deploy())).toEqual([
      ["Source", "/workspace/web"],
      ["Bundle size", "2 KB"],
      ["Public URL", "beta.viglis.app → port 3000"],
    ]);
    expect(deployRequestEntries(deploy({ hostname: null }))[2]).toEqual(["Port", "3000"]);
    expect(deployRequestEntries(deploy({ hostname: null, port: null }))[2]).toEqual(["Public URL", "None"]);
  });

  it("adds an attention count to sidebar items", () => {
    const items = sidebarContainerItems([container()], new Set(), new Map([["viglis-prod", 2]]));
    expect(items[0]).toMatchObject({ attention: 2, attentionLabel: "2 deploys need approval" });
    expect(sidebarContainerItems([container()], new Set())[0]).toMatchObject({ attention: 0, attentionLabel: undefined });
  });
});

describe("container creation requests", () => {
  const request = (patch: Partial<HostDeploy> = {}) =>
    deploy({ id: "dep_new", container: "xenocrust-erp", app: "xenocrust-erp", create: true, cpus: 2, memoryMb: 4096, hostname: "erp.example.com", port: 8080, ...patch });

  it("lists active create requests for containers that don't exist yet", () => {
    const list = [
      request(),
      request({ id: "dep_running", status: "deploying", createdAt: "2026-10-24T10:00:00.000Z" }),
      request({ id: "dep_done", status: "deployed" }),
      request({ id: "dep_rejected", status: "rejected" }),
      request({ id: "dep_exists", container: "viglis-prod" }),
      deploy({ id: "dep_plain", container: "ghost" }),
    ];
    expect(creationRequests(list, [container()]).map((entry) => entry.id)).toEqual(["dep_running", "dep_new"]);
    expect(creationRequests(list, null).map((entry) => entry.id)).toEqual(["dep_running", "dep_new", "dep_exists"]);
  });

  it("describes the new container in the approval panel", () => {
    expect(newContainerSummary({ cpus: 2, memoryMb: 4096 })).toBe("New container · 2 CPUs · 4 GB");
    expect(newContainerSummary({ cpus: 1, memoryMb: null })).toBe("New container · 1 CPU");
    expect(newContainerSummary({ cpus: null, memoryMb: null })).toBe("New container · Shared resources");
    const view = deployRequestView(request());
    expect(view).toMatchObject({ title: "Waiting for your approval to create xenocrust-erp", approveLabel: "Create and deploy" });
    expect(view.entries[0]).toEqual(["Container", "New container · 2 CPUs · 4 GB"]);
    expect(view.entries[3]).toEqual(["Public URL", "erp.example.com → port 8080"]);
    expect(deployRequestView(deploy())).toMatchObject({ title: "Waiting for your approval", approveLabel: "Approve" });
    expect(deployRequestView(deploy()).entries).toHaveLength(3);
  });

  it("names the target container in the subtitle and toast", () => {
    const now = Date.parse("2026-10-24T09:05:00.000Z") / 1000;
    expect(deploySubtitle(request(), now)).toBe("Compose · to xenocrust-erp · from Studio · 5m ago");
    expect(approvedMessage(request())).toBe("Creating xenocrust-erp for xenocrust-erp");
    expect(approvedMessage(deploy())).toBe("Deploying web");
  });

  it("adds placeholder sidebar rows after the real containers", () => {
    const items = sidebarContainerItems([container()], new Set(), new Map(), [request(), request({ id: "dep_b", container: "alpha", status: "deploying" })]);
    expect(items.map((item) => item.name)).toEqual(["viglis-prod", "alpha", "xenocrust-erp"]);
    expect(items[1]).toMatchObject({ activity: "busy", status: "New · creating", attention: 0, request: true });
    expect(items[2]).toMatchObject({ activity: "requested", status: "New · needs approval", attention: 1, attentionLabel: "New · needs approval", request: true });
    expect(requestSidebarItems([request(), request({ id: "dep_2" })])).toHaveLength(1);
    expect(requestSidebarItems([request(), request({ id: "dep_2" })])[0]!.attention).toBe(2);
  });

  it("shows the list and sidebar while only requests exist", () => {
    expect(containersSidebarState({ containers: [], failed: false, sysbox: true, requests: 1 })).toBe("ready");
    expect(containersListState([], null, 1)).toBeNull();
    expect(containersListState(null, null, 1)?.loading).toBe(true);
  });
});
