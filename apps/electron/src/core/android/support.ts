import type { AndroidHostSupport } from "../../shared/contracts/android";
import { defaultAndroidSdkRoot, type PathEnvironment } from "../paths";
import { ANDROID_LABELS } from "./labels";

const UNSUPPORTED = ANDROID_LABELS.unsupported;

export function hostSupport(paths: PathEnvironment, arch: string): AndroidHostSupport {
  const defaultSdkRoot = defaultAndroidSdkRoot(paths);
  if (paths.platform === "linux") {
    return arch === "x64"
      ? { supported: true, hostOs: "linux", hostArch: "x64", abi: "x86_64", acceleration: "kvm", canLinkSandbox: true, defaultSdkRoot }
      : { supported: false, reason: UNSUPPORTED.linuxArm };
  }
  if (paths.platform === "darwin") {
    const arm = arch === "arm64";
    return {
      supported: true,
      hostOs: "macosx",
      hostArch: arm ? "aarch64" : "x64",
      abi: arm ? "arm64-v8a" : "x86_64",
      acceleration: "hvf",
      canLinkSandbox: false,
      defaultSdkRoot,
    };
  }
  if (paths.platform === "win32") {
    return arch === "x64"
      ? { supported: true, hostOs: "windows", hostArch: "x64", abi: "x86_64", acceleration: "whpx", canLinkSandbox: false, defaultSdkRoot }
      : { supported: false, reason: UNSUPPORTED.windowsArm };
  }
  return { supported: false, reason: UNSUPPORTED.other };
}
