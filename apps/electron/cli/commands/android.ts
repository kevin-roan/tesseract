import { cpus, totalmem } from "node:os";
import {
  acceptLicense,
  AVD_DEFAULTS,
  catalogUrls,
  cleanupTemp,
  defaultAvdName,
  defaultAvdResources,
  deleteAvd,
  emulatorArgs,
  emulatorBinary,
  EmulatorController,
  findCatalogPackage,
  findConsolePort,
  hostSupport,
  installedRevision,
  installPackages,
  listAvds,
  loadCatalog,
  packageDir,
  pendingLicenses,
  readAndroidConfig,
  resolvePlan,
  saveAndroidConfig,
  sdkEnv,
  systemImageApi,
  validateAvdSpec,
  writeAvd,
  type EmulatorStartOptions,
} from "../../src/core/android";
import { DEFAULT_API_LEVEL, SCRUBBED_ENV_PREFIXES, SYSTEM_IMAGE_TAG } from "../../src/core/android/constants";
import { exists } from "../../src/core/android/sdk";
import { launchDetached } from "../../src/core/docker/system";
import { scrubEnv } from "../../src/core/process";
import type {
  AndroidHostSupport,
  AvdDeviceProfile,
  AvdInfo,
  AvdSpec,
  EmulatorState,
  PackageProgress,
  SdkCatalog,
  SdkPackage,
  SystemImageAbi,
} from "../../src/shared/contracts/android";
import { IpcError } from "../../src/shared/ipc-types";
import { positiveInt } from "../args";
import { MIN_LISTED_API, SYSTEM_IMAGE_PREFIX } from "../constants";
import { formatBytes, formatPercent, table } from "../format";
import { createProgress, emit, guarded, log, usageError } from "../io";
import { CLI_LABELS } from "../labels";
import { rememberSdkRoot, sdkRootFor } from "../sdk-root";
import { defineCommand, EXIT, type CliContext } from "../types";

const LABELS = CLI_LABELS.android;
const MB_PER_GB = 1024;
const AVD_ACTIONS = ["list", "create", "start", "delete"] as const;
const AVD_ALIASES: Readonly<Record<string, (typeof AVD_ACTIONS)[number]>> = { avds: "list" };

type Supported = Extract<AndroidHostSupport, { supported: true }>;

export interface PackageRow {
  path: string;
  displayName: string;
  revision: string;
  size: number;
  installed: string | null;
}

export interface ImageRow extends PackageRow {
  api: number;
  versionName: string;
  abi: string;
}

export interface ImagesReport {
  sdkRoot: string;
  tools: PackageRow[];
  systemImages: ImageRow[];
}

function supported(context: CliContext): Supported {
  const support = hostSupport(context.runtime.paths, context.runtime.arch);
  if (!support.supported) throw new IpcError("unavailable", support.reason);
  return support;
}

async function catalogFor(context: CliContext): Promise<SdkCatalog> {
  return loadCatalog(context.runtime.androidCacheDir, supported(context), context.flags.has("refresh"), {
    urls: catalogUrls(context.runtime.paths.env),
    onLog: (line) => {
      if (context.verbose) log(context, line);
    },
  });
}

async function packageRow(sdkRoot: string, pkg: SdkPackage): Promise<PackageRow> {
  return {
    path: pkg.path,
    displayName: pkg.displayName,
    revision: pkg.revision,
    size: pkg.archive.size,
    installed: await installedRevision(sdkRoot, pkg.path),
  };
}

export async function imagesReport(context: CliContext): Promise<ImagesReport> {
  const catalog = await catalogFor(context);
  const sdkRoot = await sdkRootFor(context);
  const tools = await Promise.all([catalog.emulator, catalog.platformTools].map((pkg) => packageRow(sdkRoot, pkg)));
  const all = await Promise.all(
    catalog.systemImages.map(async (image) => ({
      ...(await packageRow(sdkRoot, image)),
      api: image.api,
      versionName: image.versionName,
      abi: image.abi,
    })),
  );
  const systemImages = all
    .filter((image) => context.flags.has("all") || image.api >= MIN_LISTED_API || image.installed !== null)
    .sort((a, b) => b.api - a.api);
  return { sdkRoot, tools, systemImages };
}

export function describeImages(report: ImagesReport): string[] {
  const installed = (value: string | null) => (value ? LABELS.installedYes(value) : LABELS.installedNo);
  const tools = table([
    LABELS.toolsHeader,
    ...report.tools.map((tool) => [tool.path, tool.revision, formatBytes(tool.size), installed(tool.installed)]),
  ]);
  const images =
    report.systemImages.length === 0
      ? [LABELS.noImages]
      : table([
          LABELS.imagesHeader,
          ...report.systemImages.map((image) => [
            String(image.api),
            image.versionName,
            image.abi,
            formatBytes(image.size),
            installed(image.installed),
            image.path,
          ]),
        ]);
  return [LABELS.sdkRoot(report.sdkRoot), "", ...tools, "", ...images];
}

export function resolveInstallTargets(tokens: readonly string[], catalog: SdkCatalog): string[] {
  const paths: string[] = [];
  for (const token of tokens) {
    const api = /^\d+(\.\d+)?$/.test(token) ? Number(token) : null;
    const path =
      api !== null
        ? catalog.systemImages.find((image) => image.api === api)?.path
        : findCatalogPackage(catalog, token)?.path;
    if (!path) usageError(LABELS.unknownToken(token));
    paths.push(path);
  }
  if (paths.some((path) => path.startsWith(SYSTEM_IMAGE_PREFIX))) paths.push(catalog.emulator.path, catalog.platformTools.path);
  return [...new Set(paths)];
}

function progressLine(progress: PackageProgress): string {
  const amount = `${formatBytes(progress.received)}/${formatBytes(progress.total)} ${formatPercent(
    progress.total > 0 ? progress.received / progress.total : null,
  )}`.trim();
  const rate = progress.bytesPerSecond ? LABELS.rate(formatBytes(progress.bytesPerSecond)) : "";
  return LABELS.progress(progress.index + 1, progress.count, progress.pkg, progress.stage, amount, rate);
}

async function ensureLicenses(context: CliContext, sdkRoot: string, catalog: SdkCatalog, packages: SdkPackage[]): Promise<void> {
  const pending = await pendingLicenses(sdkRoot, catalog, packages);
  if (pending.length === 0) return;
  if (!context.flags.has("accept-licenses")) {
    if (!context.json) {
      for (const id of pending) {
        context.io.stdout(LABELS.licenseHeading(id));
        context.io.stdout(catalog.licenses[id] ?? "");
      }
    }
    throw new IpcError("forbidden", LABELS.licensesNeeded(pending.join(", ")), LABELS.licensesHint);
  }
  for (const id of pending) await acceptLicense(sdkRoot, id, catalog.licenses[id] ?? "");
}

async function install(context: CliContext): Promise<number> {
  const tokens = context.args.slice(1);
  if (tokens.length === 0) usageError(CLI_LABELS.missingArgument("android install", "<api|package>"));
  const catalog = await catalogFor(context);
  const sdkRoot = await sdkRootFor(context);
  const plan = { sdkRoot, packages: resolveInstallTargets(tokens, catalog), avd: null };
  await ensureLicenses(context, sdkRoot, catalog, resolvePlan(plan, catalog));
  const progress = createProgress(context);
  try {
    await installPackages(
      plan,
      catalog,
      {
        onLog: (line) => {
          progress.done();
          log(context, line);
        },
        onProgress: (value) => progress.update(progressLine(value)),
      },
      context.signal,
      { paths: context.runtime.paths },
    );
  } finally {
    progress.done();
    if (context.signal.aborted) await cleanupTemp(sdkRoot).catch(() => undefined);
  }
  await rememberSdkRoot(context, sdkRoot);
  emit(context, { sdkRoot, packages: plan.packages }, (value) => [LABELS.installed(value.packages.length, value.sdkRoot)]);
  return EXIT.ok;
}

export function systemImageCandidates(value: string, abi: SystemImageAbi): string[] {
  if (!/^\d+(\.\d+)?$/.test(value)) return [value];
  const platforms = value.includes(".") ? [value] : [value, `${value}.0`];
  return platforms.map((platform) => `${SYSTEM_IMAGE_PREFIX}android-${platform};${SYSTEM_IMAGE_TAG};${abi}`);
}

export async function resolveSystemImage(sdkRoot: string, value: string, abi: SystemImageAbi): Promise<string> {
  const candidates = systemImageCandidates(value, abi);
  for (const candidate of candidates) if (await exists(packageDir(sdkRoot, candidate))) return candidate;
  return candidates[0] ?? value;
}

function numberFlag(context: CliContext, flag: string, fallback: number): number {
  const raw = context.values.get(flag);
  if (raw === undefined) return fallback;
  const value = positiveInt(raw);
  if (value === null) usageError(LABELS.invalidNumber(flag));
  return value;
}

export async function avdSpec(context: CliContext, name: string | undefined): Promise<AvdSpec> {
  const support = supported(context);
  const sdkRoot = await sdkRootFor(context);
  const systemImage = await resolveSystemImage(sdkRoot, context.values.get("image") ?? String(DEFAULT_API_LEVEL), support.abi);
  const parsed = systemImageApi(systemImage);
  if (!parsed) usageError(LABELS.invalidImage(systemImage));
  const defaults = defaultAvdResources(totalmem(), cpus().length);
  return {
    name: name ?? defaultAvdName(parsed.api),
    sdkRoot,
    systemImage,
    api: parsed.api,
    abi: parsed.abi as SystemImageAbi,
    ramMb: numberFlag(context, "ram", defaults.ramMb),
    cores: numberFlag(context, "cores", defaults.cores),
    deviceProfile: (context.values.get("device") ?? AVD_DEFAULTS.deviceProfile) as AvdDeviceProfile,
    storageMb: numberFlag(context, "storage", AVD_DEFAULTS.storageMb / MB_PER_GB) * MB_PER_GB,
  };
}

async function createAvd(context: CliContext, name: string | undefined): Promise<number> {
  const spec = await avdSpec(context, name);
  validateAvdSpec(spec);
  if (!(await exists(packageDir(spec.sdkRoot, spec.systemImage)))) {
    throw new IpcError("not_found", LABELS.imageNotInstalled(spec.systemImage, spec.api));
  }
  const info = await writeAvd(context.runtime.paths, spec);
  const config = await readAndroidConfig(context.runtime.configFile);
  if (context.flags.has("default") || !config.avd) {
    await saveAndroidConfig(context.runtime.configFile, context.runtime.paths, { avd: info.name });
  }
  await rememberSdkRoot(context, spec.sdkRoot);
  emit(context, info, (value) => [LABELS.created(value.name, value.path)]);
  return EXIT.ok;
}

export function describeAvds(avds: readonly AvdInfo[], current: string | null): string[] {
  if (avds.length === 0) return [LABELS.noAvds];
  return table([
    LABELS.avdHeader,
    ...avds.map((avd) => [avd.name === current ? LABELS.defaultMark : "", avd.name, avd.target ?? "", avd.abi ?? "", avd.path]),
  ]);
}

async function listAvdCommand(context: CliContext): Promise<number> {
  const [avds, config] = await Promise.all([listAvds(context.runtime.paths), readAndroidConfig(context.runtime.configFile)]);
  emit(context, { default: config.avd, avds }, (value) => describeAvds(value.avds, value.default));
  return EXIT.ok;
}

async function deleteAvdCommand(context: CliContext, name: string | undefined): Promise<number> {
  if (!name) usageError(CLI_LABELS.missingArgument("android avd delete", "<name>"));
  await deleteAvd(context.runtime.paths, await sdkRootFor(context), name);
  const config = await readAndroidConfig(context.runtime.configFile);
  if (config.avd === name) await saveAndroidConfig(context.runtime.configFile, context.runtime.paths, { avd: null });
  emit(context, { deleted: name }, () => [LABELS.deleted(name)]);
  return EXIT.ok;
}

async function avdToStart(context: CliContext, name: string | undefined): Promise<string> {
  if (name) return name;
  const config = await readAndroidConfig(context.runtime.configFile);
  if (config.avd) return config.avd;
  const first = (await listAvds(context.runtime.paths))[0]?.name;
  if (!first) throw new IpcError("not_found", LABELS.noAvdToStart);
  return first;
}

function startOptions(context: CliContext): EmulatorStartOptions {
  const gpu = context.values.get("gpu");
  return { headless: context.flags.has("headless"), ...(gpu ? { gpu } : {}) };
}

async function startDetached(context: CliContext, sdkRoot: string, avd: string): Promise<number> {
  const binary = emulatorBinary(sdkRoot, context.runtime.platform);
  if (!(await exists(binary))) throw new IpcError("not_found", LABELS.emulatorMissing(sdkRoot));
  const port = await findConsolePort();
  if (port === null) throw new IpcError("unavailable", LABELS.noPort);
  launchDetached(binary, emulatorArgs(avd, port, startOptions(context)), sdkEnv(sdkRoot, scrubEnv(context.env, SCRUBBED_ENV_PREFIXES)));
  const serial = `emulator-${port}`;
  emit(context, { avd, serial, port }, () => [LABELS.detached(avd, serial)]);
  return EXIT.ok;
}

function startForeground(context: CliContext, sdkRoot: string, avd: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (state: EmulatorState) => {
      if (finished) return;
      finished = true;
      context.signal.removeEventListener("abort", stop);
      if (state.kind === "failed") return reject(new IpcError("unavailable", state.message));
      emit(context, { avd, state: state.kind }, () => [LABELS.stopped]);
      resolve(EXIT.ok);
    };
    const controller = new EmulatorController(
      (state) => {
        if (state.kind === "running" && !context.json) log(context, LABELS.running(state.avd, state.serial));
        if (state.kind === "stopped" || state.kind === "failed") finish(state);
      },
      {
        paths: context.runtime.paths,
        onLog: (line) => {
          if (context.verbose) log(context, line);
        },
      },
    );
    const stop = () => void controller.stop();
    context.signal.addEventListener("abort", stop, { once: true });
    log(context, LABELS.starting(avd));
    controller.start(sdkRoot, avd, startOptions(context)).catch((error: unknown) => {
      finished = true;
      context.signal.removeEventListener("abort", stop);
      reject(error);
    });
  });
}

async function startAvd(context: CliContext, name: string | undefined): Promise<number> {
  const sdkRoot = await sdkRootFor(context);
  const avd = await avdToStart(context, name);
  return context.flags.has("detach") ? startDetached(context, sdkRoot, avd) : startForeground(context, sdkRoot, avd);
}

export function avdInvocation(args: readonly string[]): { action: string; name: string | undefined } {
  const [first = "avd", second, third] = args;
  if (first === "avd") return { action: AVD_ALIASES[second ?? ""] ?? second ?? "list", name: third };
  return { action: AVD_ALIASES[first] ?? first, name: second };
}

async function avdCommand(context: CliContext): Promise<number> {
  const { action, name } = avdInvocation(context.args);
  switch (action) {
    case "list":
      return listAvdCommand(context);
    case "create":
      return createAvd(context, name);
    case "start":
      return startAvd(context, name);
    case "delete":
      return deleteAvdCommand(context, name);
    default:
      return usageError(CLI_LABELS.unknownSubcommand("android avd", action));
  }
}

async function images(context: CliContext): Promise<number> {
  emit(context, await imagesReport(context), describeImages);
  return EXIT.ok;
}

const ACTIONS: Readonly<Record<string, (context: CliContext) => Promise<number>>> = {
  images,
  install,
  avd: avdCommand,
  ...Object.fromEntries([...AVD_ACTIONS, ...Object.keys(AVD_ALIASES)].map((action) => [action, avdCommand])),
};

export default defineCommand({
  name: "android",
  trigger: { subcommand: "android" },
  summary: CLI_LABELS.summary.android,
  usage: CLI_LABELS.usageLines.android,
  flags: ["refresh", "all", "accept-licenses", "default", "detach", "headless"],
  valueFlags: ["sdk", "image", "ram", "cores", "device", "storage", "gpu"],
  run: (context) =>
    guarded(context, async () => {
      const name = context.args[0] ?? "avd";
      const action = ACTIONS[name];
      if (!action) usageError(CLI_LABELS.unknownSubcommand("android", name));
      return action(context);
    }),
});
