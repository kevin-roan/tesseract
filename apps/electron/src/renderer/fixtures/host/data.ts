import {
  DEFAULT_ANDROID_STREAM,
  DEFAULT_IOS_STREAM,
  restPaths,
  routePatterns,
  type AndroidStreamSettings,
  type CreateHostTerminal,
  type HostIosStatus,
  type IosLinkInfo,
  type IosStreamSettings,
  type SimDevice,
  type TerminalInfo,
} from "@tesseract/protocol";
import { sampleHostAndroidStatus, sampleHostIosStatus, sampleTicket } from "@tesseract/protocol/fixtures";
import type { HostShellState } from "../../../shared/contracts/hostShell";
import type { HttpProxyRequest, HttpProxyResponse } from "../../../shared/contracts/http";
import { bytesToBase64 } from "../../lib/base64";

export const HOST_FIXTURE_URL = "http://127.0.0.1:7701";
export const HOST_SHELL_ID = "trm_host_fixture";
const SESSION_MS = 15 * 60_000;
const HOUR_MS = 3_600_000;

export function hostFixtureState(patch: Partial<HostShellState> = {}): HostShellState {
  return {
    status: "running",
    pairing: { link: "tesseract://host?url=fixture", url: HOST_FIXTURE_URL, name: "archlinux", pinSet: true },
    error: null,
    log: [],
    autostart: true,
    sessionExpiresAt: Date.now() + SESSION_MS,
    ...patch,
  };
}

const terminal = (overrides: Partial<TerminalInfo> & Pick<TerminalInfo, "id">): TerminalInfo => ({
  kind: "shell",
  projectId: null,
  title: "zsh",
  cwd: "/home/me/Projects/tesseract",
  pid: 5151,
  cols: 120,
  rows: 32,
  state: "running",
  exitCode: null,
  createdAt: new Date(Date.now() - 2 * HOUR_MS).toISOString(),
  ...overrides,
});

let terminals: TerminalInfo[] | null = null;
let sequence = 0;

export function hostTerminals(): TerminalInfo[] {
  terminals ??= [terminal({ id: HOST_SHELL_ID })];
  return terminals;
}

const shutDown = (device: SimDevice): SimDevice => ({ ...device, state: "shutdown" });

function seedIos(): HostIosStatus {
  return { ...sampleHostIosStatus, booted: null, devices: sampleHostIosStatus.devices.map(shutDown), link: { ...sampleHostIosStatus.link, configured: false, sandboxUrl: null, connected: false } };
}

let ios = seedIos();

export function hostIos(): HostIosStatus {
  return ios;
}

export function bootHostSimulator(udid: string): HostIosStatus {
  const devices = ios.devices.map((device) => (device.udid === udid ? { ...device, state: "booted" as const } : device));
  ios = { ...ios, devices, booted: devices.find((device) => device.udid === udid) ?? null };
  return ios;
}

export function shutdownHostSimulator(): HostIosStatus {
  ios = { ...ios, devices: ios.devices.map(shutDown), booted: null };
  return ios;
}

export function linkHostSimulator(sandboxUrl: string): IosLinkInfo {
  ios = { ...ios, link: { configured: true, sandboxUrl, connected: true, lastError: null } };
  return ios.link;
}

let androidStream: AndroidStreamSettings = { ...DEFAULT_ANDROID_STREAM };
let iosStream: IosStreamSettings = { ...DEFAULT_IOS_STREAM };

export function resetHostFixtures(): void {
  terminals = null;
  sequence = 0;
  ios = seedIos();
  androidStream = { ...DEFAULT_ANDROID_STREAM };
  iosStream = { ...DEFAULT_IOS_STREAM };
}

const TERMINAL_PATH = new RegExp(`^${routePatterns.rest.terminal.replace(":id", "([^/]+)")}$`);
const encode = (body: unknown) => bytesToBase64(new TextEncoder().encode(JSON.stringify(body)));
const json = (status: number, body: unknown): HttpProxyResponse => ({
  status,
  statusText: String(status),
  headers: { "content-type": "application/json" },
  bodyBase64: encode(body),
});

function parse<T>(body: string | undefined): Partial<T> {
  try {
    return body ? (JSON.parse(body) as Partial<T>) : {};
  } catch {
    return {};
  }
}

export function hostProxyFixture(request: HttpProxyRequest): HttpProxyResponse {
  const { pathname } = new URL(request.url);
  const method = request.method.toUpperCase();
  if (pathname === restPaths.authTicket() && method === "POST") return json(200, sampleTicket);
  if (pathname === restPaths.terminals() && method === "GET") return json(200, hostTerminals());
  if (pathname === restPaths.terminals() && method === "POST") {
    const body = parse<CreateHostTerminal>(request.body);
    sequence += 1;
    const info = terminal({ id: `trm_host_new_${sequence}`, kind: body.kind ?? "shell", title: body.kind === "claude" ? "claude" : "zsh", cwd: body.cwd ?? "/home/me", cols: body.cols ?? 100, rows: body.rows ?? 30, createdAt: new Date().toISOString() });
    terminals = [info, ...hostTerminals()];
    return json(201, info);
  }
  const id = TERMINAL_PATH.exec(pathname)?.[1];
  if (id && method === "DELETE") {
    const info = hostTerminals().find((candidate) => candidate.id === decodeURIComponent(id));
    if (!info) return json(404, { error: { code: "not_found", message: "Terminal not found" } });
    terminals = hostTerminals().filter((candidate) => candidate !== info);
    return json(200, { ...info, state: "exited", exitCode: 0 });
  }
  if (pathname === restPaths.android() && method === "GET") return json(200, sampleHostAndroidStatus);
  if (pathname === restPaths.androidStream() && method === "GET") return json(200, androidStream);
  if (pathname === restPaths.androidStream() && method === "PUT") {
    androidStream = { ...androidStream, ...parse<AndroidStreamSettings>(request.body) };
    return json(200, androidStream);
  }
  if (pathname === restPaths.iosStream() && method === "GET") return json(200, iosStream);
  if (pathname === restPaths.iosStream() && method === "PUT") {
    iosStream = { ...iosStream, ...parse<IosStreamSettings>(request.body) };
    return json(200, iosStream);
  }
  return json(404, { error: { code: "not_found", message: `No host fixture for ${method} ${pathname}` } });
}
