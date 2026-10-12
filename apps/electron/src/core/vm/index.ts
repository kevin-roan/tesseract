import type { DockerPhase } from "../../shared/contracts/docker";
import type { VmSize, VmStatus } from "../../shared/contracts/vm";
import { guarded, setupWithRuntime, startWithRuntime, statusWithRuntime, stopWithRuntime, vmRuntime, type VmOptions } from "./vm";

export { VM_CONTEXT, VM_DEFAULT_SIZE, VM_PROFILE } from "./constants";
export type { VmOptions } from "./vm";

export function vmStatus(options: VmOptions = {}): Promise<VmStatus> {
  return statusWithRuntime(vmRuntime(options));
}

export function setupVm(options: VmOptions & { resourcesDir: string; size?: Partial<VmSize> }): Promise<DockerPhase> {
  const runtime = vmRuntime(options);
  return guarded(runtime, () => setupWithRuntime(runtime, { resourcesDir: options.resourcesDir, size: options.size }));
}

export function startVm(options: VmOptions = {}): Promise<DockerPhase> {
  const runtime = vmRuntime(options);
  return guarded(runtime, () => startWithRuntime(runtime));
}

export function stopVm(options: VmOptions = {}): Promise<DockerPhase> {
  const runtime = vmRuntime(options);
  return guarded(runtime, () => stopWithRuntime(runtime));
}
