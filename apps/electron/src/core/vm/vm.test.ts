import { describe, expect, it } from "vitest";
import type { DockerHost } from "../docker/system";
import { fakeSystem, type FakeSystemOptions } from "../docker/testing/fake-system";
import { colimaConfig, resolveSize } from "./config";
import { setupVm, startVm, stopVm, vmStatus } from "./index";
import { sysboxProvisionScript } from "./provision";
import { colimaRewrite } from "./testing/colima-rewrite";
import { mergePluginsDir, parseActiveServices, parseColimaList, parseRuntimes } from "./vm";

const MAC: Partial<DockerHost> = { platform: "darwin", arch: "arm64", home: "/Users/dev", user: "dev", release: "24.1.0" };
const LINUX: Partial<DockerHost> = { platform: "linux", arch: "x64", home: "/home/dev", user: "dev", release: "6.8.0" };
const RESOURCES = "/Applications/Tesseract.app/Contents/Resources/sandbox";
const CONFIG = "/Users/dev/.colima/tesseract/colima.yaml";
const DOCKER_CONFIG = "/Users/dev/.docker/config.json";
const BREW = "/opt/homebrew/bin/brew";
const RUNTIMES_SYSBOX = '{"io.containerd.runc.v2":{"path":"runc"},"runc":{"path":"runc"},"sysbox-runc":{"path":"/usr/bin/sysbox-runc"}}';
const RUNTIMES_PLAIN = '{"io.containerd.runc.v2":{"path":"runc"},"runc":{"path":"runc"}}';
const LIST_RUNNING = '{"name":"tesseract","status":"Running","arch":"aarch64","cpus":6,"memory":5368709120,"disk":128849018880,"runtime":"docker"}';
const LIST_BROKEN = '{"name":"tesseract","status":"Broken","arch":"aarch64","cpus":6,"memory":5368709120,"disk":128849018880}';
const SERVICES = "colima ssh -p tesseract -- systemctl is-active sysbox-mgr sysbox-fs";
const SERVICES_ACTIVE = { code: 0, stdout: "active\nactive\n" };
const SERVICES_INACTIVE = { code: 1, stdout: "inactive\ninactive\n" };
const PROVISION = "colima ssh -p tesseract -- sudo sh -s";
const LIST_STOPPED = '{"name":"default","status":"Running","cpus":2}\n{"name":"tesseract","status":"Stopped","arch":"aarch64","cpus":4,"memory":4294967296,"disk":107374182400}';

const ALL_BINARIES = {
  colima: "/opt/homebrew/bin/colima",
  limactl: "/opt/homebrew/bin/limactl",
  docker: "/opt/homebrew/bin/docker",
};
const PLUGINS = ["/opt/homebrew/lib/docker/cli-plugins/docker-compose", "/opt/homebrew/lib/docker/cli-plugins/docker-buildx"];

function macSystem(options: FakeSystemOptions = {}) {
  return fakeSystem({ binaries: ALL_BINARIES, paths: [BREW, ...PLUGINS], ...options });
}

async function setup(system = macSystem(), host = MAC) {
  const logs: string[] = [];
  const result = await setupVm({ system, host, env: { PATH: "/usr/bin:/bin" }, resourcesDir: RESOURCES, onLog: (line) => logs.push(line) }).catch(
    (error: unknown) => error,
  );
  return { result, logs, system };
}

describe("setupVm", () => {
  it("is unsupported outside macOS", async () => {
    const { result, system } = await setup(macSystem(), LINUX);
    expect(result).toEqual({ kind: "blocked", reason: "The Tesseract VM is only needed on macOS" });
    expect(system.calls).toEqual([]);
  });

  it("asks for Homebrew when it is missing", async () => {
    const { result, system } = await setup(fakeSystem());
    expect(result).toMatchObject({ kind: "blocked", commands: [expect.stringContaining("raw.githubusercontent.com/Homebrew/install/HEAD/install.sh")] });
    expect(system.calls).toEqual([]);
  });

  it("installs missing tools, writes the config, starts the VM and waits for sysbox", async () => {
    let installed = false;
    let infos = 0;
    const binaries: Record<string, string> = {};
    const system = fakeSystem({
      paths: [BREW],
      commands: {
        brew: () => {
          installed = true;
          Object.assign(binaries, ALL_BINARIES);
          return { code: 0, stdout: "==> Pouring colima" };
        },
        "colima list --json": { code: 0, stdout: "" },
        "colima start tesseract": { code: 0, stdout: "INFO[0001] starting colima [profile=tesseract]" },
        "docker context use colima-tesseract": { code: 0 },
        "docker --context colima-tesseract info": () => {
          infos += 1;
          return { stdout: infos > 2 ? RUNTIMES_SYSBOX : RUNTIMES_PLAIN };
        },
        [SERVICES]: SERVICES_ACTIVE,
        pgrep: { code: 1 },
      },
    });
    system.which = (name) => binaries[name] ?? null;
    const base = system.exists;
    system.exists = (path) => base(path) || (installed && PLUGINS.includes(path));
    const { result, logs } = await setup(system);
    expect(result).toEqual({ kind: "ready" });
    expect(system.calls.filter((call) => !call.startsWith("pgrep") && !call.startsWith("docker --context") && call !== SERVICES)).toEqual([
      "brew install colima docker docker-compose docker-buildx",
      "colima list --json",
      "colima start tesseract",
      "docker context use colima-tesseract",
    ]);
    expect(infos).toBe(3);
    expect(system.files[CONFIG]).toBe(colimaConfig({ arch: "aarch64", size: resolveSize(), home: "/Users/dev", resourcesDir: RESOURCES }));
    expect(JSON.parse(system.files[DOCKER_CONFIG] ?? "{}")).toEqual({ cliPluginsExtraDirs: ["/opt/homebrew/lib/docker/cli-plugins"] });
    expect(logs).toContain("==> Pouring colima");
  });

  it("keeps a hand-edited config and warns about Docker Desktop", async () => {
    const system = macSystem({
      files: { [CONFIG]: "cpu: 2\n", [DOCKER_CONFIG]: '{"auths":{},"cliPluginsExtraDirs":["/opt/homebrew/lib/docker/cli-plugins"]}' },
      commands: {
        "colima list --json": { stdout: LIST_RUNNING },
        "colima start tesseract": { code: 0 },
        "docker context use": { code: 0 },
        "docker --context colima-tesseract info": { stdout: RUNTIMES_SYSBOX },
        [SERVICES]: SERVICES_ACTIVE,
        "pgrep -x Docker Desktop": { code: 0, stdout: "123" },
      },
    });
    const { result, logs } = await setup(system);
    expect(result).toEqual({ kind: "ready" });
    expect(system.written).toEqual([]);
    expect(system.calls).not.toContain("brew install");
    expect(logs.some((line) => line.includes("edited by hand"))).toBe(true);
    expect(logs.some((line) => line.includes("Docker Desktop is running"))).toBe(true);
  });

  it("restarts a running VM that lacks sysbox", async () => {
    let started = false;
    const system = macSystem({
      commands: {
        "colima list --json": { stdout: LIST_RUNNING },
        "colima stop tesseract": { code: 0 },
        "colima start tesseract": () => {
          started = true;
          return { code: 0 };
        },
        "docker context use": { code: 0 },
        "docker --context colima-tesseract info": () => ({ stdout: started ? RUNTIMES_SYSBOX : RUNTIMES_PLAIN }),
        [SERVICES]: SERVICES_ACTIVE,
        pgrep: { code: 1 },
      },
    });
    const { result } = await setup(system);
    expect(result).toEqual({ kind: "ready" });
    expect(system.calls.indexOf("colima stop tesseract")).toBeLessThan(system.calls.indexOf("colima start tesseract"));
  });

  it("does not trust the runtime entry alone: re-runs the provision script when the services are down", async () => {
    let provisioned = false;
    const system = macSystem({
      commands: {
        "colima list --json": { stdout: "" },
        "colima start tesseract": { code: 0 },
        "docker context use": { code: 0 },
        "docker --context colima-tesseract info": { stdout: RUNTIMES_SYSBOX },
        [SERVICES]: () => (provisioned ? SERVICES_ACTIVE : SERVICES_INACTIVE),
        [PROVISION]: () => {
          provisioned = true;
          return { code: 0, stdout: "Setting up sysbox-ce (0.7.1-0) ..." };
        },
        pgrep: { code: 1 },
      },
    });
    const inputs: (string | undefined)[] = [];
    const run = system.run;
    system.run = (file, args, options) => {
      if (args.includes("sh")) inputs.push(options?.input);
      return run(file, args, options);
    };
    const { result, logs } = await setup(system);
    expect(result).toEqual({ kind: "ready" });
    expect(system.calls.filter((call) => call === PROVISION)).toHaveLength(1);
    expect(inputs).toEqual([sysboxProvisionScript()]);
    expect(logs).toContain("Setting up sysbox-ce (0.7.1-0) ...");
  });

  it("blocks with diagnostic commands when sysbox never becomes active", async () => {
    const system = macSystem({
      commands: {
        "colima list --json": { stdout: "" },
        "colima start tesseract": { code: 0 },
        "docker context use": { code: 0 },
        "docker --context colima-tesseract info": { stdout: RUNTIMES_SYSBOX },
        [SERVICES]: SERVICES_INACTIVE,
        [PROVISION]: { code: 0 },
        pgrep: { code: 1 },
      },
    });
    const { result } = await setup(system);
    expect(result).toMatchObject({
      kind: "blocked",
      reason: expect.stringContaining("Sysbox wasn't ready"),
      commands: [
        "colima ssh -p tesseract -- systemctl status sysbox-mgr sysbox-fs",
        "colima ssh -p tesseract -- sudo tail -n 50 /var/log/cloud-init-output.log",
      ],
    });
  });

  it("reports the guest error when the provision script fails", async () => {
    const system = macSystem({
      commands: {
        "colima list --json": { stdout: "" },
        "colima start tesseract": { code: 0 },
        "docker context use": { code: 0 },
        "docker --context colima-tesseract info": { stdout: RUNTIMES_PLAIN },
        [PROVISION]: { code: 1, stderr: "tesseract: can't resolve downloads.nestybox.com\ntime=\"2026-10-12T10:00:00Z\" level=fatal msg=\"exit status 1\"" },
        pgrep: { code: 1 },
      },
    });
    const { result } = await setup(system);
    expect(result).toMatchObject({ kind: "blocked", reason: expect.stringContaining("Installing Sysbox in the Tesseract VM failed: tesseract: can't resolve downloads.nestybox.com") });
  });

  it("force-stops a broken VM before starting it", async () => {
    const system = macSystem({
      commands: {
        "colima list --json": { stdout: LIST_BROKEN },
        "colima stop -f tesseract": { code: 0 },
        "colima start tesseract": { code: 0 },
        "docker context use": { code: 0 },
        "docker --context colima-tesseract info": { stdout: RUNTIMES_SYSBOX },
        [SERVICES]: SERVICES_ACTIVE,
        pgrep: { code: 1 },
      },
    });
    const { result, logs } = await setup(system);
    expect(result).toEqual({ kind: "ready" });
    expect(system.calls.indexOf("colima stop -f tesseract")).toBeGreaterThan(-1);
    expect(system.calls.indexOf("colima stop -f tesseract")).toBeLessThan(system.calls.indexOf("colima start tesseract"));
    expect(logs.some((line) => line.includes("broken state"))).toBe(true);
  });

  it("re-provisions a running VM that has the runtime but no sysbox services, without restarting it", async () => {
    let provisioned = false;
    const system = macSystem({
      commands: {
        "colima list --json": { stdout: LIST_RUNNING },
        "colima start tesseract": { code: 0 },
        "docker context use": { code: 0 },
        "docker --context colima-tesseract info": { stdout: RUNTIMES_SYSBOX },
        [SERVICES]: () => (provisioned ? SERVICES_ACTIVE : SERVICES_INACTIVE),
        [PROVISION]: () => {
          provisioned = true;
          return { code: 0 };
        },
        pgrep: { code: 1 },
      },
    });
    const { result } = await setup(system);
    expect(result).toEqual({ kind: "ready" });
    expect(system.calls.some((call) => call.startsWith("colima stop"))).toBe(false);
  });

  it("does not rewrite a config Colima has already rewritten with the same settings", async () => {
    const current = colimaRewrite(colimaConfig({ arch: "aarch64", size: resolveSize(), home: "/Users/dev", resourcesDir: RESOURCES }));
    const system = macSystem({
      files: { [CONFIG]: current, [DOCKER_CONFIG]: '{"cliPluginsExtraDirs":["/opt/homebrew/lib/docker/cli-plugins"]}' },
      commands: {
        "colima list --json": { stdout: LIST_RUNNING },
        "colima start tesseract": { code: 0 },
        "docker context use": { code: 0 },
        "docker --context colima-tesseract info": { stdout: RUNTIMES_SYSBOX },
        [SERVICES]: SERVICES_ACTIVE,
        pgrep: { code: 1 },
      },
    });
    const { result, logs } = await setup(system);
    expect(result).toEqual({ kind: "ready" });
    expect(system.written).toEqual([]);
    expect(logs).toContain(`${CONFIG} is up to date`);
  });

  it("rewrites a managed config whose settings changed", async () => {
    const old = colimaRewrite(colimaConfig({ arch: "aarch64", size: resolveSize({ cpus: 2 }), home: "/Users/dev", resourcesDir: RESOURCES }));
    const system = macSystem({
      files: { [CONFIG]: old },
      commands: {
        "colima list --json": { stdout: "" },
        "colima start tesseract": { code: 0 },
        "docker context use": { code: 0 },
        "docker --context colima-tesseract info": { stdout: RUNTIMES_SYSBOX },
        [SERVICES]: SERVICES_ACTIVE,
        pgrep: { code: 1 },
      },
    });
    await setup(system);
    expect(system.files[CONFIG]).toBe(colimaConfig({ arch: "aarch64", size: resolveSize(), home: "/Users/dev", resourcesDir: RESOURCES }));
  });

  it("reports a failed colima start", async () => {
    const system = macSystem({
      commands: { "colima list --json": { stdout: "" }, "colima start tesseract": { code: 1, stderr: "FATA[0003] error starting vm" }, pgrep: { code: 1 } },
    });
    const { result } = await setup(system);
    expect(result).toEqual({
      kind: "blocked",
      reason: "The Tesseract VM didn't start: FATA[0003] error starting vm",
      commands: ["colima start tesseract"],
    });
  });

  it("throws cancelled when aborted", async () => {
    const controller = new AbortController();
    const system = macSystem({
      commands: {
        "colima list --json": { stdout: "" },
        "colima start tesseract": () => {
          controller.abort();
          return { code: null };
        },
        pgrep: { code: 1 },
      },
    });
    const result = await setupVm({ system, host: MAC, env: {}, resourcesDir: RESOURCES, signal: controller.signal }).catch((error: unknown) => error);
    expect(result).toMatchObject({ code: "cancelled" });
  });
});

describe("startVm and stopVm", () => {
  it("starts and stops the profile", async () => {
    const system = macSystem({
      commands: {
        "colima list --json": { stdout: LIST_STOPPED },
        "colima start tesseract": { code: 0 },
        "colima stop tesseract": { code: 0 },
        "docker context use": { code: 0 },
        "docker --context colima-tesseract info": { stdout: RUNTIMES_SYSBOX },
        [SERVICES]: SERVICES_ACTIVE,
        pgrep: { code: 1 },
      },
    });
    expect(await startVm({ system, host: MAC, env: {} })).toEqual({ kind: "ready" });
    expect(await stopVm({ system, host: MAC, env: {} })).toEqual({ kind: "idle" });
    expect(system.calls).toContain("colima stop tesseract");
  });

  it("blocks when colima isn't installed", async () => {
    expect(await startVm({ system: fakeSystem(), host: MAC, env: {} })).toMatchObject({ kind: "blocked" });
  });
});

describe("vmStatus", () => {
  it("is unsupported outside macOS", async () => {
    const status = await vmStatus({ system: macSystem(), host: LINUX, env: {} });
    expect(status).toMatchObject({ state: "unsupported", profile: "tesseract", context: "colima-tesseract", sysbox: false });
  });

  it("reads a running VM", async () => {
    const system = macSystem({
      commands: {
        "colima list --json": { stdout: LIST_RUNNING },
        "docker context show": { stdout: "colima-tesseract\n" },
        "docker --context colima-tesseract info": { stdout: RUNTIMES_SYSBOX },
        [SERVICES]: SERVICES_ACTIVE,
        "pgrep -x Docker Desktop": { code: 1 },
        "pgrep -x com.docker.backend": { code: 0 },
      },
    });
    expect(await vmStatus({ system, host: MAC, env: {} })).toEqual({
      state: "running",
      profile: "tesseract",
      context: "colima-tesseract",
      tools: {
        brew: BREW,
        colima: ALL_BINARIES.colima,
        limactl: ALL_BINARIES.limactl,
        docker: ALL_BINARIES.docker,
        compose: PLUGINS[0],
        buildx: PLUGINS[1],
      },
      sysbox: true,
      activeContext: "colima-tesseract",
      active: true,
      size: { cpus: 6, memoryGb: 5, diskGb: 120 },
      dockerDesktopRunning: true,
    });
  });

  it("reports sysbox missing when the runtime is configured but the services are down", async () => {
    const system = macSystem({
      commands: {
        "colima list --json": { stdout: LIST_RUNNING },
        "docker context show": { stdout: "colima-tesseract\n" },
        "docker --context colima-tesseract info": { stdout: RUNTIMES_SYSBOX },
        [SERVICES]: SERVICES_INACTIVE,
        pgrep: { code: 1 },
      },
    });
    expect(await vmStatus({ system, host: MAC, env: {} })).toMatchObject({ state: "running", sysbox: false });
  });

  it("shows a broken VM as stopped", async () => {
    const system = macSystem({ commands: { "colima list --json": { stdout: LIST_BROKEN }, "docker context show": { stdout: "colima-tesseract" }, pgrep: { code: 1 } } });
    expect(await vmStatus({ system, host: MAC, env: {} })).toMatchObject({ state: "stopped", sysbox: false });
    expect(system.calls.some((call) => call.startsWith("colima ssh"))).toBe(false);
  });

  it("reads a stopped VM without asking docker for runtimes", async () => {
    const system = macSystem({
      commands: { "colima list --json": { stdout: LIST_STOPPED }, "docker context show": { stdout: "desktop-linux" }, pgrep: { code: 1 } },
    });
    const status = await vmStatus({ system, host: MAC, env: {} });
    expect(status).toMatchObject({ state: "stopped", sysbox: false, active: false, activeContext: "desktop-linux", size: { cpus: 4, memoryGb: 4, diskGb: 100 } });
    expect(system.calls.some((call) => call.startsWith("docker --context"))).toBe(false);
  });

  it("is missing without colima, sized from the config file", async () => {
    const system = fakeSystem({ paths: [BREW], files: { [CONFIG]: "cpu: 3\nmemory: 4\ndisk: 80\n" }, commands: { pgrep: { code: 1 } } });
    const status = await vmStatus({ system, host: MAC, env: {} });
    expect(status).toMatchObject({ state: "missing", size: { cpus: 3, memoryGb: 4, diskGb: 80 }, tools: { brew: BREW, colima: null } });
  });
});

describe("parsers", () => {
  it("parses colima list lines", () => {
    expect(parseColimaList(LIST_STOPPED).map((instance) => [instance.name, instance.status])).toEqual([
      ["default", "Running"],
      ["tesseract", "Stopped"],
    ]);
    expect(parseColimaList("not json\n")).toEqual([]);
  });

  it("parses docker runtimes", () => {
    expect(parseRuntimes(RUNTIMES_SYSBOX)).toContain("sysbox-runc");
    expect(parseRuntimes("")).toEqual([]);
  });

  it("requires every sysbox service to be active", () => {
    expect(parseActiveServices("active\nactive\n")).toBe(true);
    expect(parseActiveServices("active\ninactive\n")).toBe(false);
    expect(parseActiveServices("active\n")).toBe(false);
    expect(parseActiveServices("")).toBe(false);
  });

  it("merges the cli plugins dir without dropping keys", () => {
    const merged = mergePluginsDir('{"auths":{"x":{}},"cliPluginsExtraDirs":["/a"]}', "/b");
    expect(JSON.parse(merged ?? "")).toEqual({ auths: { x: {} }, cliPluginsExtraDirs: ["/a", "/b"] });
    expect(mergePluginsDir('{"cliPluginsExtraDirs":["/b"]}', "/b")).toBeNull();
    expect(JSON.parse(mergePluginsDir(null, "/b") ?? "")).toEqual({ cliPluginsExtraDirs: ["/b"] });
    expect(() => mergePluginsDir("[1]", "/b")).toThrow();
  });
});
