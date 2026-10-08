import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCli, tempSandbox, type Sandbox } from "../testing";
import { describeStatus, type StatusReport } from "./status";

const mocks = vi.hoisted(() => ({
  probeDocker: vi.fn(),
  probeHealth: vi.fn(),
  composeStatus: vi.fn(),
  currentStack: vi.fn(),
}));

vi.mock("../../src/core/docker", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/core/docker")>()),
  probeDocker: mocks.probeDocker,
}));

vi.mock("../../src/core/connection", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/core/connection")>()),
  probeHealth: mocks.probeHealth,
}));

vi.mock("../../src/core/sandbox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/core/sandbox")>()),
  composeStatus: mocks.composeStatus,
  currentStack: mocks.currentStack,
}));

let sandbox: Sandbox;

beforeEach(() => {
  sandbox = tempSandbox();
  mocks.probeDocker.mockResolvedValue({
    cli: { path: "/usr/bin/docker", version: "28.1.1" },
    daemon: "reachable",
    daemonError: null,
    kind: "engine",
    context: null,
    server: { version: "28.1.1", os: "linux", arch: "x86_64", ncpu: 8, memBytes: 16e9, rootDir: "/var/lib/docker", rootless: false },
    compose: "2.30.0",
    buildx: "0.20.0",
    checks: [],
  });
  mocks.probeHealth.mockResolvedValue(true);
  mocks.currentStack.mockResolvedValue({ envFile: "/x/.env", project: "tesseract", mode: "local", image: "tesseract/sandbox:latest", builtAt: null, components: [] });
  mocks.composeStatus.mockResolvedValue({
    configured: true,
    project: "tesseract",
    services: [
      { service: "sandbox", container: "tesseract-sandbox-1", state: "running", health: "healthy" },
      { service: "tailscale", container: "tesseract-tailscale-1", state: "running", health: null },
    ],
  });
});

afterEach(() => {
  sandbox.cleanup();
  vi.clearAllMocks();
});

describe("tesseract status", () => {
  it("collects connection, docker, stack, services and android state", async () => {
    mkdirSync(dirname(sandbox.configFile), { recursive: true });
    writeFileSync(
      sandbox.configFile,
      JSON.stringify({ url: "http://127.0.0.1:7700", token: "t".repeat(43), name: "studio", androidAvd: "Pixel", onboarding: { step: "android" } }),
    );
    const result = await runCli(sandbox, ["status", "--json"]);
    const report = JSON.parse(result.out.join("\n")) as StatusReport;
    expect(result.code).toBe(0);
    expect(report.connection).toEqual({ url: "http://127.0.0.1:7700", name: "studio", source: "file", reachable: true });
    expect(report.docker).toEqual({ ready: true, kind: "engine", version: "28.1.1", problem: null });
    expect(report.onboarding).toEqual({ completed: false, step: "android" });
    expect(report.android.avd).toBe("Pixel");
    expect(result.out.join("\n")).not.toContain("t".repeat(43));
  });

  it("shows a sealed connection without needing the token", async () => {
    mkdirSync(dirname(sandbox.configFile), { recursive: true });
    writeFileSync(sandbox.configFile, JSON.stringify({ url: "http://127.0.0.1:7700", tokenSealed: "abc" }));
    mocks.probeHealth.mockResolvedValue(false);
    const report = JSON.parse((await runCli(sandbox, ["status", "--json"])).out.join("\n")) as StatusReport;
    expect(report.connection).toMatchObject({ source: "sealed", reachable: false });
  });

  it("keeps going when docker is unavailable", async () => {
    mocks.probeDocker.mockRejectedValue(new Error("docker: not found"));
    mocks.composeStatus.mockRejectedValue(new Error("Docker isn't installed"));
    const result = await runCli(sandbox, ["status"]);
    expect(result.code).toBe(0);
    expect(result.out.join("\n")).toContain("Docker:    unavailable: docker: not found");
  });

  it("aligns the services under their heading", () => {
    const lines = describeStatus({
      version: "0.1.0",
      configFile: "/c.json",
      onboarding: { completed: true, step: null },
      connection: null,
      docker: { ready: true, kind: "desktop", version: "4.40", problem: null },
      stack: null,
      services: [
        { service: "sandbox", container: "a", state: "running", health: "healthy" },
        { service: "tailscale", container: "b", state: "exited", health: null },
      ],
      android: { sdkRoot: "/sdk", avd: null, avds: [] },
    });
    expect(lines).toEqual([
      "Tesseract 0.1.0",
      "Sandbox:   not paired (run tesseract sandbox build or tesseract pair)",
      "Docker:    Docker Desktop 4.40",
      "Stack:     not configured",
      "Services:  sandbox    running  healthy",
      "           tailscale  exited",
      "Android:   no default emulator · /sdk",
      "Setup:     complete",
      "Config:    /c.json",
    ]);
  });
});
