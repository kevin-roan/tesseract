import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeDocker, failed, ok } from "../sandbox/test-support";
import type { PathEnvironment } from "../paths";
import { migrateLegacyInstall } from "./dirs";
import { migrateLegacyStack, volumeMarker, type LegacyStackTarget } from "./docker";
import { migrateEnvFile, migrateEnvText } from "./env";
import { LEGACY_LABELS } from "./labels";

let dir: string;
let home: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tesseract-test-legacy-"));
  home = join(dir, "home");
  mkdirSync(home, { recursive: true });
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

function write(path: string, text: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text);
}

function linux(env: Record<string, string> = {}): PathEnvironment {
  return { platform: "linux", env: { HOME: home, ...env }, home };
}

describe("migrateEnvText", () => {
  it("renames legacy keys without a TESSERACT_ counterpart and moves default names", () => {
    const text = [
      "# comment",
      "THEONE_MODE=tailscale",
      "THEONE_COMPOSE_PROJECT=theone",
      'THEONE_IMAGE="theone/sandbox:latest"',
      "THEONE_VOLUME_PREFIX=",
      "THEONE_HOSTNAME=theone-sandbox",
      "export MONOLITH_TOKEN=abc",
      "THEONE_BIND_ADDR=1.2.3.4",
      "TESSERACT_BIND_ADDR=5.6.7.8",
      "MONOLITH_DIND=1",
      "THEONE_DIND=0",
      "TS_AUTHKEY=x",
      "",
    ].join("\n");
    const result = migrateEnvText(text);
    expect(result.text.split("\n")).toEqual([
      "# comment",
      "TESSERACT_MODE=tailscale",
      "TESSERACT_COMPOSE_PROJECT=tesseract",
      "TESSERACT_IMAGE=tesseract/sandbox:latest",
      "TESSERACT_VOLUME_PREFIX=",
      "TESSERACT_HOSTNAME=theone-sandbox",
      "export TESSERACT_TOKEN=abc",
      "THEONE_BIND_ADDR=1.2.3.4",
      "TESSERACT_BIND_ADDR=5.6.7.8",
      "MONOLITH_DIND=1",
      "TESSERACT_DIND=0",
      "TS_AUTHKEY=x",
      "",
    ]);
    expect(result.renamed).toEqual([
      "THEONE_MODE",
      "THEONE_COMPOSE_PROJECT",
      "THEONE_IMAGE",
      "THEONE_VOLUME_PREFIX",
      "THEONE_HOSTNAME",
      "MONOLITH_TOKEN",
      "THEONE_DIND",
    ]);
  });

  it("keeps explicit custom project names", () => {
    expect(migrateEnvText("THEONE_COMPOSE_PROJECT=theone-test-a\n").text).toBe("TESSERACT_COMPOSE_PROJECT=theone-test-a\n");
    expect(migrateEnvText("TESSERACT_MODE=local\n")).toEqual({ text: "TESSERACT_MODE=local\n", renamed: [] });
  });
});

describe("migrateEnvFile", () => {
  it("keeps the original as .env.legacy-backup and timestamps a second backup", () => {
    const file = join(dir, ".env");
    writeFileSync(file, "THEONE_MODE=local\n");
    expect(migrateEnvFile(file)).toBe(`${file}.legacy-backup`);
    expect(readFileSync(file, "utf8")).toBe("TESSERACT_MODE=local\n");
    expect(readFileSync(`${file}.legacy-backup`, "utf8")).toBe("THEONE_MODE=local\n");
    expect(migrateEnvFile(file)).toBeNull();
    writeFileSync(file, "MONOLITH_DIND=1\n");
    expect(migrateEnvFile(file, new Date("2026-10-08T12:34:56Z"))).toBe(`${file}.legacy-backup.20261008123456`);
    expect(migrateEnvFile(join(dir, "missing.env"))).toBeNull();
  });
});

describe("migrateLegacyInstall", () => {
  it("copies the Monolith userData, config and state dirs once and points the config at the copies", () => {
    const oldData = join(home, ".config", "Monolith");
    const newData = join(home, ".config", "Tesseract");
    write(join(oldData, "sandbox", ".env"), "THEONE_MODE=local\nTHEONE_COMPOSE_PROJECT=theone\n");
    write(join(oldData, "server.json"), "{}\n");
    write(join(oldData, "GPUCache", "data"), "x");
    write(join(oldData, "android-sdk", "emulator", "emulator"), "x");
    write(join(oldData, "sandbox", "GPUCache"), "kept below the top level");
    write(join(oldData, "SingletonLock"), "host-1");
    const stack = { envFile: join(oldData, "sandbox", ".env"), project: "theone", image: "theone/sandbox:latest", mode: "local" };
    write(join(home, ".config", "monolith-desktop", "config.json"), JSON.stringify({ sandboxStack: stack, appearance: "dark" }));
    write(join(home, ".config", "theone-desktop", "config.json"), JSON.stringify({ old: true }));
    write(join(home, ".local", "state", "monolith", "sync.json"), "{}");

    const report = migrateLegacyInstall(linux());

    expect(report.copied.map((entry) => entry.to)).toEqual([newData, join(home, ".config", "tesseract-desktop"), join(home, ".local", "state", "tesseract")]);
    expect(existsSync(join(newData, "server.json"))).toBe(true);
    expect(existsSync(join(newData, "sandbox", "GPUCache"))).toBe(true);
    expect(existsSync(join(newData, "GPUCache"))).toBe(false);
    expect(existsSync(join(newData, "android-sdk"))).toBe(false);
    expect(existsSync(join(newData, "SingletonLock"))).toBe(false);
    expect(existsSync(join(oldData, "server.json"))).toBe(true);
    expect(existsSync(join(home, ".local", "state", "tesseract", "sync.json"))).toBe(true);

    const config = JSON.parse(readFileSync(join(home, ".config", "tesseract-desktop", "config.json"), "utf8"));
    expect(config).toEqual({
      appearance: "dark",
      sandboxStack: { envFile: join(newData, "sandbox", ".env"), project: "tesseract", image: "tesseract/sandbox:latest", mode: "local" },
    });
    expect(readFileSync(join(newData, "sandbox", ".env"), "utf8")).toBe("TESSERACT_MODE=local\nTESSERACT_COMPOSE_PROJECT=tesseract\n");
    expect(readFileSync(join(newData, "sandbox", ".env.legacy-backup"), "utf8")).toContain("THEONE_MODE=local");
    expect(readFileSync(join(oldData, "sandbox", ".env"), "utf8")).toContain("THEONE_MODE=local");

    write(join(oldData, "late.json"), "{}");
    expect(migrateLegacyInstall(linux()).copied).toEqual([]);
    expect(existsSync(join(newData, "late.json"))).toBe(false);
  });

  it("falls back to theone-desktop and skips dirs set through the environment", () => {
    write(join(home, ".config", "theone-desktop", "config.json"), "{}");
    write(join(home, ".config", "Monolith", "server.json"), "{}");
    const report = migrateLegacyInstall(linux({ TESSERACT_USER_DATA: join(dir, "custom") }));
    expect(report.copied).toEqual([{ from: join(home, ".config", "theone-desktop"), to: join(home, ".config", "tesseract-desktop") }]);
    expect(existsSync(join(home, ".config", "Tesseract"))).toBe(false);
  });

  it("keeps using the Android SDK that lived in the macOS Monolith folder", () => {
    const support = join(home, "Library", "Application Support");
    write(join(support, "Monolith", "config.json"), JSON.stringify({ androidAvd: "Monolith_API_35" }));
    write(join(support, "Monolith", "android-sdk", "platform-tools", "adb"), "x");
    const report = migrateLegacyInstall({ platform: "darwin", env: {}, home });
    expect(report.sdkRoot).toBe(join(support, "Monolith", "android-sdk"));
    expect(JSON.parse(readFileSync(join(support, "Tesseract", "config.json"), "utf8"))).toEqual({
      androidAvd: "Monolith_API_35",
      androidSdkRoot: join(support, "Monolith", "android-sdk"),
    });
    expect(existsSync(join(support, "Tesseract", "android-sdk"))).toBe(false);
  });
});

describe("migrateLegacyStack", () => {
  function target(overrides: Partial<LegacyStackTarget> = {}): LegacyStackTarget {
    const env = { HOME: home, XDG_STATE_HOME: join(dir, "state") };
    return { project: "tesseract", volumePrefix: "tesseract", image: "tesseract/sandbox:latest", env, hostEnv: env, ...overrides };
  }

  function lines(docker: FakeDocker): string[] {
    return docker.calls.map((call) => call.args.join(" "));
  }

  function legacyDocker(existing: string[], images: string[], copy = ok(), inUse: string[] = []): FakeDocker {
    return new FakeDocker().onRun((args) => {
      const line = args.join(" ");
      if (args[0] === "volume" && args[1] === "rm" && inUse.includes(args[2] as string)) return failed("volume is in use");
      if (line.startsWith("ps --quiet")) return ok("abc123\n");
      if (line.startsWith("compose --project-name theone down")) return ok();
      if (args[0] === "volume" && args[1] === "inspect") return existing.includes(args[2] as string) ? ok("[]") : failed("no such volume");
      if (args[0] === "image") return images.includes(args.at(-1) as string) ? ok("sha256:1") : failed("no such image");
      if (args[0] === "volume" || args[0] === "tag") return ok();
      if (args[0] === "run") return copy;
      return undefined;
    });
  }

  it("stops the theone project and moves missing volumes once, without reusing the old image", async () => {
    const docker = legacyDocker(["theone-workspace", "theone-home", "theone-tailscale", "theone-tailscale-run", "tesseract-home"], ["theone/sandbox:latest"]);
    const logs: string[] = [];
    const report = await migrateLegacyStack(docker.deps() as never, target(), (line) => logs.push(line));
    expect(report).toEqual({ stoppedLegacy: true, copiedVolumes: ["tesseract-workspace", "tesseract-tailscale"] });
    const calls = lines(docker);
    expect(calls).toContain("ps --quiet --filter label=com.docker.compose.project=theone");
    expect(calls).toContain("compose --project-name theone down --remove-orphans");
    expect(calls.filter((line) => line.startsWith("compose")).some((line) => /--volumes|\s-v\b/.test(line))).toBe(false);
    expect(calls.some((line) => line.startsWith("tag "))).toBe(false);
    expect(calls).toContain(
      "volume create --label com.docker.compose.project=tesseract --label com.docker.compose.volume=tesseract-workspace tesseract-workspace",
    );
    expect(calls).toContain(
      "run --rm --network none --user 0:0 --entrypoint /bin/sh -v theone-workspace:/from:ro -v tesseract-workspace:/to theone/sandbox:latest -c cp -a /from/. /to/",
    );
    expect(calls.some((line) => line.includes("tailscale-run"))).toBe(false);
    expect(calls.filter((line) => line.startsWith("volume rm"))).toEqual(["volume rm theone-workspace", "volume rm theone-tailscale"]);
    expect(calls.indexOf("volume rm theone-workspace")).toBeGreaterThan(calls.findIndex((line) => line.includes("-v theone-workspace:/from:ro")));
    expect(existsSync(volumeMarker(target()))).toBe(true);
    expect(logs.some((line) => line.includes("theone-workspace"))).toBe(true);

    const again = legacyDocker(["theone-workspace"], ["theone/sandbox:latest"]);
    expect((await migrateLegacyStack(again.deps() as never, target())).copiedVolumes).toEqual([]);
    expect(lines(again).some((line) => line.startsWith("run"))).toBe(false);
  });

  it("removes the half-made volume and stops when a copy fails", async () => {
    const docker = legacyDocker(["theone-workspace"], ["tesseract/sandbox:latest"], failed("disk full"));
    await expect(migrateLegacyStack(docker.deps() as never, target())).rejects.toThrow(/theone-workspace to tesseract-workspace failed/);
    expect(lines(docker)).toContain("volume rm tesseract-workspace");
    expect(lines(docker)).not.toContain("volume rm theone-workspace");
    expect(existsSync(volumeMarker(target()))).toBe(false);
  });

  it("reports an old volume it cannot remove and still finishes", async () => {
    const docker = legacyDocker(["theone-home"], ["tesseract/sandbox:latest"], ok(), ["theone-home"]);
    const logs: string[] = [];
    const report = await migrateLegacyStack(docker.deps() as never, target(), (line) => logs.push(line));
    expect(report.copiedVolumes).toEqual(["tesseract-home"]);
    expect(logs).toContain(LEGACY_LABELS.oldVolumeKept("theone-home", "tesseract-home"));
    expect(existsSync(volumeMarker(target()))).toBe(true);
  });

  it("skips custom projects, custom prefixes and TESSERACT_SKIP_LEGACY_MIGRATION", async () => {
    const custom = legacyDocker(["theone-workspace"], ["theone/sandbox:latest"]);
    await migrateLegacyStack(custom.deps() as never, target({ project: "theone" }));
    expect(custom.calls).toEqual([]);

    const prefixed = legacyDocker(["theone-workspace"], ["tesseract/sandbox:latest"]);
    const report = await migrateLegacyStack(prefixed.deps() as never, target({ volumePrefix: "theone" }));
    expect(report.stoppedLegacy).toBe(true);
    expect(lines(prefixed).some((line) => line.startsWith("volume"))).toBe(false);

    const skipped = legacyDocker(["theone-workspace"], ["theone/sandbox:latest"]);
    const env = { ...target().hostEnv, TESSERACT_SKIP_LEGACY_MIGRATION: "1" };
    await migrateLegacyStack(skipped.deps() as never, target({ hostEnv: env }));
    expect(skipped.calls).toEqual([]);
  });
});
