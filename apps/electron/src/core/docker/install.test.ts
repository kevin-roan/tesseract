import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { DockerInstallRequest, DockerPhase } from "../../shared/contracts/docker";
import { installDocker, installDocsKey, installOptions, isCompleteGetDockerScript } from "./install";
import type { DockerHost } from "./system";
import { fakeSystem, type FakeSystem, type FakeSystemOptions } from "./testing/fake-system";
import { CLI_VERSION, INFO_JSON_ENGINE, OS_RELEASE_ARCH, OS_RELEASE_UBUNTU, OS_RELEASE_VOID, VERSION_JSON_ENGINE } from "./testing/fixtures";

const LINUX: Partial<DockerHost> = { platform: "linux", arch: "x64", home: "/home/dev", user: "dev", release: "6.8.0" };
const MAC: Partial<DockerHost> = { platform: "darwin", arch: "arm64", home: "/Users/dev", user: "dev", release: "24.1.0" };
const SCRIPT = "#!/bin/sh\necho installing docker\ndo_install\n";
const DMG = Buffer.from("fake dmg");
const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fakeFetch(routes: Record<string, string | Buffer>): typeof fetch {
  return async (input) => {
    const url = String(input);
    const body = routes[url];
    if (body === undefined) return new Response("missing", { status: 404 });
    return new Response(typeof body === "string" ? body : new Uint8Array(body), { status: 200, headers: { "content-length": String(body.length) } });
  };
}

async function install(request: DockerInstallRequest, options: FakeSystemOptions, host: Partial<DockerHost> = LINUX) {
  const dir = mkdtempSync(join(tmpdir(), "monolith-test-docker-install-"));
  dirs.push(dir);
  const system: FakeSystem = fakeSystem(options);
  const phases: DockerPhase[] = [];
  const logs: string[] = [];
  const result = await installDocker(request, {
    system,
    host,
    env: {},
    downloadsDir: dir,
    onPhase: (phase) => phases.push(phase),
    onLog: (line) => logs.push(line),
  }).catch((error: unknown) => error);
  return { result, phases, logs, system, dir };
}

const engine = (accept = false): DockerInstallRequest => ({ option: "engine", acceptLicense: accept });

describe("installDocker on Linux", () => {
  it("runs the convenience script, enable and usermod in one pkexec prompt", async () => {
    const { result, system, logs, dir } = await install(engine(), {
      binaries: { pkexec: "/usr/bin/pkexec" },
      files: { "/etc/os-release": OS_RELEASE_UBUNTU },
      fetch: fakeFetch({ "https://get.docker.com": SCRIPT }),
      commands: { pkexec: { code: 0, stdout: "# Executing docker install script" }, "id -nG": { stdout: "dev wheel" } },
    });
    expect(result).toEqual({ kind: "needs-relogin" });
    const script = join(dir, "get-docker.sh");
    expect(system.calls).toContain(`pkexec sh -c sh '${script}' && systemctl enable --now docker.service && usermod -aG docker 'dev'`);
    expect(logs).toContain(`sha256 ${createHash("sha256").update(SCRIPT).digest("hex")}  get-docker.sh`);
    expect(logs).toContain("# Executing docker install script");
  });

  it("installs Arch packages without downloading a script", async () => {
    const { result, system } = await install(engine(), {
      binaries: { pkexec: "/usr/bin/pkexec" },
      files: { "/etc/os-release": OS_RELEASE_ARCH },
      commands: { pkexec: { code: 0 }, "id -nG": { stdout: "dev" } },
    });
    expect(result).toEqual({ kind: "needs-relogin" });
    expect(system.calls[0]).toMatch(/^pkexec sh -c pacman -S --needed --noconfirm docker docker-compose docker-buildx && /);
  });

  it("treats a dismissed prompt as cancelled", async () => {
    const { result } = await install(engine(), {
      binaries: { pkexec: "/usr/bin/pkexec" },
      files: { "/etc/os-release": OS_RELEASE_ARCH },
      commands: { pkexec: { code: 126 } },
    });
    expect(result).toMatchObject({ code: "cancelled", message: "Installation cancelled" });
  });

  it("falls back to manual commands without pkexec or on unknown distros", async () => {
    const noPkexec = await install(engine(), { files: { "/etc/os-release": OS_RELEASE_UBUNTU } });
    expect(noPkexec.result).toMatchObject({ kind: "blocked", commands: expect.arrayContaining(["sudo sh get-docker.sh"]) });
    expect(noPkexec.logs).toContain("sudo sh get-docker.sh");
    expect(noPkexec.system.calls).toEqual([]);

    const unknown = await install(engine(), { binaries: { pkexec: "/usr/bin/pkexec" }, files: { "/etc/os-release": OS_RELEASE_VOID } });
    expect(unknown.result).toMatchObject({
      kind: "blocked",
      reason: "Monolith can't install Docker on this system automatically. Run the commands below in a terminal.",
    });
    expect(unknown.result).toHaveProperty("commands");
  });

  it("adds the user to the docker group", async () => {
    const { result, system } = await install({ option: "docker-group", acceptLicense: false }, {
      binaries: { pkexec: "/usr/bin/pkexec" },
      commands: { pkexec: { code: 0 }, "id -nG": { stdout: "dev" } },
    });
    expect(result).toEqual({ kind: "needs-relogin" });
    expect(system.calls[0]).toBe("pkexec sh -c getent group docker >/dev/null || groupadd docker; usermod -aG docker 'dev'");
  });

  it("re-checks instead of asking for a re-login when the group already applies", async () => {
    const { result } = await install({ option: "kvm-group", acceptLicense: false }, {
      binaries: { pkexec: "/usr/bin/pkexec", docker: "/usr/bin/docker" },
      paths: ["/run/systemd/system"],
      commands: {
        pkexec: { code: 0 },
        "id -nG": { stdout: "dev kvm docker" },
        "getent group": { stdout: "docker:x:961:dev" },
        "docker --version": { stdout: CLI_VERSION },
        "docker version": { stdout: VERSION_JSON_ENGINE },
        "docker info": { stdout: INFO_JSON_ENGINE },
        "systemctl is-active": { stdout: "active" },
      },
    });
    expect(result).toEqual({ kind: "ready" });
  });

  it("rejects options of other platforms", async () => {
    const { result } = await install({ option: "desktop", acceptLicense: true }, {});
    expect(result).toMatchObject({ code: "invalid_argument" });
  });
});

describe("installDocker on macOS", () => {
  const dmgUrl = "https://desktop.docker.com/mac/main/arm64/Docker.dmg";
  const sumsUrl = "https://desktop.docker.com/mac/main/arm64/checksums.txt";
  const sha = createHash("sha256").update(DMG).digest("hex");

  it("requires the license to be accepted", async () => {
    const { result } = await install({ option: "desktop", acceptLicense: false }, {}, MAC);
    expect(result).toMatchObject({ code: "invalid_argument" });
  });

  it("downloads the dmg, installs it with one admin prompt and starts Docker", async () => {
    let started = false;
    const { result, system, phases } = await install(
      { option: "desktop", acceptLicense: true },
      {
        fetch: fakeFetch({ [dmgUrl]: DMG, [sumsUrl]: `${sha} *Docker.dmg\n` }),
        binaries: { docker: "/usr/local/bin/docker" },
        commands: {
          "sw_vers -productVersion": { stdout: "15.1" },
          osascript: { code: 0 },
          "open -a Docker": () => {
            started = true;
            return { code: 0 };
          },
          "docker --version": { stdout: CLI_VERSION },
          "docker version": () => (started ? { stdout: VERSION_JSON_ENGINE } : { code: 1, stderr: "Cannot connect to the Docker daemon" }),
          "docker info": { stdout: INFO_JSON_ENGINE.replace("Arch Linux", "Docker Desktop") },
        },
      },
      MAC,
    );
    expect(result).toEqual({ kind: "ready" });
    expect(phases.map((phase) => (phase.kind === "installing" ? phase.stage : phase.kind))).toEqual(
      expect.arrayContaining(["downloading", "verifying", "installing", "starting"]),
    );
    expect(system.calls.find((call) => call.startsWith("osascript"))).toContain("with administrator privileges");
  });

  it("blocks on macOS older than the appcast minimum", async () => {
    const { result } = await install(
      { option: "desktop", acceptLicense: true },
      { commands: { "sw_vers -productVersion": { stdout: "13.6" } } },
      MAC,
    );
    expect(result).toEqual({ kind: "blocked", reason: "Docker Desktop needs macOS 14.0.0 or newer" });
  });

  it("turns a checksum mismatch into a blocked phase", async () => {
    const { result } = await install(
      { option: "desktop", acceptLicense: true },
      {
        fetch: fakeFetch({ [dmgUrl]: DMG, [sumsUrl]: `${"1".repeat(64)} *Docker.dmg\n` }),
        commands: { "sw_vers -productVersion": { stdout: "15.1" } },
      },
      MAC,
    );
    expect(result).toEqual({ kind: "blocked", reason: "The download of Docker.dmg is damaged (checksum mismatch). Try again." });
  });
});

describe("installDocker on Windows", () => {
  const WINDOWS: Partial<DockerHost> = { platform: "win32", arch: "x64", home: "C:\\Users\\dev", user: "dev", release: "10.0.26100" };

  it("installs WSL first and asks for a reboot", async () => {
    const exeUrl = "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe";
    const { result, system } = await install(
      { option: "desktop", acceptLicense: true },
      { fetch: fakeFetch({ [exeUrl]: DMG }), commands: { powershell: { code: 0 } } },
      WINDOWS,
    );
    expect(result).toEqual({ kind: "needs-reboot" });
    const elevated = system.calls.filter((call) => call.startsWith("powershell"));
    expect(elevated[0]).toContain("-FilePath 'wsl.exe' -ArgumentList '--install','--no-distribution'");
    expect(elevated[1]).toContain("'install','--quiet','--accept-license','--backend=wsl-2','--always-run-service'");
  });

  it("maps the docs options", () => {
    expect(installOptions("win32")).toContain("desktop-user");
    expect(installDocsKey("manual", "win32")).toBe("docker_windows_docs");
    expect(installDocsKey("manual", "linux")).toBe("docker_engine_docs");
    expect(installDocsKey("desktop-linux", "linux")).toBe("docker_desktop_linux_docs");
    expect(installDocsKey("engine", "linux")).toBeNull();
  });
});

describe("isCompleteGetDockerScript", () => {
  it("accepts only a script with the shebang and the final do_install call", async () => {
    const dir = mkdtempSync(join(tmpdir(), "monolith-test-get-docker-"));
    dirs.push(dir);
    const full = join(dir, "full.sh");
    const truncated = join(dir, "truncated.sh");
    writeFileSync(full, SCRIPT);
    writeFileSync(truncated, "#!/bin/sh\necho installing docker\n");
    expect(await isCompleteGetDockerScript(full)).toBe(true);
    expect(await isCompleteGetDockerScript(truncated)).toBe(false);
    expect(await isCompleteGetDockerScript(join(dir, "missing.sh"))).toBe(false);
  });
});
