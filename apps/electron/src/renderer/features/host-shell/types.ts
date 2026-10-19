import type { IconName } from "../../theme/icons";

export type HostAccess = "loading" | "stopped" | "starting" | "failed" | "noHost" | "noPin" | "locked" | "ready";

export type HostGateAction = "start" | "unlock" | "preferences";

export interface HostGateModel {
  icon: IconName;
  title: string;
  message: string | null;
  loading: boolean;
  action: HostGateAction | null;
  actionLabel: string | null;
  secondary: HostGateAction | null;
  secondaryLabel: string | null;
}

export type HostDeviceKind = "android" | "ios";
