import { describe, expect, it } from "vitest";
import type { ContainersReport, DomainRoute, ServerContainer } from "../../../shared/contracts/containers";
import {
  composeHostname,
  containerDetailState,
  containersListState,
  containersSidebarState,
  createBlocker,
  createErrors,
  formatMemory,
  formatResources,
  parseOptionalNumber,
  parsePort,
  routeCounts,
  shellPanelView,
  sidebarContainerItems,
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
