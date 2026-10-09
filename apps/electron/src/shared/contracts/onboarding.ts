import type { DefineContract } from "../ipc-types";
import type { OnboardingStepId } from "../routes";
import type { AndroidHostSupport, InstallPlan, PackageProgress, SdkCatalog, AccelResult } from "./android";
import type { HostClaudeState } from "./claude";
import type { ConnectionInput } from "./connection";
import type { DockerInstallRequest, DockerPhase, DockerReport } from "./docker";
import type { BuildMode, BuildPhase, PairingInfo, SetupChoices } from "./sandbox";

export type StepStatus = "pending" | "active" | "running" | "done" | "warning" | "skipped" | "error";

export interface HostInfo {
  platform: "linux" | "darwin" | "win32";
  arch: "x64" | "arm64";
  osVersion: string;
  distro?: { id: string; idLike: string[]; versionId: string; prettyName: string };
  cpus: number;
  memBytes: number;
  translated: boolean;
  homeDir: string;
  freeDiskBytes: number | null;
}

export type AndroidPhase =
  | { kind: "idle" }
  | { kind: "unsupported"; reason: string }
  | { kind: "loading-catalog" }
  | { kind: "choosing" }
  | { kind: "licenses"; pending: string[] }
  | ({ kind: "installing" } & PackageProgress)
  | { kind: "accel"; result?: AccelResult }
  | { kind: "creating-avd" }
  | { kind: "done"; sdkRoot: string; avd: string; warnings: string[] }
  | { kind: "failed"; message: string }
  | { kind: "cancelled" };

export type OnboardingLogKey = "docker" | "build" | "android";

export interface OnboardingState {
  step: OnboardingStepId;
  statuses: Record<OnboardingStepId, StepStatus>;
  host: HostInfo;
  docker: DockerReport | null;
  dockerPhase: DockerPhase;
  claude: HostClaudeState[] | null;
  choices: SetupChoices;
  build: BuildPhase;
  android: AndroidPhase;
  androidSupport: AndroidHostSupport | null;
  pair: PairingInfo | null;
  log: Record<OnboardingLogKey, string[]>;
  completedAt: string | null;
}

export type OnboardingUrlKey =
  | "docker_mac_docs"
  | "docker_windows_docs"
  | "docker_desktop_linux_docs"
  | "docker_engine_docs"
  | "docker_compose_install"
  | "docker_buildx_install"
  | "docker_ssa"
  | "virtualization_help"
  | "tailscale_keys"
  | "android_accel_docs"
  | "claude_code_docs";

export type OnboardingContract = DefineContract<{
  methods: {
    get(): OnboardingState;
    goto(step: OnboardingStepId): OnboardingState;
    skip(step: OnboardingStepId): OnboardingState;
    dockerCheck(): OnboardingState;
    dockerInstall(request: DockerInstallRequest): OnboardingState;
    dockerStart(): OnboardingState;
    claudeCheck(): OnboardingState;
    claudeCreateDir(): OnboardingState;
    sandboxSave(choices: SetupChoices): OnboardingState;
    buildStart(mode: BuildMode): OnboardingState;
    buildCancel(): OnboardingState;
    sandboxAdopt(): OnboardingState;
    androidCatalog(refresh: boolean): SdkCatalog;
    androidAcceptLicense(licenseId: string): OnboardingState;
    androidInstall(plan: InstallPlan): OnboardingState;
    androidCancel(): OnboardingState;
    androidUseExisting(sdkRoot: string, avd: string): OnboardingState;
    pairLoad(): OnboardingState;
    connectRemote(input: ConnectionInput): OnboardingState;
    finish(sandboxAutostart: boolean): OnboardingState;
    openExternal(key: OnboardingUrlKey): void;
  };
  events: {
    state: OnboardingState;
  };
}>;
