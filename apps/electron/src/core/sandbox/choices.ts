import { isAbsolute, join, win32 } from "node:path";
import type { DockerReport } from "../../shared/contracts/docker";
import type {
  ReachabilityMode,
  SandboxComponent,
  SetupChoices,
  ValidationIssue,
  WhisperModel,
} from "../../shared/contracts/sandbox";
import {
  COMPONENT_BUILD_ARGS,
  COMPONENTS,
  DEFAULT_CLAUDE_CODE_VERSION,
  DEFAULT_CONTROLLER_PORT,
  DEFAULT_CPUS,
  DEFAULT_FLUTTER_VERSION,
  DEFAULT_HOSTNAME,
  DEFAULT_IMAGE,
  DEFAULT_MEMORY_GB,
  DEFAULT_MODE,
  DEFAULT_PROJECT,
  DEFAULT_TIME_ZONE,
  DEFAULT_VNC_PORT,
  DEFAULT_WHISPER_MODELS,
  GIB,
  LOCAL_BIND_ADDR,
  MEMORY_DEFAULT_SHARE,
  MIN_MEMORY_GB,
  MODES,
  PATTERNS,
  WHISPER_MODELS,
} from "./constants";
import { isTruthyFlag, type EnvKey, type EnvValues } from "./env-file";
import { SANDBOX_LABELS } from "./labels";
import { bindAddrError } from "./stack";

export interface HostResources {
  cpus: number;
  memBytes: number;
  timeZone: string;
  homeDir: string;
}

export interface ValidationContext {
  maxCpus?: number;
  memBytes?: number;
  tailscaleVolumeExists?: boolean;
  savedAuthKey?: boolean;
}

export interface EnvSecrets {
  token: string;
  tsAuthKey?: string;
  claudeOAuthToken?: string;
}

function limits(host: HostResources, docker: DockerReport | null) {
  const cpus = Math.max(1, docker?.server?.ncpu || host.cpus || 1);
  const memBytes = docker?.server?.memBytes || host.memBytes;
  return { cpus, memBytes };
}

export function maxMemoryGb(memBytes: number): number {
  return Math.max(MIN_MEMORY_GB, Math.floor(memBytes / GIB));
}

export function defaultChoices(host: HostResources, docker: DockerReport | null): SetupChoices {
  const { cpus, memBytes } = limits(host, docker);
  return {
    mode: DEFAULT_MODE,
    tsAuthKey: "",
    tailnetDomain: "",
    hostname: DEFAULT_HOSTNAME,
    bindAddr: "",
    components: [...COMPONENTS],
    whisperModels: [...DEFAULT_WHISPER_MODELS],
    flutterVersion: DEFAULT_FLUTTER_VERSION,
    cpus: Math.min(DEFAULT_CPUS, cpus),
    memoryGb: Math.max(MIN_MEMORY_GB, Math.min(DEFAULT_MEMORY_GB, Math.floor((memBytes * MEMORY_DEFAULT_SHARE) / GIB))),
    timeZone: host.timeZone || DEFAULT_TIME_ZONE,
    project: DEFAULT_PROJECT,
    image: DEFAULT_IMAGE,
    controllerPort: DEFAULT_CONTROLLER_PORT,
    vncPort: DEFAULT_VNC_PORT,
    claudeCodeVersion: DEFAULT_CLAUDE_CODE_VERSION,
    hostClaudeDir: join(host.homeDir, ".claude"),
    dind: false,
    useExistingImage: false,
  };
}

function validPort(value: number): boolean {
  return Number.isInteger(value) && PATTERNS.port.test(String(value)) && value <= 65535;
}

export function validateChoices(choices: SetupChoices, context: ValidationContext = {}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (field: keyof SetupChoices, message: string) => issues.push({ field, message });
  const labels = SANDBOX_LABELS.validation;

  if (!PATTERNS.project.test(choices.project)) add("project", labels.project);
  if (!PATTERNS.image.test(choices.image)) add("image", labels.image);
  if (!validPort(choices.controllerPort)) add("controllerPort", labels.port);
  if (!validPort(choices.vncPort)) add("vncPort", labels.port);
  else if (choices.vncPort === choices.controllerPort) add("vncPort", labels.portsClash);

  if (choices.mode === "tailscale") {
    if (!choices.tailnetDomain.trim()) add("tailnetDomain", labels.tailnetDomainRequired);
    else if (!PATTERNS.tailnetDomain.test(choices.tailnetDomain)) add("tailnetDomain", labels.tailnetDomain);
    if (!PATTERNS.hostname.test(choices.hostname)) add("hostname", labels.hostname);
    if (!choices.tsAuthKey.trim() && !context.tailscaleVolumeExists && !context.savedAuthKey) {
      add("tsAuthKey", labels.authKeyRequired);
    }
  }
  if (choices.mode === "host-tailscale") {
    if (!choices.bindAddr.trim()) add("bindAddr", labels.bindAddrRequired);
    else {
      const error = bindAddrError(choices.bindAddr.trim());
      if (error) add("bindAddr", error);
    }
  }

  if (choices.components.includes("whisper") && choices.whisperModels.length === 0) add("whisperModels", labels.whisperModels);
  if (choices.components.includes("flutter") && !PATTERNS.version.test(choices.flutterVersion)) add("flutterVersion", labels.version);
  if (!PATTERNS.version.test(choices.claudeCodeVersion)) add("claudeCodeVersion", labels.version);

  const maxCpus = context.maxCpus ?? Number.POSITIVE_INFINITY;
  if (!Number.isInteger(choices.cpus) || choices.cpus < 1 || choices.cpus > maxCpus) {
    add("cpus", labels.cpus(Number.isFinite(maxCpus) ? maxCpus : choices.cpus));
  }
  const maxMemory = context.memBytes ? maxMemoryGb(context.memBytes) : Number.POSITIVE_INFINITY;
  if (!Number.isInteger(choices.memoryGb) || choices.memoryGb < MIN_MEMORY_GB || choices.memoryGb > maxMemory) {
    add("memoryGb", labels.memory(MIN_MEMORY_GB, Number.isFinite(maxMemory) ? maxMemory : choices.memoryGb));
  }
  if (!choices.timeZone.trim()) add("timeZone", labels.timeZone);
  if (!isAbsolute(choices.hostClaudeDir) && !win32.isAbsolute(choices.hostClaudeDir)) add("hostClaudeDir", labels.claudeDir);
  return issues;
}

function flag(value: boolean): string {
  return value ? "true" : "false";
}

export function orderedWhisperModels(models: readonly WhisperModel[]): WhisperModel[] {
  return WHISPER_MODELS.filter((model) => models.includes(model));
}

export function choicesToEnv(
  choices: SetupChoices,
  ids: { uid: number; gid: number },
  secrets: EnvSecrets,
): Partial<Record<EnvKey, string>> {
  const has = (component: SandboxComponent) => choices.components.includes(component);
  const bindAddr = choices.mode === "local" ? LOCAL_BIND_ADDR : choices.mode === "host-tailscale" ? choices.bindAddr.trim() : "";
  const tailscale = choices.mode === "tailscale";
  const values: Partial<Record<EnvKey, string>> = {
    TESSERACT_MODE: choices.mode,
    TESSERACT_DIND: choices.dind ? "1" : "",
    TESSERACT_COMPOSE_PROJECT: choices.project,
    TESSERACT_VOLUME_PREFIX: "",
    TESSERACT_IMAGE: choices.image,
    TS_AUTHKEY: tailscale ? (choices.tsAuthKey.trim() || secrets.tsAuthKey || "") : "",
    TS_TAILNET_DOMAIN: tailscale ? choices.tailnetDomain.trim() : "",
    TESSERACT_HOSTNAME: choices.hostname || DEFAULT_HOSTNAME,
    TESSERACT_BIND_ADDR: bindAddr,
    TESSERACT_CONTROLLER_HOST_PORT: String(choices.controllerPort),
    TESSERACT_VNC_HOST_PORT: String(choices.vncPort),
    TESSERACT_TOKEN: secrets.token,
    TESSERACT_HOST_CLAUDE_DIR: choices.hostClaudeDir,
    SANDBOX_CPUS: String(choices.cpus),
    SANDBOX_MEMORY: `${choices.memoryGb}g`,
    TZ: choices.timeZone,
    DEV_UID: String(ids.uid),
    DEV_GID: String(ids.gid),
    FLUTTER_VERSION: choices.flutterVersion || DEFAULT_FLUTTER_VERSION,
    WHISPER_MODELS: orderedWhisperModels(choices.whisperModels).join(" "),
    CLAUDE_CODE_VERSION: choices.claudeCodeVersion || DEFAULT_CLAUDE_CODE_VERSION,
    CLAUDE_CODE_OAUTH_TOKEN: secrets.claudeOAuthToken || undefined,
  };
  for (const component of COMPONENTS) values[COMPONENT_BUILD_ARGS[component] as EnvKey] = flag(has(component));
  return values;
}

function intOr(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function choicesFromEnv(values: EnvValues, base: SetupChoices): SetupChoices {
  const mode = MODES.find((candidate) => candidate === values.TESSERACT_MODE) ?? base.mode;
  const components = COMPONENTS.filter((component) => {
    const raw = values[COMPONENT_BUILD_ARGS[component]];
    return raw === undefined || raw === "" ? base.components.includes(component) : raw === "true";
  });
  const models = (values.WHISPER_MODELS ?? "")
    .split(/\s+/)
    .filter((model): model is WhisperModel => WHISPER_MODELS.includes(model as WhisperModel));
  const memory = PATTERNS.memory.exec(values.SANDBOX_MEMORY ?? "");
  return {
    ...base,
    mode: mode as ReachabilityMode,
    tsAuthKey: values.TS_AUTHKEY ?? "",
    tailnetDomain: values.TS_TAILNET_DOMAIN ?? base.tailnetDomain,
    hostname: values.TESSERACT_HOSTNAME || base.hostname,
    bindAddr: mode === "host-tailscale" ? (values.TESSERACT_BIND_ADDR ?? base.bindAddr) : base.bindAddr,
    components,
    whisperModels: models.length ? models : base.whisperModels,
    flutterVersion: values.FLUTTER_VERSION || base.flutterVersion,
    cpus: intOr(values.SANDBOX_CPUS, base.cpus),
    memoryGb: memory ? intOr(memory[1], base.memoryGb) : base.memoryGb,
    timeZone: values.TZ || base.timeZone,
    project: values.TESSERACT_COMPOSE_PROJECT || base.project,
    image: values.TESSERACT_IMAGE || base.image,
    controllerPort: intOr(values.TESSERACT_CONTROLLER_HOST_PORT, base.controllerPort),
    vncPort: intOr(values.TESSERACT_VNC_HOST_PORT, base.vncPort),
    claudeCodeVersion: values.CLAUDE_CODE_VERSION || base.claudeCodeVersion,
    hostClaudeDir: values.TESSERACT_HOST_CLAUDE_DIR || base.hostClaudeDir,
    dind: isTruthyFlag(values.TESSERACT_DIND),
  };
}

export function withoutSecrets(choices: SetupChoices): SetupChoices {
  return { ...choices, tsAuthKey: "" };
}
