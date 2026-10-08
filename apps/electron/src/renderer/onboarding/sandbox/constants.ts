import type { OnboardingStepId } from "../../../shared/routes";
import type { BuildMode, ReachabilityMode, SandboxComponent, WhisperModel } from "../../../shared/contracts/sandbox";

export const SANDBOX_COMPONENTS: readonly SandboxComponent[] = ["android", "flutter", "mono", "whisper"];
export const WHISPER_MODEL_ORDER: readonly WhisperModel[] = ["base", "small", "medium", "large-v3-turbo"];
export const REACHABILITY_ORDER: readonly ReachabilityMode[] = ["local", "tailscale", "host-tailscale"];
export const SOURCE_ORDER: readonly BuildMode[] = ["build", "pull", "existing"];

export const BASE_IMAGE_GB = 4.7;
export const COMPONENT_SIZE_GB: Record<SandboxComponent, number> = {
  android: 0.7,
  flutter: 1.4,
  mono: 0.4,
  whisper: 0.6,
};
export const DISK_BASE_GB = 15;
export const DISK_ROUND_GB = 5;
export const GB = 1e9;
export const GIB = 1024 ** 3;
export const MIN_MEMORY_GB = 2;

export const VALIDATE_DEBOUNCE_MS = 150;
export const VALIDATE_GC_MS = 5000;
export const AUTH_KEY_PRESENT = "present";
export const LOG_MAX_LINES = 200;
export const LOG_HEIGHT_PX = 220;
export const STEPPER_BUTTON_SIZE = 24;
export const DISK_MEASURED_KINDS = ["engine", "rootless"] as const;

export const SANDBOX_QUERY_KEYS = {
  existing: ["sandbox", "existing"] as const,
  defaults: ["sandbox", "defaults"] as const,
  validate: ["sandbox", "validate"] as const,
};

export const FOCUS_PARAM = "focus";
export const REACHABILITY_SECTION = "reachability";
export const FOCUS_TARGET_SELECTOR = '[aria-checked="true"], [role="radio"], input, button';
export const BUILD_STEP_ID: OnboardingStepId = "build";
export const PREBUILT_IMAGE_PUBLISHED = false;
export const FALLBACK_HOSTNAME = "tesseract-sandbox";
