export const POLL_MS = 2000;
export const STOP_TIMEOUT_MS = 60_000;
export const BOOT_TIMEOUT_MS = 330_000;
export const TARGET_TIMEOUT_MS = 60_000;
export const SCRCPY_MISSING_CODE = "not_found";
export const NO_SERIAL_CODE = "invalid_argument";
export const SESSION_REQUIRED_CODE = "forbidden";
export const SESSION_REQUIRED_DETAIL = "pin-session";
import type { OnboardingStepId, PreferencesSectionId } from "../../../../../shared/routes";

export const HOST_SHELL_SECTION: PreferencesSectionId = "host-shell";
export const ANDROID_ONBOARDING_STEP: OnboardingStepId = "android";
