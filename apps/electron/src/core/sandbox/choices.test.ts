import { describe, expect, it } from "vitest";
import type { SetupChoices } from "../../shared/contracts/sandbox";
import { choicesFromEnv, choicesToEnv, defaultChoices, validateChoices } from "./choices";
import { parseEnvFile, serializeEnv } from "./env-file";
import { readyReport } from "./test-support";

const GIB = 1024 ** 3;
const host = { cpus: 16, memBytes: 32 * GIB, timeZone: "Europe/Paris", homeDir: "/home/u" };

function choices(overrides: Partial<SetupChoices> = {}): SetupChoices {
  return { ...defaultChoices(host, null), ...overrides };
}

describe("defaultChoices", () => {
  it("uses local mode, every component and compose defaults", () => {
    const value = defaultChoices(host, null);
    expect(value).toMatchObject({
      mode: "local",
      components: ["android", "flutter", "mono", "whisper"],
      whisperModels: ["base", "small"],
      cpus: 4,
      memoryGb: 8,
      timeZone: "Europe/Paris",
      project: "theone",
      image: "theone/sandbox:latest",
      controllerPort: 7700,
      vncPort: 5901,
      hostClaudeDir: "/home/u/.claude",
      dind: false,
    });
  });

  it("clamps CPUs and memory to the engine", () => {
    const report = readyReport({ server: { ...readyReport().server!, ncpu: 2, memBytes: 6 * GIB } });
    expect(defaultChoices(host, report)).toMatchObject({ cpus: 2, memoryGb: 4 });
    expect(defaultChoices({ ...host, memBytes: 2 * GIB }, null).memoryGb).toBe(2);
  });
});

describe("validateChoices", () => {
  const fields = (value: SetupChoices, context = {}) => validateChoices(value, context).map((issue) => issue.field);

  it("accepts the defaults", () => {
    expect(validateChoices(choices(), { maxCpus: 16, memBytes: 32 * GIB })).toEqual([]);
  });

  it("checks names, ports and resources", () => {
    expect(fields(choices({ project: "The One" }))).toContain("project");
    expect(fields(choices({ image: "Not An Image" }))).toContain("image");
    expect(fields(choices({ controllerPort: 70000 }))).toContain("controllerPort");
    expect(fields(choices({ vncPort: 7700 }))).toContain("vncPort");
    expect(fields(choices({ cpus: 9 }), { maxCpus: 8 })).toContain("cpus");
    expect(fields(choices({ memoryGb: 1 }))).toContain("memoryGb");
    expect(fields(choices({ memoryGb: 64 }), { memBytes: 32 * GIB })).toContain("memoryGb");
    expect(fields(choices({ components: ["whisper"], whisperModels: [] }))).toEqual(["whisperModels"]);
    expect(fields(choices({ hostClaudeDir: "relative/.claude" }))).toContain("hostClaudeDir");
  });

  it("requires tailscale fields unless the node volume or a saved key exists", () => {
    const tailscale = choices({ mode: "tailscale", tailnetDomain: "", hostname: "Bad_Host" });
    expect(fields(tailscale)).toEqual(expect.arrayContaining(["tailnetDomain", "hostname", "tsAuthKey"]));
    const good = choices({ mode: "tailscale", tailnetDomain: "tail1234.ts.net" });
    expect(fields(good)).toEqual(["tsAuthKey"]);
    expect(fields(good, { tailscaleVolumeExists: true })).toEqual([]);
    expect(fields(good, { savedAuthKey: true })).toEqual([]);
  });

  it("refuses wildcard and invalid bind addresses", () => {
    const issues = (bindAddr: string) => validateChoices(choices({ mode: "host-tailscale", bindAddr }));
    expect(issues("100.64.0.1")).toEqual([]);
    expect(issues("")[0]?.field).toBe("bindAddr");
    expect(issues("0.0.0.0")[0]?.message).toMatch(/every host interface/);
    expect(issues("010.1.1.1")[0]?.message).toMatch(/not an IPv4 address/);
    expect(issues("0.1.2.3")[0]?.message).toMatch(/not an IPv4 address/);
  });
});

describe("env mapping", () => {
  it("writes the spec's keys, binds local mode to 127.0.0.1 and orders whisper models", () => {
    const env = choicesToEnv(
      choices({ components: ["android", "whisper"], whisperModels: ["small", "base"], memoryGb: 6 }),
      { uid: 1000, gid: 1001 },
      { token: "tok" },
    );
    expect(env).toMatchObject({
      THEONE_MODE: "local",
      THEONE_BIND_ADDR: "127.0.0.1",
      THEONE_DIND: "",
      TS_AUTHKEY: "",
      WITH_ANDROID: "true",
      WITH_FLUTTER: "false",
      WITH_MONO: "false",
      WITH_WHISPER: "true",
      WHISPER_MODELS: "base small",
      SANDBOX_MEMORY: "6g",
      DEV_GID: "1001",
      THEONE_TOKEN: "tok",
    });
  });

  it("round-trips through the env file", () => {
    const original = choices({
      mode: "tailscale",
      tsAuthKey: "tskey-auth-1",
      tailnetDomain: "tail1.ts.net",
      hostname: "box",
      components: ["flutter", "mono"],
      cpus: 3,
      memoryGb: 5,
      dind: true,
      hostClaudeDir: "/home/u/my claude",
    });
    const text = serializeEnv(choicesToEnv(original, { uid: 1, gid: 1 }, { token: "t" }));
    expect(choicesFromEnv(parseEnvFile(text), choices())).toEqual(original);
  });

  it("keeps a saved auth key when the form leaves it empty", () => {
    const env = choicesToEnv(choices({ mode: "tailscale", tailnetDomain: "a.ts.net" }), { uid: 1, gid: 1 }, { token: "t", tsAuthKey: "tskey-old" });
    expect(env.TS_AUTHKEY).toBe("tskey-old");
  });
});
