import { describe, expect, it } from "vitest";
import { DiscoveryError, type ContainerRunner } from "./container-cli";
import {
  candidateApiUrls,
  composeProject,
  containerNetwork,
  discoverDocker,
  parseInspect,
  parsePairJson,
  sandboxContainer,
  stackProject,
} from "./discovery";
import { pairingLinkFor } from "./pairing";

const TOKEN = "q3Jx0mZ8yWv1_bT7-kLp2sR4nC6dE9fG0hI1jK2lM3n";
const PAIR_URL = "https://theone-sandbox.tail1.ts.net";
const PAIR_OUTPUT = JSON.stringify({
  link: `theone://pair?url=https%3A%2F%2Ftheone-sandbox.tail1.ts.net&token=${TOKEN}&name=theone-sandbox`,
  url: PAIR_URL,
  name: "theone-sandbox",
});

function inspectJson({ ports = {}, networks = {}, mode = "bridge" }: { ports?: object; networks?: object; mode?: string } = {}) {
  return JSON.stringify([{ HostConfig: { NetworkMode: mode }, NetworkSettings: { Ports: ports, Networks: networks } }]);
}

describe("container naming", () => {
  it("follows the compose project", () => {
    expect(sandboxContainer({})).toBe("theone-sandbox-1");
    expect(sandboxContainer({ THEONE_COMPOSE_PROJECT: "e2e" })).toBe("e2e-sandbox-1");
    expect(composeProject({ THEONE_COMPOSE_PROJECT: "" })).toBe("theone");
  });

  it("reads the stack project saved by the wizard", () => {
    expect(stackProject({ sandboxStack: { project: "monolith" } })).toBe("monolith");
    expect(stackProject({ sandboxStack: { project: "Bad Name" } })).toBeNull();
    expect(stackProject({})).toBeNull();
  });
});

describe("parsePairJson", () => {
  it("extracts url, token and name from the last JSON line", () => {
    const info = parsePairJson(`warning: noise\n${PAIR_OUTPUT}\n`);
    expect([info.url, info.token, info.name]).toEqual([PAIR_URL, TOKEN, "theone-sandbox"]);
  });

  it("falls back to the link's url and name", () => {
    const info = parsePairJson(JSON.stringify({ link: `theone://pair?url=http%3A%2F%2F127.0.0.1%3A7700%2Fv1&token=${TOKEN}&name=rig`, url: 5 }));
    expect(info.url).toBe("http://127.0.0.1:7700");
    expect(info.name).toBe("rig");
  });

  it("rejects garbage", () => {
    expect(() => parsePairJson("not json")).toThrow("theone-controller pair --json printed no pairing link");
    expect(() => parsePairJson(JSON.stringify({ link: "theone://pair?url=x" }))).toThrow(
      /^controller printed an invalid pairing link: /,
    );
  });
});

describe("parseInspect", () => {
  it("reads published ports, networks and the shared namespace", () => {
    const network = parseInspect(
      inspectJson({
        ports: { "7700/tcp": [{ HostIp: "127.0.0.1", HostPort: "7700" }], "5901/tcp": [{ HostIp: "", HostPort: "5901" }] },
        networks: { theone_default: { IPAddress: "172.22.0.2" } },
        mode: "container:abc123",
      }),
    );
    expect(network).toEqual({ published: [["127.0.0.1", "7700"]], addresses: ["172.22.0.2"], networkContainer: "abc123" });
  });

  it("throws on invalid JSON and ignores non-objects", () => {
    expect(() => parseInspect("nope")).toThrow(DiscoveryError);
    expect(parseInspect("[]")).toEqual({ published: [], addresses: [], networkContainer: null });
  });

  it("follows a container network namespace", async () => {
    const calls: string[][] = [];
    const runner: ContainerRunner = async (args) => {
      calls.push([...args]);
      return args[1] === "theone-sandbox-1"
        ? inspectJson({ mode: "container:sidecar" })
        : inspectJson({ networks: { n: { IPAddress: "172.22.0.2" } } });
    };
    const network = await containerNetwork("theone-sandbox-1", runner);
    expect(network.addresses).toEqual(["172.22.0.2"]);
    expect(calls[1]).toEqual(["inspect", "sidecar"]);
  });
});

describe("candidateApiUrls", () => {
  it("orders and de-duplicates the candidates", () => {
    const network = { published: [["0.0.0.0", "7710"], ["100.64.0.9", "7700"]] as [string, string][], addresses: ["172.22.0.2"], networkContainer: null };
    expect(candidateApiUrls("https://sb.tail1.ts.net", network, { THEONE_BIND_ADDR: "100.64.0.9" })).toEqual([
      "http://127.0.0.1:7710",
      "http://100.64.0.9:7700",
      "http://127.0.0.1:7700",
      "http://172.22.0.2:7700",
      "https://sb.tail1.ts.net",
    ]);
  });

  it("brackets IPv6 binds and honours the host port", () => {
    const network = { published: [["::1", "7800"]] as [string, string][], addresses: [], networkContainer: null };
    expect(candidateApiUrls(null, network, { THEONE_CONTROLLER_HOST_PORT: "7800" })).toEqual([
      "http://[::1]:7800",
      "http://127.0.0.1:7800",
    ]);
  });
});

describe("discoverDocker", () => {
  const runner: ContainerRunner = async (args) =>
    args[0] === "exec" ? PAIR_OUTPUT : inspectJson({ networks: { n: { IPAddress: "172.22.0.2" } } });

  it("prefers the first reachable address in list order", async () => {
    const result = await discoverDocker({
      env: {},
      runner,
      prober: async (url) => url === "http://172.22.0.2:7700" || url === PAIR_URL,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config).toMatchObject({
      apiUrl: "http://172.22.0.2:7700",
      pairingUrl: PAIR_URL,
      token: TOKEN,
      source: "docker",
      container: "theone-sandbox-1",
    });
    expect(result.message).toBe("Found theone-sandbox at http://172.22.0.2:7700");
    expect(result.tried).toEqual([
      ["http://127.0.0.1:7700", "unreachable"],
      ["http://172.22.0.2:7700", "ok"],
    ]);
    expect(pairingLinkFor(result.config).startsWith("theone://pair?url=https%3A%2F%2Ftheone-sandbox")).toBe(true);
  });

  it("probes in parallel", async () => {
    const started: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const pending = discoverDocker({
      env: {},
      runner,
      prober: async (url) => {
        started.push(url);
        if (started.length === 3) release();
        await gate;
        return url === PAIR_URL;
      },
    });
    const result = await pending;
    expect(started).toEqual(["http://127.0.0.1:7700", "http://172.22.0.2:7700", PAIR_URL]);
    expect(result.ok && result.config.apiUrl).toBe(PAIR_URL);
  });

  it("falls back to the pairing URL when nothing answers", async () => {
    const result = await discoverDocker({
      env: {},
      runner: async (args) => {
        if (args[0] === "inspect") throw new DiscoveryError("no such container");
        return PAIR_OUTPUT;
      },
      prober: async () => false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.apiUrl).toBe(PAIR_URL);
    expect(result.tried.at(-1)?.[0]).toBe(PAIR_URL);
    expect(result.message).toBe("Found theone-sandbox, but none of its addresses answered from this machine");
  });

  it("reports runner errors and uses the project override", async () => {
    const seen: string[] = [];
    const result = await discoverDocker({
      env: { THEONE_COMPOSE_PROJECT: "ignored" },
      project: "monolith-test-x",
      runner: async (args) => {
        seen.push(args[3] ?? "");
        throw new DiscoveryError("docker is not installed on this machine");
      },
    });
    expect(result).toEqual({ ok: false, error: "docker is not installed on this machine" });
    expect(seen).toEqual(["monolith-test-x-sandbox-1"]);
  });
});
