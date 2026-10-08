import { existsSync, readFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { expect, test } from "@playwright/test";
import { buildPairingLink } from "@tesseract/protocol";
import manifest from "../package.json" with { type: "json" };
import { EXIT } from "../cli/types.ts";
import {
  buildHostCli,
  createCliHome,
  dockerAvailable,
  E2E_STACK,
  isolatedStackEnv,
  parseJson,
  runCli,
  seedAndroidCatalog,
  TEST_TOKEN,
  UNREACHABLE_URL,
  waitForFile,
  writeConfig,
  writeRecorder,
  type BuiltCli,
  type CliHome,
} from "./cli-helpers.ts";

interface ErrorBody {
  ok: false;
  error: { code: string; message: string };
}

interface DoctorBody {
  ok: boolean;
  sections: { id: string; title: string; checks: { id: string; status: string; title: string; detail: string }[] }[];
}

interface ImagesBody {
  sdkRoot: string;
  tools: { path: string; installed: string | null }[];
  systemImages: { path: string; api: number; abi: string; size: number; installed: string | null }[];
}

interface StatusBody {
  configured: boolean;
  project: string;
  services: { service: string; container: string; state: string; health: string | null }[];
}

interface PairBody {
  link: string;
  url: string;
  name: string | null;
  local: boolean;
}

const HOST_ARCH = process.arch === "arm64" ? "arm64" : "x64";
const ANDROID_SUPPORTED = !(process.platform === "linux" && HOST_ARCH === "arm64") && !(process.platform === "win32" && HOST_ARCH === "arm64");
const HAS_DOCKER = dockerAvailable();

let cli: BuiltCli;
let home: CliHome;

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  test.setTimeout(240_000);
  cli = buildHostCli();
});

test.afterAll(() => cli?.dispose());

test.beforeEach(() => {
  home = createCliHome();
});

test.afterEach(() => home?.dispose());

const run = (...args: string[]) => runCli(cli.path, args, home.env);

function withoutDockerEnv(): NodeJS.ProcessEnv {
  return { ...home.env, PATH: home.bin, DOCKER_HOST: "unix:///nonexistent/tesseract-test.sock" };
}

test.describe("version and help", () => {
  test("prints the package version", async () => {
    const json = await run("version", "--json");
    expect(json.code).toBe(EXIT.ok);
    expect(parseJson(json)).toEqual({ name: "tesseract", version: manifest.version, platform: process.platform, arch: HOST_ARCH });
    for (const args of [["version"], ["--version"]]) {
      const human = await run(...args);
      expect(human.code).toBe(EXIT.ok);
      expect(human.stdout.trim()).toBe(`tesseract ${manifest.version}`);
    }
  });

  test("lists every command", async () => {
    const result = await run("help");
    expect(result.code).toBe(EXIT.ok);
    for (const name of ["status", "open", "doctor", "sandbox", "android", "pair", "sync", "config", "version"]) {
      expect(result.stdout).toContain(name);
    }
    const config = await run("config", "--help");
    expect(config.code).toBe(EXIT.ok);
    expect(config.stdout).toContain("tesseract config set <key> <value>");
  });
});

test.describe("error codes", () => {
  const usageCases: [string, string[]][] = [
    ["unknown command", ["bogus"]],
    ["unknown flag", ["version", "--bogus"]],
    ["unknown help topic", ["help", "bogus"]],
    ["unknown config action", ["config", "bogus"]],
    ["unknown doctor section", ["doctor", "bogus"]],
    ["unknown sandbox action", ["sandbox", "bogus"]],
    ["unknown android action", ["android", "bogus"]],
    ["unknown page", ["open", "bogus"]],
    ["missing config value", ["config", "set", "appearance"]],
    ["invalid config value", ["config", "set", "zoom", "huge"]],
    ["unknown config key", ["config", "set", "notAKey", "1"]],
    ["read-only config key", ["config", "set", "token", "abc"]],
  ];

  for (const [name, args] of usageCases) {
    test(`${name} exits ${EXIT.usage} with invalid_argument`, async () => {
      const json = await run(...args, "--json");
      expect(json.code).toBe(EXIT.usage);
      const body = parseJson<ErrorBody>(json);
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("invalid_argument");
      expect(body.error.message).not.toBe("");
      const human = await run(...args);
      expect(human.code).toBe(EXIT.usage);
      expect(human.stdout).toBe("");
      expect(human.stderr.trim()).not.toBe("");
    });
  }

  test(`missing config key exits ${EXIT.error} with not_found`, async () => {
    const result = await run("config", "get", "name", "--json");
    expect(result.code).toBe(EXIT.error);
    expect(parseJson<ErrorBody>(result).error.code).toBe("not_found");
    const human = await run("config", "get", "name");
    expect(human.code).toBe(EXIT.error);
    expect(human.stderr).toMatch(/^tesseract: /);
  });

  test(`missing Docker exits ${EXIT.error} with unavailable`, async () => {
    const result = await runCli(cli.path, ["sandbox", "status", "--json"], withoutDockerEnv());
    expect(result.code).toBe(EXIT.error);
    expect(parseJson<ErrorBody>(result).error.code).toBe("unavailable");
  });
});

test.describe("config", () => {
  test("lives under the temporary HOME", async () => {
    const result = await run("config", "path", "--json");
    expect(result.code).toBe(EXIT.ok);
    const { path } = parseJson<{ path: string }>(result);
    expect(path.startsWith(home.home)).toBe(true);
    if (process.platform === "linux") expect(path).toBe(home.configFile);
  });

  test("sets, reads and unsets values", async () => {
    expect((await run("config", "set", "appearance", "Light")).code).toBe(EXIT.ok);
    expect((await run("config", "set", "zoom", "1.25", "--json")).code).toBe(EXIT.ok);
    expect((await run("config", "set", "hostShellAutostart", "off")).code).toBe(EXIT.ok);
    expect((await run("config", "set", "name", "Workstation")).code).toBe(EXIT.ok);
    expect((await run("config", "set", "customFlag", '{"a":1}', "--force")).code).toBe(EXIT.ok);

    const appearance = await run("config", "get", "appearance");
    expect(appearance.stdout.trim()).toBe("light");
    expect(parseJson(await run("config", "get", "zoom", "--json"))).toBe(1.25);
    expect(parseJson(await run("config", "get", "customFlag", "--json"))).toEqual({ a: 1 });

    const all = parseJson<Record<string, unknown>>(await run("config", "get", "--json"));
    expect(all).toMatchObject({ name: "Workstation", customFlag: { a: 1 } });

    const { path } = parseJson<{ path: string }>(await run("config", "path", "--json"));
    const onDisk = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    expect(onDisk).toMatchObject({ name: "Workstation", customFlag: { a: 1 } });

    expect((await run("config", "unset", "name")).code).toBe(EXIT.ok);
    expect((await run("config", "get", "name", "--json")).code).toBe(EXIT.error);
  });

  test("redacts the token unless --reveal", async () => {
    const link = buildPairingLink({ url: UNREACHABLE_URL, token: TEST_TOKEN, name: "tesseract-test" });
    expect((await run("config", "set", "link", link)).code).toBe(EXIT.ok);
    expect(parseJson(await run("config", "get", "url", "--json"))).toBe(UNREACHABLE_URL);
    expect(parseJson(await run("config", "get", "token", "--json"))).not.toBe(TEST_TOKEN);
    expect(JSON.stringify(parseJson(await run("config", "get", "--json")))).not.toContain(TEST_TOKEN);
    expect(parseJson(await run("config", "get", "token", "--reveal", "--json"))).toBe(TEST_TOKEN);
  });
});

test.describe("doctor", () => {
  test("reports every section as JSON", async () => {
    const result = await run("doctor", "--json");
    const report = parseJson<DoctorBody>(result);
    expect(report.sections.map((section) => section.id)).toEqual(["docker", "image", "kvm", "sdk"]);
    for (const section of report.sections) {
      expect(section.title).not.toBe("");
      expect(section.checks.length).toBeGreaterThan(0);
      for (const check of section.checks) expect(["ok", "warning", "error", "pending"]).toContain(check.status);
    }
    const hasError = report.sections.some((section) => section.checks.some((check) => check.status === "error"));
    expect(report.ok).toBe(!hasError);
    expect(result.code).toBe(report.ok ? EXIT.ok : EXIT.error);
    const image = report.sections.find((section) => section.id === "image");
    expect(image?.checks.map((check) => check.id)).toEqual(["stack"]);
    const sdk = report.sections.find((section) => section.id === "sdk");
    expect(sdk?.checks[0]?.status).toBe("warning");
  });

  test("runs only the requested sections", async () => {
    const report = parseJson<DoctorBody>(await run("doctor", "image", "sdk", "--json"));
    expect(report.sections.map((section) => section.id)).toEqual(["image", "sdk"]);
    expect(report.ok).toBe(true);
    const human = await run("doctor", "image");
    expect(human.code).toBe(EXIT.ok);
    expect(human.stdout).toContain("Sandbox image");
  });

  test("fails the docker section without Docker", async () => {
    const result = await runCli(cli.path, ["doctor", "docker", "--json"], withoutDockerEnv());
    const report = parseJson<DoctorBody>(result);
    expect(report.ok).toBe(false);
    expect(result.code).toBe(EXIT.error);
    expect(report.sections[0]?.checks.some((check) => check.status === "error")).toBe(true);
  });

  test("passes the docker section when Docker is up", async () => {
    test.skip(!HAS_DOCKER, "Docker is not available");
    const report = parseJson<DoctorBody>(await run("doctor", "docker", "--json"));
    const docker = report.sections[0];
    expect(docker?.checks.find((check) => check.id === "daemon")?.status).toBe("ok");
  });
});

test.describe("android images", () => {
  test("lists the fixture repository", async () => {
    test.skip(!ANDROID_SUPPORTED, "the host emulator is not supported on this platform");
    seedAndroidCatalog(home.userData);
    const result = await run("android", "images", "--json");
    expect(result.code, result.stderr).toBe(EXIT.ok);
    const report = parseJson<ImagesBody>(result);
    expect(report.sdkRoot.startsWith(home.home)).toBe(true);
    expect(report.tools.map((tool) => tool.path).sort()).toEqual(["emulator", "platform-tools"]);
    expect(report.tools.every((tool) => tool.installed === null)).toBe(true);
    expect(report.systemImages.length).toBeGreaterThan(0);
    const apis = report.systemImages.map((image) => image.api);
    expect(apis).toEqual([...apis].sort((a, b) => b - a));
    for (const image of report.systemImages) {
      expect(image.api).toBeGreaterThanOrEqual(30);
      expect(image.path).toMatch(/^system-images;android-\d+(\.\d+)?;google_apis;/);
      expect(image.path.endsWith(`;${image.abi}`)).toBe(true);
      expect(image.size).toBeGreaterThan(0);
      expect(image.installed).toBeNull();
    }

    const all = parseJson<ImagesBody>(await run("android", "images", "--all", "--json"));
    expect(all.systemImages.length).toBeGreaterThanOrEqual(report.systemImages.length);

    const human = await run("android", "images");
    expect(human.code).toBe(EXIT.ok);
    expect(human.stdout).toContain(report.sdkRoot);
    expect(human.stdout).toContain(report.systemImages[0]?.path ?? "");

    const sdk = join(home.dir, "custom-sdk");
    const custom = parseJson<ImagesBody>(await run("android", "images", "--sdk", sdk, "--json"));
    expect(custom.sdkRoot).toBe(sdk);
  });

  test("lists no emulators in a fresh HOME", async () => {
    const result = await run("android", "avd", "list", "--json");
    expect(result.code).toBe(EXIT.ok);
    expect(parseJson(result)).toEqual({ default: null, avds: [] });
  });
});

test.describe("sandbox status", () => {
  test("reports an empty isolated project", async () => {
    test.skip(!HAS_DOCKER, "Docker is not available");
    isolatedStackEnv(home.userData);
    const result = await run("sandbox", "status", "--json");
    expect(result.code, result.stderr).toBe(EXIT.ok);
    const status = parseJson<StatusBody>(result);
    expect(status.configured).toBe(true);
    expect(status.project.startsWith("tesseract-test-")).toBe(true);
    expect(status.services).toEqual([]);
  });

  test("reports the e2e stack", async () => {
    test.skip(!E2E_STACK.url || !E2E_STACK.envFile, "TESSERACT_E2E_URL is not set");
    writeConfig(home.configFile, {
      sandboxStack: { envFile: E2E_STACK.envFile, project: E2E_STACK.project, image: E2E_STACK.image, mode: "local", components: [] },
    });
    const result = await run("sandbox", "status", "--json");
    expect(result.code, result.stderr).toBe(EXIT.ok);
    const status = parseJson<StatusBody>(result);
    expect(status.project).toBe(E2E_STACK.project);
    const sandbox = status.services.find((service) => service.service === "sandbox");
    expect(sandbox?.state).toBe("running");
    const human = await run("sandbox", "status");
    expect(human.stdout).toContain(sandbox?.container ?? "");
  });
});

test.describe("pair", () => {
  test("prints the saved connection", async () => {
    isolatedStackEnv(home.userData);
    const link = buildPairingLink({ url: UNREACHABLE_URL, token: TEST_TOKEN, name: "tesseract-test" });
    expect((await run("config", "set", "link", link)).code).toBe(EXIT.ok);

    const json = await run("pair", "--json");
    expect(json.code, json.stderr).toBe(EXIT.ok);
    const info = parseJson<PairBody>(json);
    expect(info).toEqual({ link, url: UNREACHABLE_URL, name: "tesseract-test", local: true });

    const plain = await run("pair", "--no-qr");
    expect(plain.code).toBe(EXIT.ok);
    expect(plain.stdout).toContain(link);
    expect(plain.stdout).not.toMatch(/[█▀▄]/);

    const qr = await run("sandbox", "pair");
    expect(qr.code).toBe(EXIT.ok);
    expect(qr.stdout).toContain(link);
    expect(qr.stdout).toMatch(/[█▀▄]/);
  });

  test(`fails with ${EXIT.error} when nothing is paired`, async () => {
    isolatedStackEnv(home.userData);
    const result = await run("pair", "--json");
    expect(result.code).toBe(EXIT.error);
    expect(parseJson<ErrorBody>(result).error.code).not.toBe("invalid_argument");
  });

  test("pairs with the e2e stack", async () => {
    test.skip(!E2E_STACK.url || !E2E_STACK.envFile, "TESSERACT_E2E_URL is not set");
    writeConfig(home.configFile, {
      sandboxStack: { envFile: E2E_STACK.envFile, project: E2E_STACK.project, image: E2E_STACK.image, mode: "local", components: [] },
    });
    const result = await run("pair", "--json");
    expect(result.code, result.stderr).toBe(EXIT.ok);
    const info = parseJson<PairBody>(result);
    expect(info.link).toMatch(/^tesseract:\/\/pair\?/);
    expect(info.link).toContain(encodeURIComponent(E2E_STACK.token));
    expect(new URL(info.url).port).toBe(new URL(E2E_STACK.url).port);
    expect(info.local).toBe(true);
  });
});

test.describe("open", () => {
  test.skip(process.platform === "win32", "the launch recorders are POSIX shell scripts");

  test("launches the app on the requested page", async () => {
    const app = writeRecorder(home.bin, "tesseract-app");
    const env = { ...home.env, TESSERACT_APP_PATH: app.path };
    const result = await runCli(cli.path, ["open", "agents", "--json"], env);
    expect(result.code, result.stderr).toBe(EXIT.ok);
    expect(parseJson(result)).toEqual({ via: "app", target: app.path, page: "agents" });
    expect((await waitForFile(app.log)).trim().split("\n")).toEqual(["--page", "agents"]);

    const human = await runCli(cli.path, ["open"], env);
    expect(human.code).toBe(EXIT.ok);
    expect(human.stdout).toContain(app.path);
  });

  test("falls back to the tesseract:// link", async () => {
    test.skip(process.platform !== "linux", "xdg-open is the Linux opener");
    test.skip(existsSync("/opt/Tesseract/tesseract-desktop"), "an installed Tesseract app would be launched");
    const opener = writeRecorder(home.bin, "xdg-open");
    const env = { ...home.env, PATH: [home.bin, process.env.PATH ?? ""].join(delimiter) };
    const result = await runCli(cli.path, ["open", "terminals", "--json"], env);
    expect(result.code, result.stderr).toBe(EXIT.ok);
    expect(parseJson(result)).toEqual({ via: "link", target: "tesseract://terminals", page: "terminals" });
    expect((await waitForFile(opener.log)).trim()).toBe("tesseract://terminals");
  });

  test(`exits ${EXIT.error} when nothing can open the app`, async () => {
    test.skip(process.platform !== "linux", "the opener lookup is Linux specific");
    test.skip(existsSync("/opt/Tesseract/tesseract-desktop"), "an installed Tesseract app would be launched");
    const result = await runCli(cli.path, ["open", "--json"], { ...home.env, PATH: home.bin });
    expect(result.code).toBe(EXIT.error);
    expect(parseJson<ErrorBody>(result).error.code).toBe("not_found");
  });
});
