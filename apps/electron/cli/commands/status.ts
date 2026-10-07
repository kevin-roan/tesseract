import { listAvds, readAndroidConfig, resolvedSdkRoot } from "../../src/core/android";
import { readConfig, type ConfigData } from "../../src/core/config";
import { hasSealedToken, probeHealth, readStoredConnection } from "../../src/core/connection";
import { isDockerReady, phaseFromReport, probeDocker } from "../../src/core/docker";
import { persistedOnboarding } from "../../src/core/onboarding";
import { composeStatus, currentStack } from "../../src/core/sandbox";
import type { ConnectionSource } from "../../src/shared/contracts/connection";
import type { DockerKind } from "../../src/shared/contracts/docker";
import type { ComposeServiceStatus, SandboxStackConfig } from "../../src/shared/contracts/sandbox";
import { errorMessage, keyValues, table } from "../format";
import { emit, guarded } from "../io";
import { CLI_LABELS } from "../labels";
import { defineCommand, EXIT, type CliContext } from "../types";
import { CLI_VERSION } from "../version";

const LABELS = CLI_LABELS.status;

type Failure = { error: string };

export interface StatusReport {
  version: string;
  configFile: string;
  onboarding: { completed: boolean; step: string | null };
  connection: { url: string; name: string | null; source: ConnectionSource | "sealed"; reachable: boolean } | null;
  docker: { ready: boolean; kind: DockerKind; version: string | null; problem: string | null } | Failure;
  stack: SandboxStackConfig | null | Failure;
  services: ComposeServiceStatus[] | Failure;
  android: { sdkRoot: string; avd: string | null; avds: string[] };
}

function failure(error: unknown): Failure {
  return { error: errorMessage(error) };
}

function settle<T>(promise: Promise<T>): Promise<T | Failure> {
  return promise.catch(failure);
}

export function isFailure(value: unknown): value is Failure {
  return typeof value === "object" && value !== null && "error" in value;
}

function storedUrl(data: ConfigData): string | null {
  const value = data.url ?? data.apiUrl;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function connectionStatus(context: CliContext, data: ConfigData): Promise<StatusReport["connection"]> {
  const stored = readStoredConnection(data, context.env, null);
  const sealedUrl = !stored && hasSealedToken(data) ? storedUrl(data) : null;
  const url = stored?.apiUrl ?? sealedUrl;
  if (!url) return null;
  const name = stored?.name ?? (typeof data.name === "string" ? data.name : null);
  return { url, name, source: stored?.source ?? "sealed", reachable: await probeHealth(url) };
}

async function dockerStatus(context: CliContext): Promise<StatusReport["docker"]> {
  const report = await probeDocker({ env: context.env, signal: context.signal });
  const phase = phaseFromReport(report, context.runtime.platform);
  return {
    ready: isDockerReady(report, context.runtime.platform),
    kind: report.kind,
    version: report.server?.version ?? report.cli?.version ?? null,
    problem: phase.kind === "blocked" ? phase.reason : null,
  };
}

async function androidStatus(context: CliContext): Promise<StatusReport["android"]> {
  const config = await readAndroidConfig(context.runtime.configFile);
  const avds = await listAvds(context.runtime.paths).catch(() => []);
  return { sdkRoot: resolvedSdkRoot(context.runtime.paths, config), avd: config.avd, avds: avds.map((avd) => avd.name) };
}

export async function gatherStatus(context: CliContext): Promise<StatusReport> {
  const data = await readConfig(context.runtime.configFile);
  const saved = persistedOnboarding(data);
  const sandbox = context.runtime.sandboxContext();
  const [connection, docker, stack, services, android] = await Promise.all([
    connectionStatus(context, data),
    settle(dockerStatus(context)),
    settle(sandbox.then(currentStack)),
    settle(sandbox.then((ctx) => composeStatus(ctx)).then((status) => status.services)),
    androidStatus(context),
  ]);
  return {
    version: CLI_VERSION,
    configFile: context.runtime.configFile,
    onboarding: { completed: Boolean(saved?.completedAt), step: saved?.completedAt ? null : (saved?.step ?? null) },
    connection,
    docker,
    stack,
    services,
    android,
  };
}

function connectionLine(connection: StatusReport["connection"]): string {
  if (!connection) return LABELS.notPaired;
  const reach = connection.reachable ? LABELS.reachable : LABELS.unreachable;
  const name = connection.name ? `${connection.name} · ` : "";
  return `${name}${connection.url} (${reach})`;
}

function dockerLine(docker: StatusReport["docker"]): string {
  if (isFailure(docker)) return LABELS.unavailable(docker.error);
  if (!docker.ready) return LABELS.dockerNotReady(docker.problem ?? "");
  return LABELS.dockerReady(CLI_LABELS.dockerKinds[docker.kind], docker.version ?? "");
}

function stackLine(stack: StatusReport["stack"]): string {
  if (isFailure(stack)) return LABELS.unavailable(stack.error);
  if (!stack) return LABELS.stackNone;
  return LABELS.stackLine(stack.project, stack.image, stack.mode);
}

function serviceLines(services: StatusReport["services"]): string[] {
  if (isFailure(services)) return [LABELS.unavailable(services.error)];
  if (services.length === 0) return [LABELS.noServices];
  return table(services.map((service) => [service.service, service.state, service.health ?? ""]));
}

export function describeStatus(report: StatusReport): string[] {
  const onboarding = report.onboarding.completed
    ? LABELS.onboardingDone
    : LABELS.onboardingAt(report.onboarding.step ?? "welcome");
  const android = LABELS.androidLine(report.android.sdkRoot, report.android.avd ?? report.android.avds[0] ?? LABELS.avdNone);
  const [first = "", ...rest] = serviceLines(report.services);
  const rows = keyValues([
    [LABELS.connection, connectionLine(report.connection)],
    [LABELS.docker, dockerLine(report.docker)],
    [LABELS.stack, stackLine(report.stack)],
    [LABELS.services, first],
    [LABELS.android, android],
    [LABELS.onboarding, onboarding],
    [LABELS.configFile, report.configFile],
  ]);
  const servicesIndex = 3;
  const pad = " ".repeat((rows[servicesIndex] ?? "").length - first.length);
  return [
    LABELS.heading(report.version),
    ...rows.slice(0, servicesIndex + 1),
    ...rest.map((line) => `${pad}${line}`),
    ...rows.slice(servicesIndex + 1),
  ];
}

export default defineCommand({
  name: "status",
  trigger: { subcommand: "status" },
  summary: CLI_LABELS.summary.status,
  usage: CLI_LABELS.usageLines.status,
  run: (context) =>
    guarded(context, async () => {
      emit(context, await gatherStatus(context), describeStatus);
      return EXIT.ok;
    }),
});
