import type { DefineContract } from "../ipc-types";

export type ReachabilityMode = "local" | "tailscale" | "host-tailscale";
export type SandboxComponent = "android" | "flutter" | "mono" | "whisper";
export type WhisperModel = "base" | "small" | "medium" | "large-v3-turbo";

export interface SetupChoices {
  mode: ReachabilityMode;
  tsAuthKey: string;
  tailnetDomain: string;
  hostname: string;
  bindAddr: string;
  components: SandboxComponent[];
  whisperModels: WhisperModel[];
  flutterVersion: string;
  cpus: number;
  memoryGb: number;
  timeZone: string;
  project: string;
  image: string;
  controllerPort: number;
  vncPort: number;
  claudeCodeVersion: string;
  hostClaudeDir: string;
  dind: boolean;
  useExistingImage: boolean;
}

export interface SandboxStackConfig {
  envFile: string;
  project: string;
  mode: ReachabilityMode;
  image: string;
  builtAt: string | null;
  components: SandboxComponent[];
}

export interface ValidationIssue {
  field: keyof SetupChoices;
  message: string;
}

export interface ExistingSandbox {
  container: { name: string; state: "running" | "stopped"; image: string; configFiles: string[] | null; workingDir: string | null } | null;
  image: { ref: string; sizeBytes: number; version: string | null; createdAt: string } | null;
}

export type BuildMode = "build" | "pull" | "existing";

export type BuildFailurePhase = "preflight" | "build" | "pull" | "up" | "health" | "pair";

export type BuildPhase =
  | { kind: "idle" }
  | { kind: "preflight" }
  | {
      kind: "building";
      fraction: number | null;
      step: string;
      cachedSteps: number;
      doneSteps: number;
      totalSteps: number | null;
      bytes?: { current: number; total: number };
    }
  | { kind: "pulling"; fraction: number | null; detail: string }
  | { kind: "starting" }
  | { kind: "waiting"; since: number }
  | { kind: "pairing" }
  | { kind: "done"; apiUrl: string; imageId: string }
  | { kind: "failed"; phase: BuildFailurePhase; message: string }
  | { kind: "cancelled" };

export interface ComposeServiceStatus {
  service: string;
  container: string;
  state: string;
  health: string | null;
}

export interface SandboxStackStatus {
  configured: boolean;
  project: string | null;
  services: ComposeServiceStatus[];
}

export interface PairingInfo {
  link: string;
  url: string;
  name: string | null;
  local: boolean;
}

export type SandboxContract = DefineContract<{
  methods: {
    defaults(): SetupChoices;
    validate(choices: SetupChoices): ValidationIssue[];
    save(choices: SetupChoices): SandboxStackConfig;
    stack(): SandboxStackConfig | null;
    existing(): ExistingSandbox;
    build(mode: BuildMode): BuildPhase;
    cancel(): BuildPhase;
    phase(): BuildPhase;
    up(): SandboxStackStatus;
    down(removeVolumes: boolean): SandboxStackStatus;
    status(): SandboxStackStatus;
    logs(tail: number): string[];
    pairing(): PairingInfo;
  };
  events: {
    phase: BuildPhase;
    status: SandboxStackStatus;
    log: string;
  };
}>;
