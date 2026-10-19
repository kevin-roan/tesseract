import type { EmulatorState, RuntimeKind, StopSignal } from "@tesseract/protocol";
import type { RecordStatus } from "../../components/RecordRow";
import type { IconName } from "../../theme/icons";
import type { HostDeviceKind } from "../host-shell/types";

export type ProcessGroupId = RuntimeKind | "emulator";

export interface ProcessTarget {
  group: ProcessGroupId;
  id: string;
  name: string;
  supervised: boolean;
}

export interface ProcessRowModel {
  key: string;
  target: ProcessTarget;
  title: string;
  subtitle: string | null;
  meta: string;
  status: RecordStatus;
  canStop: boolean;
}

export interface ProcessGroupModel {
  id: ProcessGroupId;
  title: string;
  icon: IconName;
  rows: ProcessRowModel[];
}

export interface StopRequest {
  target: ProcessTarget;
  signal: StopSignal;
}

export interface HostDeviceSnapshot {
  id: HostDeviceKind;
  state: EmulatorState;
  name: string;
  detail: string;
  startedAt: string | null;
}
