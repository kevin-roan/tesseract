import { createSocket } from "node:dgram";
import { readlinkSync, writeFileSync } from "node:fs";
import type { Server } from "node:net";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { boundPort, closeServer, connectTo, encodeFrame, FrameReader, listen, relayServer } from "./pipe";

/** Files of an isolated emulator's runtime directory (0700), shared by the daemon and the helper. */
export function runtimePaths(dir: string) {
  return {
    dir,
    dns: join(dir, "dns.sock"),
    proxy: join(dir, "proxy.sock"),
    adbd: join(dir, "adbd.sock"),
    console: join(dir, "console.sock"),
    helperPid: join(dir, "helper.pid"),
    emulatorPid: join(dir, "emulator.pid"),
    netns: join(dir, "netns"),
    adbPort: join(dir, "adb-port"),
    avd: join(dir, "avd"),
    log: join(dir, "emulator.log"),
  };
}

/** Ports inside the emulator's network namespace (nothing else listens there). */
export const NETNS_PORTS = { dns: 53, proxy: 3128 } as const;

export const HELPER_COMMAND = "emulator-helper";

export type HelperOptions = { dir: string; host?: string; dnsPort: number; proxyPort: number; consolePort: number };

export type Helper = { dnsPort: number; proxyPort: number; close: () => Promise<void> };

const LOOPBACK = "127.0.0.1";
const DNS_TIMEOUT_MS = 6_000;
const DNS_MAX_IN_FLIGHT = 64;
const PROXY_MAX_CONNECTIONS = 256;
const ADBD_MAX_CONNECTIONS = 64;
const CONSOLE_MAX_CONNECTIONS = 8;
const PARENT_POLL_MS = 1_000;

/**
 * Runs inside the emulator's network namespace: guest DNS (UDP) and the emulator's HTTP proxy
 * are relayed out to the daemon's unix sockets, and the emulator's adbd and console are
 * exposed as unix sockets in the runtime directory, which the daemon (outside) can reach.
 */
export async function startEmulatorHelper(options: HelperOptions): Promise<Helper> {
  const host = options.host ?? LOOPBACK;
  const paths = runtimePaths(options.dir);
  const servers: Server[] = [];
  const serve = async (server: Server, endpoint: Parameters<typeof listen>[1]) => {
    await listen(server, endpoint);
    servers.push(server);
    return server;
  };

  const proxy = await serve(relayServer(() => ({ path: paths.proxy }), PROXY_MAX_CONNECTIONS), { host, port: options.proxyPort });
  await serve(relayServer(() => ({ host, port: options.consolePort + 1 }), ADBD_MAX_CONNECTIONS), { path: paths.adbd });
  await serve(relayServer(() => ({ host, port: options.consolePort }), CONSOLE_MAX_CONNECTIONS), { path: paths.console });

  const dns = createSocket("udp4");
  let inFlight = 0;
  dns.on("error", () => {});
  dns.on("message", (query, peer) => {
    if (inFlight >= DNS_MAX_IN_FLIGHT) return;
    inFlight += 1;
    const upstream = connectTo({ path: paths.dns });
    const reader = new FrameReader();
    const done = () => {
      clearTimeout(timer);
      upstream.destroy();
    };
    const timer = setTimeout(done, DNS_TIMEOUT_MS);
    upstream.once("close", () => {
      inFlight -= 1;
      clearTimeout(timer);
    });
    upstream.on("data", (chunk: Buffer) => {
      const [answer] = reader.push(chunk);
      if (!answer) return;
      dns.send(answer, peer.port, peer.address);
      done();
    });
    upstream.write(encodeFrame(query));
  });
  await new Promise<void>((resolve, reject) => {
    dns.once("error", reject);
    dns.bind(options.dnsPort, host, () => {
      dns.off("error", reject);
      resolve();
    });
  });

  return {
    dnsPort: dns.address().port,
    proxyPort: boundPort(proxy),
    close: async () => {
      dns.close();
      await Promise.all(servers.map((server) => closeServer(server)));
    },
  };
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** `tesseract-controller host emulator-helper --dir <dir> --console-port <n> --parent <pid>`; exits with the emulator. */
export async function runEmulatorHelper(args: string[]): Promise<null> {
  const { values } = parseArgs({
    args,
    options: {
      dir: { type: "string" },
      "console-port": { type: "string" },
      parent: { type: "string" },
      "dns-port": { type: "string", default: String(NETNS_PORTS.dns) },
      "proxy-port": { type: "string", default: String(NETNS_PORTS.proxy) },
    },
    strict: true,
  });
  const parent = Number(values.parent);
  const consolePort = Number(values["console-port"]);
  if (!values.dir || !Number.isInteger(parent) || parent <= 0 || !Number.isInteger(consolePort)) {
    throw new Error("emulator-helper needs --dir, --console-port and --parent");
  }
  const paths = runtimePaths(values.dir);
  const helper = await startEmulatorHelper({ dir: values.dir, dnsPort: Number(values["dns-port"]), proxyPort: Number(values["proxy-port"]), consolePort });
  writeFileSync(paths.netns, readlinkSync("/proc/self/ns/net"), { mode: 0o600 });
  writeFileSync(paths.helperPid, String(process.pid), { mode: 0o600 });
  const exit = () => void helper.close().finally(() => process.exit(0));
  process.once("SIGTERM", exit);
  process.once("SIGINT", exit);
  setInterval(() => {
    if (!alive(parent)) exit();
  }, PARENT_POLL_MS);
  return null;
}
