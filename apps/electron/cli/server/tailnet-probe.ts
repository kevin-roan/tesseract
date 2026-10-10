import { lookup } from "node:dns/promises";
import { HOST_SHELL_PORT } from "@tesseract/protocol";
import { containerName } from "../../src/core/connection";
import { runCommand, type CommandResult } from "../../src/core/process";
import { DEFAULT_PROJECT, readEnvValues } from "../../src/core/sandbox";
import { DEFAULT_HOSTNAME } from "../../src/core/sandbox/constants";
import { SERVER } from "../constants";
import type { CliContext } from "../types";
import { resolveTailscale } from "./plan";
import { authErrors, findPeers, parseServe, parseStatus, type TailnetFacts } from "./tailnet";

const LOG_LINES = "400";
const TIMEOUT_MS = 15_000;
const HEALTH_PATH = "/v1/health";

function run(context: CliContext, file: string, args: readonly string[]): Promise<CommandResult> {
  return runCommand(file, args, { env: context.env, timeoutMs: TIMEOUT_MS, signal: context.signal });
}

async function output(context: CliContext, file: string, args: readonly string[]): Promise<string> {
  const result = await run(context, file, args);
  return result.code === 0 ? result.stdout.trim() : "";
}

async function answers(url: string, signal: AbortSignal): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]) });
    return true;
  } catch {
    return false;
  }
}

function restartHostShell(platform: NodeJS.Platform): string {
  return platform === "darwin"
    ? `launchctl kickstart -k gui/$(id -u)/${SERVER.serviceLabel}`
    : `systemctl --user restart ${SERVER.systemdUnit}`;
}

/** HTTP status of https://<front>/v1/health, dialing `ip` directly; "000" on timeout or no connection. */
async function httpsCode(context: CliContext, front: string, ip: string): Promise<string> {
  const [name = "", port = "443"] = front.split(":");
  const result = await run(context, "curl", [
    "-sk", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "15",
    "--resolve", `${name}:${port}:${ip}`, `https://${front}${HEALTH_PATH}`,
  ]);
  return result.stdout.trim() || "000";
}

export async function probeTailnet(context: CliContext): Promise<TailnetFacts> {
  const sandbox = await context.runtime.sandboxContext();
  const values = (await readEnvValues(sandbox.envFile)) ?? {};
  const project = values.TESSERACT_COMPOSE_PROJECT || DEFAULT_PROJECT;
  const volume = `${values.TESSERACT_VOLUME_PREFIX || project}-tailscale`;
  const hostname = values.TESSERACT_HOSTNAME || DEFAULT_HOSTNAME;
  const configuredMode = values.TESSERACT_MODE || "tailscale";
  const tailscale = resolveTailscale(context.env, context.runtime.platform);

  const hostResult = tailscale ? await run(context, tailscale, ["status", "--json"]) : null;
  const hostStatusText = hostResult?.code === 0 ? hostResult.stdout : "";
  const host = parseStatus(hostStatusText);
  const hostError = hostResult && !host ? (hostResult.timedOut ? "timed out" : hostResult.stderr.trim().split("\n").pop() || `exit ${hostResult.code}`) : null;
  const hostServe = tailscale && host ? parseServe(await output(context, tailscale, ["serve", "status", "--json"])) : [];
  const hostShellProxy = hostServe.find((proxy) => proxy.target.includes(`:${HOST_SHELL_PORT}`));
  const hostShellTarget = hostShellProxy?.target;

  const filter = ["--filter", `label=com.docker.compose.project=${project}`, "--filter", "label=com.docker.compose.service=tailscale"];
  const sidecarContainer = (await output(context, "docker", ["ps", ...filter, "--format", "{{.Names}}"])).split("\n")[0] || null;
  const mode = sidecarContainer ? "tailscale" : configuredMode;

  const facts: TailnetFacts = {
    mode,
    configuredMode,
    hostname,
    envDomain: values.TS_TAILNET_DOMAIN || null,
    authKeySaved: Boolean(values.TS_AUTHKEY),
    tailscaleCli: Boolean(tailscale),
    host,
    hostError,
    sidecarContainer,
    sidecar: null,
    sidecarLogErrors: [],
    volume,
    volumeCreated: null,
    publicUrl: null,
    peerVisible: null,
    otherPeers: [],
    ping: null,
    controllerUp: null,
    sidecarReachesController: null,
    sidecarServesController: null,
    httpsCode: null,
    resolvedIp: null,
    hostServe,
    hostShellPort: HOST_SHELL_PORT,
    hostShellAnswers: hostShellTarget ? await answers(`${hostShellTarget}${HEALTH_PATH}`, context.signal) : null,
    hostShellHttpsCode: hostShellProxy && host?.ip ? await httpsCode(context, hostShellProxy.front.replace(/\/$/, ""), host.ip) : null,
    restartHostShell: restartHostShell(context.runtime.platform),
  };
  if (mode !== "tailscale") return facts;

  const sandboxContainer = containerName(project);
  facts.volumeCreated = (await output(context, "docker", ["volume", "inspect", "-f", "{{ .CreatedAt }}", volume])) || null;
  facts.publicUrl = (await output(context, "docker", ["exec", sandboxContainer, "printenv", "TESSERACT_PUBLIC_URL"])) || null;
  facts.controllerUp = (await run(context, "docker", ["exec", sandboxContainer, "curl", "-fsS", "--max-time", "5", `http://127.0.0.1:7700${HEALTH_PATH}`])).code === 0;
  if (!sidecarContainer) return facts;

  const sidecar = parseStatus(await output(context, "docker", ["exec", sidecarContainer, "tailscale", "status", "--json"]));
  facts.sidecar = sidecar;
  const logs = await run(context, "docker", ["logs", "--tail", LOG_LINES, sidecarContainer]);
  const health = `http://127.0.0.1:7700${HEALTH_PATH}`;
  facts.sidecarReachesController = (await run(context, "docker", ["exec", sidecarContainer, "wget", "-q", "-T", "5", "-O", "/dev/null", health])).code === 0;
  facts.sidecarLogErrors = authErrors(`${logs.stdout}\n${logs.stderr}`);
  const serve = parseServe(await output(context, "docker", ["exec", sidecarContainer, "tailscale", "serve", "status", "--json"]));
  facts.sidecarServesController = serve.some((proxy) => proxy.target.includes("127.0.0.1:7700"));
  if (!sidecar?.ip || sidecar.state !== "Running") return facts;

  if (tailscale && host?.state === "Running") {
    const peers = findPeers(hostStatusText, sidecar.hostName || hostname, sidecar.ip);
    facts.peerVisible = peers.visible;
    facts.otherPeers = peers.others;
    const ping = await run(context, tailscale, ["ping", "-c", "3", "--timeout", "4s", sidecar.ip]);
    const last = `${ping.stdout}\n${ping.stderr}`.trim().split("\n").pop() ?? "";
    facts.ping = { ok: ping.code === 0, detail: last };
  }
  if (sidecar.dnsName) {
    const curl = await run(context, "curl", [
      "-sk", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "12",
      "--resolve", `${sidecar.dnsName}:443:${sidecar.ip}`, `https://${sidecar.dnsName}${HEALTH_PATH}`,
    ]);
    facts.httpsCode = curl.stdout.trim() || "000";
    facts.resolvedIp = await lookup(sidecar.dnsName, { family: 4 }).then((found) => found.address, () => "");
  }
  return facts;
}
