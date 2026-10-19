import type { MachineStatus } from "../../../shared/contracts/connection";
import type { Tone } from "../../theme/colors";
import { HOST_EMULATOR_KEY, HOST_SHELL_STATE_KEY } from "../host-shell/constants";
import { MASTER_HOST_STATE_KEY } from "../master-host/constants";

export const MACHINE_DIALOG_WIDTH = 460;
export const MACHINE_ICON = "sandbox" as const;
export const MACHINE_LOCAL_ICON = "host" as const;
export const MACHINE_HOST_ICON = "host" as const;
export const PAIR_LINK_SCHEME = "tesseract:";

export const MACHINE_STATUS_TONES: Record<MachineStatus, Tone> = {
  online: "success",
  offline: "danger",
  unknown: "neutral",
};

export const MACHINE_SCOPED_QUERY_KEYS: readonly (readonly string[])[] = [HOST_SHELL_STATE_KEY, HOST_EMULATOR_KEY, MASTER_HOST_STATE_KEY];
