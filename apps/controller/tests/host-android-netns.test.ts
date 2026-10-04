import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { createSocket, type Socket as UdpSocket } from "node:dgram";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { connect, createServer, type Server, type Socket } from "node:net";
import { join } from "node:path";
import { silentLogger } from "../src/core/logger";
import { DnsForwarder, EgressProxy, firstNameserver, parseProxyRequest, queryUdp, vetDestination } from "../src/host/android/egress";
import { isBlockedAddress, parseAllowNets, parseCidr, parseIp } from "../src/host/android/net-policy";
import { IsolatedRuntime, launcherArgv, runtimeDir } from "../src/host/android/netns";
import { runtimePaths, startEmulatorHelper, type Helper } from "../src/host/android/netns-helper";
import { boundPort, closeServer, encodeFrame, FrameReader, listen } from "../src/host/android/pipe";
import { makeTempDir, removeTempDirs, waitFor } from "./helpers";

/** TEST-NET-3: passes the policy; `toLoopback` sends it to the local test origin. */
const PUBLIC_TEST_ADDRESS = "203.0.113.7";
const toLoopback = (address: string) => (address === PUBLIC_TEST_ADDRESS ? "127.0.0.1" : address);

const cleanups: (() => unknown)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
afterAll(() => removeTempDirs());

async function echoServer(host = "127.0.0.1", port = 0): Promise<Server> {
  const server = createServer((socket) => {
    socket.on("error", () => {});
    socket.on("data", (chunk) => socket.write(chunk));
  });
  await listen(server, { host, port });
  cleanups.push(() => closeServer(server));
  return server;
}

/** Sends `request` and collects what comes back until `done` matches or the peer closes. */
function exchange(socket: Socket, request: string | Buffer, done: (text: string) => boolean = () => false): Promise<string> {
  return new Promise((resolve) => {
    let received = "";
    socket.on("data", (chunk) => {
      received += chunk.toString("latin1");
      if (done(received)) resolve(received);
    });
    socket.on("close", () => resolve(received));
    socket.on("error", () => resolve(received));
    socket.write(request);
  });
}

function dial(endpoint: { path: string } | { host: string; port: number }): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = "path" in endpoint ? connect({ path: endpoint.path }) : connect(endpoint.port, endpoint.host);
    socket.once("connect", () => resolve(socket));
    socket.once("error", reject);
    cleanups.push(() => socket.destroy());
  });
}

/** A UDP "nameserver" answering every query with the query plus a marker byte. */
async function fakeNameserver(): Promise<{ socket: UdpSocket; port: number; queries: Buffer[] }> {
  const socket = createSocket("udp4");
  const queries: Buffer[] = [];
  socket.on("message", (message, peer) => {
    queries.push(message);
    socket.send(Buffer.concat([message, Buffer.of(0xaa)]), peer.port, peer.address);
  });
  await new Promise<void>((resolve) => socket.bind(0, "127.0.0.1", resolve));
  cleanups.push(() => socket.close());
  return { socket, port: socket.address().port, queries };
}

describe("emulator egress policy", () => {
  test("parses IPv4, IPv6 and CIDRs", () => {
    expect(parseIp("8.8.8.8")).toEqual({ family: 4, value: 0x08080808n });
    expect(parseIp("[::1]")).toEqual({ family: 6, value: 1n });
    expect(parseIp("::ffff:127.0.0.1")?.value).toBe((0xffffn << 32n) | 0x7f000001n);
    for (const bad of ["1.2.3", "256.1.1.1", "01.2.3.4", "1::2::3", "fe80::1%eth0", "example.com", ""]) expect(parseIp(bad)).toBeNull();
    expect(parseCidr("192.168.31.7/24")).toEqual({ family: 4, network: 0xc0a81f00n, prefix: 24 });
    expect(parseCidr("10.0.0.0/33")).toBeNull();
    expect(parseAllowNets(" 192.168.31.0/24 , fd00::/8,")).toMatchObject({ ok: true, value: [{ prefix: 24 }, { prefix: 8 }] });
    expect(parseAllowNets("192.168.31.0/24,nope")).toEqual({ ok: false, error: "nope" });
  });

  test("blocks host, private, tailnet, link-local, multicast and reserved addresses", () => {
    const blocked = [
      "127.0.0.1",
      "127.1.2.3",
      "0.0.0.0",
      "0.1.2.3",
      "10.0.2.2",
      "10.0.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.31.19",
      "100.64.0.1",
      "100.85.98.27",
      "100.100.100.100",
      "169.254.169.254",
      "224.0.0.1",
      "239.255.255.250",
      "255.255.255.255",
      "::",
      "::1",
      "::127.0.0.1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "::ffff:192.168.31.19",
      "::ffff:100.85.98.27",
      "64:ff9b::7f00:1",
      "fc00::1",
      "fd7a:115c:a1e0::53",
      "fe80::1",
      "fec0::3",
      "ff02::1",
      "not-an-ip",
    ];
    for (const address of blocked) expect([address, isBlockedAddress(address)]).toEqual([address, true]);
    for (const address of ["8.8.8.8", "93.184.216.34", "100.63.255.255", "100.128.0.1", "172.32.0.1", "2606:4700::1111", "::ffff:8.8.8.8"]) {
      expect([address, isBlockedAddress(address)]).toEqual([address, false]);
    }
  });

  test("the allowlist opens chosen ranges, including through IPv4-mapped addresses", () => {
    const parsed = parseAllowNets("192.168.31.0/24");
    const allow = parsed.ok ? parsed.value : [];
    expect(isBlockedAddress("192.168.31.19", allow)).toBe(false);
    expect(isBlockedAddress("::ffff:192.168.31.19", allow)).toBe(false);
    expect(isBlockedAddress("192.168.32.1", allow)).toBe(true);
    expect(isBlockedAddress("127.0.0.1", allow)).toBe(true);
    const everything = [parseCidr("0.0.0.0/0")!, parseCidr("::/0")!];
    for (const address of ["127.0.0.1", "0.0.0.0", "::1", "::", "::ffff:127.0.0.1"]) expect([address, isBlockedAddress(address, everything)]).toEqual([address, true]);
    expect(isBlockedAddress("10.0.0.1", everything)).toBe(false);
  });

  test("refuses a name when any of its addresses is blocked and never re-resolves", async () => {
    const resolve = async (host: string) => ({ "public.test": ["93.184.216.34"], "rebind.test": ["93.184.216.34", "127.0.0.1"], "empty.test": [] })[host] ?? [];
    expect(await vetDestination("public.test", { allow: [], resolve })).toEqual({ ok: true, addresses: ["93.184.216.34"] });
    expect(await vetDestination("rebind.test", { allow: [], resolve })).toMatchObject({ ok: false, status: 403 });
    expect(await vetDestination("empty.test", { allow: [], resolve })).toMatchObject({ ok: false, status: 502 });
    expect(await vetDestination("[::1]", { allow: [], resolve })).toMatchObject({ ok: false, status: 403 });
    expect(await vetDestination("10.0.2.3", { allow: [], resolve })).toMatchObject({ ok: false, status: 403 });
    expect(await vetDestination("localhost", { allow: [] })).toMatchObject({ ok: false, status: 403 });
  });
});

describe("emulator proxy requests", () => {
  test("parses CONNECT authorities", () => {
    expect(parseProxyRequest("CONNECT example.com:443 HTTP/1.1\r\nHost: example.com:443")).toEqual({
      ok: true,
      target: { kind: "connect", host: "example.com", port: 443 },
    });
    expect(parseProxyRequest("CONNECT [2606:4700::1111]:853 HTTP/1.1")).toMatchObject({ ok: true, target: { host: "2606:4700::1111", port: 853 } });
    for (const bad of ["CONNECT example.com HTTP/1.1", "CONNECT example.com:0 HTTP/1.1", "CONNECT example.com:70000 HTTP/1.1", "CONNECT user@example.com:443 HTTP/1.1", "connect x:1 HTTP/1.1", "garbage"]) {
      expect(parseProxyRequest(bad)).toMatchObject({ ok: false, status: 400 });
    }
  });

  test("rewrites absolute-form requests to origin form without proxy headers", () => {
    const parsed = parseProxyRequest(
      "GET http://connectivitycheck.gstatic.com/generate_204?x=1 HTTP/1.1\r\nHost: connectivitycheck.gstatic.com\r\nProxy-Connection: keep-alive\r\nProxy-Authorization: Basic eA==\r\nUser-Agent: Dalvik",
    );
    expect(parsed).toEqual({
      ok: true,
      target: {
        kind: "forward",
        host: "connectivitycheck.gstatic.com",
        port: 80,
        head: "GET /generate_204?x=1 HTTP/1.1\r\nHost: connectivitycheck.gstatic.com\r\nUser-Agent: Dalvik\r\n\r\n",
      },
    });
    expect(parseProxyRequest("POST http://[::1]:8080/a HTTP/1.0")).toMatchObject({ ok: true, target: { host: "::1", port: 8080, head: "POST /a HTTP/1.0\r\nHost: [::1]:8080\r\n\r\n" } });
    expect(parseProxyRequest("GET https://example.com/ HTTP/1.1")).toMatchObject({ ok: false, status: 400 });
    expect(parseProxyRequest("GET /relative HTTP/1.1")).toMatchObject({ ok: false, status: 400 });
  });

  test("proxies allowed CONNECT and absolute-form requests to the vetted address, refuses the rest", async () => {
    const origin = await echoServer();
    const port = boundPort(origin);
    const dir = makeTempDir("proxy");
    const resolved: string[] = [];
    const proxy = new EgressProxy(
      {
        allow: [],
        resolve: async (host) => {
          resolved.push(host);
          return host === "origin.test" ? [PUBLIC_TEST_ADDRESS] : ["192.168.1.10"];
        },
        dialAddress: toLoopback,
      },
      silentLogger,
      { maxHeaderBytes: 1024, maxConnections: 2, headerTimeoutMs: 2_000, connectTimeoutMs: 2_000, idleTimeoutMs: 10_000 },
    );
    const path = join(dir, "proxy.sock");
    await listen(proxy.server, { path });
    cleanups.push(() => closeServer(proxy.server));

    const tunnel = await dial({ path });
    const connected = await exchange(tunnel, `CONNECT origin.test:${port} HTTP/1.1\r\nHost: origin.test\r\n\r\nearly`, (text) => text.endsWith("early"));
    expect(connected).toBe("HTTP/1.1 200 Connection established\r\n\r\nearly");
    tunnel.destroy();

    const plain = await dial({ path });
    const forwarded = await exchange(plain, `GET http://origin.test:${port}/hello HTTP/1.1\r\nHost: origin.test\r\nProxy-Connection: close\r\n\r\n`, (text) => text.endsWith("\r\n\r\n"));
    expect(forwarded).toBe("GET /hello HTTP/1.1\r\nHost: origin.test\r\n\r\n");
    plain.destroy();

    const denied = await exchange(await dial({ path }), "CONNECT lan.test:22 HTTP/1.1\r\n\r\n");
    expect(denied).toStartWith("HTTP/1.1 403 Forbidden");
    expect(denied).toContain("may only reach the internet");
    expect(await exchange(await dial({ path }), "CONNECT 10.0.2.2:5037 HTTP/1.1\r\n\r\n")).toStartWith("HTTP/1.1 403");
    expect(await exchange(await dial({ path }), `GET http://127.0.0.2:${port}/ HTTP/1.1\r\n\r\n`)).toStartWith("HTTP/1.1 403");
    expect(await exchange(await dial({ path }), `X-Long: ${"a".repeat(2_000)}\r\n`)).toStartWith("HTTP/1.1 431");
    expect(await exchange(await dial({ path }), "BREW pot HTTP/1.1\r\n\r\n")).toStartWith("HTTP/1.1 400");
    expect(resolved).toEqual(["origin.test", "origin.test", "lan.test"]);
  });

  test("caps concurrent proxy connections", async () => {
    const dir = makeTempDir("proxy-cap");
    const proxy = new EgressProxy({ allow: [] }, silentLogger, { maxHeaderBytes: 1024, maxConnections: 1, headerTimeoutMs: 5_000, connectTimeoutMs: 1_000, idleTimeoutMs: 5_000 });
    const path = join(dir, "proxy.sock");
    await listen(proxy.server, { path });
    cleanups.push(() => closeServer(proxy.server));
    const first = await dial({ path });
    await Bun.sleep(20);
    expect(await exchange(await dial({ path }), "CONNECT a:1 HTTP/1.1\r\n\r\n")).toStartWith("HTTP/1.1 503");
    first.destroy();
  });
});

describe("emulator DNS relay", () => {
  test("frames messages with a 2-byte length across chunk boundaries", () => {
    const reader = new FrameReader();
    const stream = Buffer.concat([encodeFrame(Buffer.from("abc")), encodeFrame(Buffer.alloc(0)), encodeFrame(Buffer.alloc(300, 1))]);
    const frames = [...stream].flatMap((byte) => reader.push(Buffer.of(byte)));
    expect(frames.map((frame) => frame.length)).toEqual([3, 0, 300]);
    expect(frames[0]?.toString()).toBe("abc");
  });

  test("reads the host's first nameserver", () => {
    expect(firstNameserver("# generated\nsearch tail.ts.net\nnameserver 100.100.100.100\nnameserver fd7a:115c:a1e0::53\n")).toBe("100.100.100.100");
    expect(firstNameserver("nameserver fe80::1%eth0\n")).toBe("fe80::1");
    expect(firstNameserver("search x\n")).toBeNull();
  });

  test("forwards framed queries to the upstream nameserver and times out quietly", async () => {
    const upstream = await fakeNameserver();
    expect(await queryUdp({ host: "127.0.0.1", port: upstream.port }, Buffer.from("q1"))).toEqual(Buffer.from("q1\xaa", "latin1"));
    const silent = createSocket("udp4");
    await new Promise<void>((resolve) => silent.bind(0, "127.0.0.1", resolve));
    cleanups.push(() => silent.close());
    expect(await queryUdp({ host: "127.0.0.1", port: silent.address().port }, Buffer.from("q"), 100)).toBeNull();

    const forwarder = new DnsForwarder(() => ({ host: "127.0.0.1", port: upstream.port }));
    const path = join(makeTempDir("dns"), "dns.sock");
    await listen(forwarder.server, { path });
    cleanups.push(() => closeServer(forwarder.server));
    const socket = await dial({ path });
    const reader = new FrameReader();
    const answers: Buffer[] = [];
    socket.on("data", (chunk: Buffer) => answers.push(...reader.push(chunk)));
    socket.write(Buffer.concat([encodeFrame(Buffer.from("one")), encodeFrame(Buffer.from("two"))]));
    await waitFor(() => answers.length === 2);
    expect(answers.map((answer) => answer.toString("latin1")).sort()).toEqual(["one\xaa", "two\xaa"]);
  });
});

/** A fake emulator: an adbd echo server on `consolePort + 1` and a console on `consolePort`. */
async function fakeEmulatorPorts(): Promise<number> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const adbd = await echoServer();
    const consolePort = boundPort(adbd) - 1;
    try {
      const consoleServer = createServer((socket) => socket.end("Android Console\r\n"));
      await listen(consoleServer, { host: "127.0.0.1", port: consolePort });
      cleanups.push(() => closeServer(consoleServer));
      return consolePort;
    } catch {}
  }
  throw new Error("no consecutive free ports");
}

describe("namespace helper and host bridge", () => {
  async function setup(adbPort: number | null = null) {
    const base = makeTempDir("netns");
    const dir = runtimeDir(base, 5554);
    const consolePort = await fakeEmulatorPorts();
    const upstream = await fakeNameserver();
    const origin = await echoServer();
    const adbCalls: string[][] = [];
    const options = {
      dir,
      consolePort,
      adbPort,
      policy: { allow: [], resolve: async () => [PUBLIC_TEST_ADDRESS], dialAddress: toLoopback },
      logger: silentLogger,
      adb: async (args: string[]) => {
        adbCalls.push(args);
        return { ok: true, code: 0, stdout: args[0] === "connect" ? `connected to ${args[1]}\n` : "", stderr: "", error: null, timedOut: false } as never;
      },
      nameserver: () => ({ host: "127.0.0.1", port: upstream.port }),
    };
    const runtime = await IsolatedRuntime.create(options);
    cleanups.push(() => runtime.close());
    const helper: Helper = await startEmulatorHelper({ dir, dnsPort: 0, proxyPort: 0, consolePort });
    cleanups.push(() => helper.close());
    writeFileSync(runtimePaths(dir).helperPid, String(process.pid));
    writeFileSync(runtimePaths(dir).emulatorPid, String(process.pid));
    return { dir, runtime, helper, options, adbCalls, upstream, originPort: boundPort(origin) };
  }

  test("guest DNS, proxy and the adb bridge are piped through the runtime directory", async () => {
    const { runtime, helper, adbCalls, upstream, originPort } = await setup();
    expect(runtime.serial).toMatch(/^127\.0\.0\.1:\d+$/);

    const guest = createSocket("udp4");
    cleanups.push(() => guest.close());
    const answer = new Promise<Buffer>((resolve) => guest.once("message", resolve));
    guest.send(Buffer.from("dns-query"), helper.dnsPort, "127.0.0.1");
    expect((await answer).toString("latin1")).toBe("dns-query\xaa");
    expect(upstream.queries.map(String)).toEqual(["dns-query"]);

    const proxied = await dial({ host: "127.0.0.1", port: helper.proxyPort });
    expect(await exchange(proxied, `CONNECT origin.test:${originPort} HTTP/1.1\r\n\r\nping`, (text) => text.endsWith("ping"))).toEndWith("\r\n\r\nping");

    const adb = await dial({ host: "127.0.0.1", port: Number(runtime.serial.split(":")[1]) });
    const big = Buffer.alloc(512 * 1024, 7);
    let echoed = 0;
    const all = new Promise<void>((resolve) =>
      adb.on("data", (chunk) => {
        echoed += chunk.length;
        if (echoed === big.length) resolve();
      }),
    );
    adb.write(big);
    await all;

    const consoleSocket = await dial({ path: runtimePaths(runtime.paths.dir).console });
    expect(await exchange(consoleSocket, "")).toBe("Android Console\r\n");

    expect(await runtime.connectAdb()).toBe(true);
    expect(adbCalls).toEqual([["connect", runtime.serial]]);
  });

  test("a guest request followed by a shutdown still gets the answer through the whole chain", async () => {
    const { helper } = await setup();
    const origin = createServer({ allowHalfOpen: true }, (socket) => {
      let request = "";
      socket.on("data", (chunk) => {
        request += chunk.toString();
      });
      socket.on("end", () => socket.end(`answer to ${request}`));
    });
    await listen(origin, { host: "127.0.0.1", port: 0 });
    cleanups.push(() => closeServer(origin));
    const guest = connect({ host: "127.0.0.1", port: helper.proxyPort, allowHalfOpen: true });
    cleanups.push(() => guest.destroy());
    let received = "";
    const closed = new Promise<void>((resolve) => guest.on("close", () => resolve()));
    guest.on("data", (chunk) => {
      received += chunk.toString();
      if (received === "HTTP/1.1 200 Connection established\r\n\r\n") guest.end("GET /");
    });
    guest.write(`CONNECT origin.test:${boundPort(origin)} HTTP/1.1\r\n\r\n`);
    await closed;
    expect(received).toBe("HTTP/1.1 200 Connection established\r\n\r\nanswer to GET /");
  });

  test("a new daemon adopts a live runtime on the same bridge port; a stale one is removed", async () => {
    const { dir, runtime, options } = await setup();
    const serial = runtime.serial;
    const transport = await dial({ host: "127.0.0.1", port: Number(serial.split(":")[1]) });
    const dropped = new Promise<void>((resolve) => transport.once("close", () => resolve()));
    await runtime.close();
    await dropped;
    const adopted = await IsolatedRuntime.adopt(options);
    expect(adopted?.serial).toBe(serial);
    await adopted?.close();

    writeFileSync(runtimePaths(dir).helperPid, "999999999");
    expect(await IsolatedRuntime.adopt(options)).toBeNull();
    expect(existsSync(dir)).toBe(false);
  });

  test("teardown removes the runtime directory and disconnects adb", async () => {
    const { dir, runtime, adbCalls } = await setup();
    writeFileSync(runtimePaths(dir).helperPid, "999999999");
    writeFileSync(runtimePaths(dir).emulatorPid, "999999999");
    await runtime.teardown(100);
    expect(existsSync(dir)).toBe(false);
    expect(adbCalls).toContainEqual(["disconnect", runtime.serial]);
  });
});

describe("namespace launcher", () => {
  test("brings up lo and a dummy interface, starts the helper, then execs the emulator", () => {
    const argv = launcherArgv({ unshare: "/usr/bin/unshare", ip: "/usr/bin/ip", dir: "/run/user/1000/theone/emulator-5554", consolePort: 5554, helper: ["/usr/bin/bun", "/x/it's/index.ts"], emulator: ["/sdk/emulator/emulator", "-avd", "Pixel_5"] });
    expect(argv.slice(0, 7)).toEqual(["/usr/bin/unshare", "--user", "--map-root-user", "--net", "--", "/bin/sh", "-c"]);
    expect(argv.slice(8)).toEqual(["theone-emulator", "/sdk/emulator/emulator", "-avd", "Pixel_5"]);
    const script = argv[7] ?? "";
    expect(script).toContain('"$IP" link add dummy0 type dummy');
    expect(script).toContain('"$IP" addr add 10.254.254.1/32 dev dummy0');
    expect(script).toContain('"$IP" addr add fd00:254::1/128 dev dummy0');
    expect(script).toContain(`'/x/it'\\''s/index.ts' 'host' 'emulator-helper' '--dir' '/run/user/1000/theone/emulator-5554' '--console-port' '5554' --parent $$`);
    expect(script.trim().endsWith('exec "$@"')).toBe(true);
    const run = Bun.spawnSync(["sh", "-n", "-c", script]);
    expect(run.success).toBe(true);
  });

  test("the runtime directory is private", async () => {
    const base = makeTempDir("netns-mode");
    const dir = runtimeDir(join(base, "theone"), 5556);
    const runtime = await IsolatedRuntime.create({
      dir,
      consolePort: 5556,
      adbPort: null,
      policy: { allow: [] },
      logger: silentLogger,
      adb: async () => ({ ok: true, code: 0, stdout: "", stderr: "", error: null, timedOut: false }) as never,
    });
    cleanups.push(() => runtime.close());
    const { statSync } = await import("node:fs");
    expect(statSync(dir).mode & 0o777).toBe(0o700);
    expect(statSync(join(base, "theone")).mode & 0o777).toBe(0o700);
    expect(Number(readFileSync(runtimePaths(dir).adbPort, "utf8"))).toBe(Number(runtime.serial.split(":")[1]));
  });
});
