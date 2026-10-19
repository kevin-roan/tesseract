import { isHostRuntime, runtimeBadge } from "../utils/runtime";
import { useSandboxStatus } from "./use-sandbox-queries";

/** Whether the paired controller runs its projects on the host (`tesseract --unsafe-repo`) instead of a sandbox. */
export function useSandboxRuntime() {
  const runtime = useSandboxStatus().data?.runtime;
  return { onHost: isHostRuntime(runtime), badge: runtimeBadge(runtime) };
}
