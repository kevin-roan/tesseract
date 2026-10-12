export type VmState = "unsupported" | "missing" | "stopped" | "running";

export interface VmTools {
  brew: string | null;
  colima: string | null;
  limactl: string | null;
  docker: string | null;
  compose: string | null;
  buildx: string | null;
}

export interface VmSize {
  cpus: number;
  memoryGb: number;
  diskGb: number;
}

export interface VmStatus {
  state: VmState;
  profile: string;
  context: string;
  tools: VmTools;
  sysbox: boolean;
  activeContext: string | null;
  active: boolean;
  size: VmSize;
  dockerDesktopRunning: boolean;
}
